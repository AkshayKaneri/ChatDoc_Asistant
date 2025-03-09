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

        // Convert question to embedding
        const response = await openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: question,
        });
        const queryEmbedding = response.data[0].embedding;

        // Query Pinecone **without restricting namespace**
        const searchResults = await queryPinecone(queryEmbedding, null, 15);

        if (!searchResults.matches.length) {
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
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `You are an AI assistant specializing in answering questions based on **provided document data**.  
                    - If relevant details are found, respond with **clear, structured answers**.  
                    - If the user asks for **simplified explanations**, respond in **easy-to-understand terms**.  
                    - If the user asks for a **step-by-step breakdown**, provide a **structured response**.  
                    - If the user asks for a **visualization or mental image**, **describe it in detail**.  
                    - If relevant details are missing, say:  
                      _"I couldn't find details on that in your uploaded documents. You may try rephrasing or uploading related PDFs."_  
                    - If the question is **off-topic**, say:  
                      _"I specialize in answering queries based on uploaded PDFs. Try asking something relevant to your documents."_`
                },
                {
                    role: "user",
                    content: `You are an AI assistant trained to analyze, explain, and simplify concepts strictly based on the provided document excerpts.  
                
                    **User's Question:**  
                    "${question}"  
                
                    **📌 Extracted Data (Across Multiple Namespaces & PDFs):**  
                    ---  
                    ${retrievedTextForGPT}  
                    ---  
                
                    Now, based on the text above, provide the most **accurate, structured, and insightful** response possible.`
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