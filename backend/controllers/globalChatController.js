const { OpenAI } = require("openai");
const { queryPinecone, getNamespace } = require("../utils/pinecone-handler");
const Chat = require("../models/chatModel");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 📌 Global Chat API → Query Across All Namespaces
async function queryGlobalChat(req, res) {
    try {
        const { question } = req.body;
        if (!question) return res.status(400).json({ error: "Question is required." });

        console.log(`🔍 User asked: "${question}" across all namespaces`);

        await saveGlobalChatMessage("user", question);
        const expandedQuestion = `${question}. If applicable, highlight differences, conflicts, or unique additions between namespaces or documents.`;        // Convert question to embedding
        const response = await openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: expandedQuestion,
        });
        const queryEmbedding = response.data[0].embedding;

        // Query Pinecone **without restricting namespace**
        const searchResults = await queryPinecone(queryEmbedding, null, 15);

        if (!searchResults?.matches?.length) {
            console.log("❌ No relevant chunks found globally.");

            // Generate a more **natural fallback response**
            const fallbackResponses = [
                "I couldn't find anything related to that. Maybe try rephrasing?",
                "It looks like I don't have that information yet. You can upload related documents if needed!",
                "Hmm, I couldn't find relevant details. Try asking something else about your uploaded PDFs!",
                "I’m here to help with document-related queries. Maybe refine your question?",
            ];
            const randomFallback = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];

            await saveGlobalChatMessage("assistant", randomFallback);
            return res.json({ answer: randomFallback });
        }

        let retrievedChunks = searchResults.matches.map(match => ({
            text: match.metadata.text,
            pdfName: match.metadata.pdfName,
            namespace: match.namespace,
            score: match.score
        }));

        // ✅ Step 1: Group results by **Namespace & PDF Name**
        const groupedBySource = retrievedChunks.reduce((acc, chunk) => {
            const sourceKey = `${chunk.namespace} | ${chunk.pdfName}`; // ✅ Unique key for each (Namespace + PDF)
            if (!acc[sourceKey]) acc[sourceKey] = [];
            acc[sourceKey].push(chunk);
            return acc;
        }, {});

        // ✅ Step 2: Rank sources by relevance
        const sortedSources = Object.keys(groupedBySource).sort((a, b) => {
            const avgScoreA = groupedBySource[a].reduce((sum, c) => sum + c.score, 0) / groupedBySource[a].length;
            const avgScoreB = groupedBySource[b].reduce((sum, c) => sum + c.score, 0) / groupedBySource[b].length;
            return avgScoreB - avgScoreA;
        });

        // ✅ Step 3: Use **Top 3 Sources** for AI Answer
        const topSources = sortedSources.slice(0, 3);
        let retrievedTextForGPT = topSources
            .map(sourceKey => {
                const chunks = groupedBySource[sourceKey].map(chunk => chunk.text).join("\n\n");
                return `📌 **Source: ${sourceKey}**\n${chunks}`;
            })
            .join("\n\n");

        // ✅ Limit token length for GPT (Max: 6000 chars)
        retrievedTextForGPT = retrievedTextForGPT.slice(0, 6000);

        console.log("🤖 Generating AI response...");
        const aiResponse = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: `You are a highly skilled AI assistant trained to analyze, compare, and summarize information across multiple regulatory documents from different namespaces (e.g., R25, R26, dialysis requirements).
                  
                  Your responsibilities include:
                  - Answering questions strictly based on the provided document excerpts.
                  - Comparing and contrasting requirements across different PDFs or namespaces.
                  - Identifying conflicts, contradictions, changes, or differences between regulations.
                  - If the user asks about "conflicting" or "differing" requirements, analyze all relevant sources and highlight the distinctions.
                  - If the information is not found in the provided content, respond with:  
                    <i>I couldn't find specific details in the uploaded documents. Please try rephrasing or uploading more related PDFs.</i>
                  - If the question is off-topic, respond with:  
                    <i>I specialize in answering queries based on uploaded documents. Please ask something relevant to the PDFs.</i>
                  
                  Formatting guidelines:
                  - You are allowed to use HTML tags such as <b>, <i>, <ul>, <li>, <table>, <tr>, <td>, and emojis 😊 to enhance clarity and visual presentation.
                  - Format your output using proper HTML where applicable.
                  - Prefer structured formatting like bullet points or tables when presenting comparisons or lists.
                  - Do not return raw markdown. Only use valid HTML.
                  
                  Always provide clear, structured, and source-referenced answers when applicable.`
                },
                {
                    role: "user",
                    content: `Example:
                  
                  **Question:** What are the differences between R25 and R26 dialysis requirements?
                  
                  **Chunks:**  
                  📌 Source: R25 Requirements | Doc1  
                  - Patients must fast for 12 hours before treatment.  
                  📌 Source: R26 Requirements | Doc2  
                  - Fasting duration is 8 hours instead of 12.
                  
                  **Expected Answer:**  
                  The R25 requirements specify a fasting period of 12 hours, whereas R26 has reduced it to 8 hours, indicating a relaxation in patient prep protocol.
                  
                  ----
                  
                  Now answer this:
                  
                  **User's Question:**  
                  "${question}"
                  
                  📄 **Document Chunks from Multiple Namespaces and PDFs:**  
                  ---  
                  ${retrievedTextForGPT}  
                  ---  
                  `
                }
            ],
        });

        const responseText = aiResponse.choices[0].message.content;

        // ✅ Save AI response in **global chat history**
        await saveGlobalChatMessage("assistant", responseText);

        // ✅ Return AI response along with source references
        res.json({
            answer: responseText,
            sources: topSources.map(source => ({ source })),
        });

    } catch (error) {
        console.error("❌ Error processing global query:", error);
        res.status(500).json({ error: "Failed to process global query" });
    }
}

// 📌 Save Global Chat Messages to MongoDB
async function saveGlobalChatMessage(sender, text) {
    try {
        let chat = await Chat.findOne({ namespace: "GLOBAL_CHAT" });

        if (!chat) {
            chat = new Chat({ namespace: "GLOBAL_CHAT", messages: [] });
        }

        chat.messages.push({ sender, message: text.trim() });
        await chat.save();
    } catch (error) {
        console.error(`❌ Error saving global chat: ${error.message}`);
    }
}

// 📌 Get Global Chat History
async function getGlobalChatHistory(req, res) {
    try {
        const chat = await Chat.findOne({ namespace: "GLOBAL_CHAT" });

        if (!chat) {
            return res.json({ namespace: "GLOBAL_CHAT", history: [] });
        }

        res.json({ namespace: "GLOBAL_CHAT", history: chat.messages });
    } catch (error) {
        console.error("❌ Error fetching global chat history:", error);
        res.status(500).json({ error: "Failed to fetch global chat history" });
    }
}

// 📌 Register new routes
module.exports = { queryGlobalChat, getGlobalChatHistory };