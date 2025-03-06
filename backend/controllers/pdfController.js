const pdfParse = require("pdf-parse");
const { OpenAI } = require("openai");
const { storeEmbeddings, queryPinecone, getNamespace, deleteRequestedNameSpace } = require("../utils/pinecone-handler");
const { splitText } = require("../utils/text-chunker");
const Chat = require("../models/chatModel");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 📌 Upload Multiple PDFs and Automatically Assign Namespace
async function uploadPDF(req, res) {
    try {
        const { namespace } = req.body;
        if (!namespace) return res.status(400).json({ error: "Namespace is required." });
        if (!req.files || req.files.length === 0) return res.status(400).json({ error: "No files uploaded." });

        let allEmbeddings = [];

        for (const file of req.files) {
            try {
                if (!file.buffer) {
                    console.error(`⚠️ Skipping file ${file.originalname}: No file buffer found.`);
                    continue;
                }
                console.log(`📂 Processing '${file.originalname}' in namespace '${namespace}'`);
                const pdfName = file.originalname.replace(/\.[^/.]+$/, "");

                const pdfData = await pdfParse(file.buffer);
                if (!pdfData.text.trim()) {
                    console.warn(`⚠️ PDF '${file.originalname}' contains no extractable text. Skipping.`);
                    continue;
                }

                const textChunks = await splitText(pdfData);
                if (textChunks.length === 0) {
                    console.warn(`⚠️ No meaningful text found in '${file.originalname}'. Skipping.`);
                    continue;
                }

                let embeddings = [];
                for (let i = 0; i < textChunks.length; i++) {
                    const response = await openai.embeddings.create({
                        model: "text-embedding-ada-002",
                        input: textChunks[i],
                    });

                    embeddings.push({
                        id: `${pdfName}-chunk-${i}`,
                        chunk: textChunks[i],
                        embedding: response.data[0].embedding,
                        pdfName: pdfName,
                    });
                }

                allEmbeddings.push(...embeddings);

            } catch (error) {
                console.error(`❌ Error processing file ${file.originalname}:`, error);
            }
        }

        if (allEmbeddings.length > 0) {
            await storeEmbeddings(allEmbeddings, namespace);
            res.json({ message: `All PDFs uploaded and stored in namespace '${namespace}' successfully!` });
        } else {
            res.status(400).json({ error: "No valid PDFs were processed." });
        }

    } catch (error) {
        console.error("❌ Error processing PDFs:", error);
        res.status(500).json({ error: "Failed to process PDFs" });
    }
}

// 📌 Query API → Retrieve Chat History + Process New Query
async function queryNamespace(req, res) {
    try {
        const { question, namespace } = req.body;
        if (!question || !namespace) return res.status(400).json({ error: "Question and Namespace are required." });

        console.log(`🔍 User asked: "${question}" in namespace: '${namespace}'`);

        await saveChatMessage(namespace, "user", question);

        const response = await openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: question,
        });
        const queryEmbedding = response.data[0].embedding;

        const searchResults = await queryPinecone(queryEmbedding, namespace, 15);
        if (!searchResults.matches.length) {
            console.log("❌ No relevant chunks found in namespace.");
            const fallbackResponses = [
                "I couldn't find anything related to that. Maybe try rephrasing?",
                "It looks like I don't have that information yet. You can upload related documents if needed!",
                "Hmm, I couldn't find relevant details. Try asking something else about your uploaded PDFs!",
                "I’m here to help with document-related queries. Maybe refine your question?",
            ];
            const randomFallback = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
            await saveChatMessage(namespace, "assistant", randomFallback);
            return res.json({ answer: randomFallback });
        }

        let retrievedChunks = searchResults.matches.map(match => ({
            text: match.metadata.text,
            pdfName: match.metadata.pdfName,
            score: match.score
        }));

        const groupedByPDF = retrievedChunks.reduce((acc, chunk) => {
            if (!acc[chunk.pdfName]) acc[chunk.pdfName] = [];
            acc[chunk.pdfName].push(chunk);
            return acc;
        }, {});

        const sortedPDFs = Object.keys(groupedByPDF).sort((a, b) => {
            const avgScoreA = groupedByPDF[a].reduce((sum, c) => sum + c.score, 0) / groupedByPDF[a].length;
            const avgScoreB = groupedByPDF[b].reduce((sum, c) => sum + c.score, 0) / groupedByPDF[b].length;
            return avgScoreB - avgScoreA;
        });

        const bestPDF = sortedPDFs[0];
        retrievedChunks = groupedByPDF[bestPDF];

        const retrievedTextForGPT = retrievedChunks.map(chunk => chunk.text).join("\n\n").slice(0, 6000);

        console.log("🤖 Generating AI response...");
        const aiResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `You are an AI assistant specializing in answering questions based on provided text. 
                    If the answer isn't available in the text, respond naturally rather than just saying "I don't know."
                    - If the user's query is related but no information is found, say: "I couldn't find specific details, but you can try rephrasing or uploading related documents."
                    - If the query is completely unrelated, say: "I'm here to assist with your uploaded PDFs. Try asking about your documents!"`
                },
                {
                    role: "user",
                    content: `You are an AI assistant trained to analyze, explain, and simplify concepts strictly based on the provided document excerpts. 
                
                    - Your answers must be based **ONLY** on the text below.  
                    - If relevant details are found, respond with **clear, structured answers**.  
                    - If the user asks for **simplified explanations**, respond in **easy-to-understand terms**.  
                    - If the user asks for a **step-by-step breakdown**, provide a **structured response**.  
                    - If the user asks for a **visualization or mental image**, **describe it in detail**.  
                    - If relevant details are missing, say:  
                      _"I couldn't find details on that in your uploaded documents. You may try rephrasing or uploading related PDFs."_  
                    - If the question is **off-topic**, say:  
                      _"I specialize in answering queries based on uploaded PDFs. Try asking something relevant to your documents."_  
                
                    **User's Question:**  
                    "${question}"  
                
                    **📌 Extracted Document Data:**  
                    ---  
                    ${retrievedTextForGPT}  
                    ---  
                
                    Now, based on the text above, provide the most **accurate, structured, and insightful** response possible.  
                    `
                }],
        });

        const responseText = aiResponse.choices[0].message.content;

        await saveChatMessage(namespace, "assistant", responseText);

        res.json({
            answer: responseText,
            source: { pdfName: bestPDF }
        });

    } catch (error) {
        console.error("❌ Error processing query:", error);
        res.status(500).json({ error: "Failed to process query" });
    }
}

// 📌 Namespaces list API → Retrieve Relevant existing namespaces
async function getNamespaces(req, res) {
    try {
        const stats = await getNamespace();
        return res.json(stats);
    } catch (error) {
        console.error("❌ Error fetching namespaces:", error);
        return res.status(500).json({ error: "Failed to fetch namespaces" });
    }
}

// 📌 Delete Namespace → Delete the namespace user requested
async function deleteNamespace(req, res) {
    try {
        const { namespace } = req.params;
        if (!namespace) {
            return res.status(400).json({ error: "Namespace parameter is required" });
        }
        const deletedStatus = await deleteRequestedNameSpace(namespace);
        return res.json(deletedStatus);
    } catch (error) {
        console.error("❌ Error deleting namespace:", error);
        return res.status(500).json({ error: "Failed to delete namespace" });
    }
}

// 📌 Save Chat Messages to MongoDB
async function saveChatMessage(namespace, sender, text) {
    try {
        let chat = await Chat.findOne({ namespace });

        if (!chat) {
            chat = new Chat({ namespace, messages: [] });
        }

        chat.messages.push({ sender, message: text.trim() });
        await chat.save();
    } catch (error) {
        console.error(`❌ Error saving chat: ${error.message}`);
    }
}

// 📌 Get Chat History from MongoDB
async function getChatHistory(req, res) {
    try {
        const { namespace } = req.params;
        if (!namespace) return res.status(400).json({ error: "Namespace is required" });

        const chat = await Chat.findOne({ namespace });

        if (!chat) {
            return res.json({ namespace, history: [] });
        }

        res.json({ namespace, history: chat.messages });
    } catch (error) {
        console.error("❌ Error fetching chat history:", error);
        res.status(500).json({ error: "Failed to fetch chat history" });
    }
}

module.exports = { uploadPDF, queryNamespace, getNamespaces, deleteNamespace, getChatHistory };