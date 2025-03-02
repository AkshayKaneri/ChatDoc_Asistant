const pdfParse = require("pdf-parse");
const fs = require("fs");
const { OpenAI } = require("openai");
const { storeEmbeddings, queryPinecone } = require("../utils/pinecone-handler");
const { splitText } = require("../utils/text-chunker");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 📌 Upload PDF → Extract Text → Generate Embeddings → Store in Pinecone
async function uploadPDF(req, res) {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const fileBuffer = fs.readFileSync(req.file.path);
        const pdfData = await pdfParse(fileBuffer);
        fs.unlinkSync(req.file.path);

        if (!pdfData.text.trim()) return res.status(400).json({ error: "PDF contains no extractable text." });

        console.log("Extracted PDF Text:", pdfData.text.substring(0, 200));

        // Split extracted text into chunks
        const textChunks = await splitText(pdfData.text);
        if (textChunks.length === 0) return res.status(400).json({ error: "No meaningful text found after splitting." });

        // Generate embeddings for text chunks
        let embeddings = [];
        for (let i = 0; i < textChunks.length; i++) {
            const response = await openai.embeddings.create({
                model: "text-embedding-ada-002",
                input: textChunks[i],
            });
            embeddings.push({
                id: `chunk-${i}`,
                chunk: textChunks[i],
                embedding: response.data[0].embedding,
            });
        }

        // Store embeddings in Pinecone
        await storeEmbeddings(embeddings);

        res.json({ message: "Embeddings stored in Pinecone successfully!" });
    } catch (error) {
        console.error("❌ Error processing PDF:", error);
        res.status(500).json({ error: "Failed to process PDF" });
    }
}

// 📌 Query API → Retrieve Relevant Chunks → Generate Answer
async function queryPDF(req, res) {
    try {
        const { question } = req.body;
        if (!question) return res.status(400).json({ error: "Question is required" });

        console.log(`\n🔍 User asked: ${question}`);

        // Convert query to embedding
        const response = await openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: question,
        });
        const queryEmbedding = response.data[0].embedding;

        // Query Pinecone
        const searchResults = await queryPinecone(queryEmbedding, 5);

        if (!searchResults.matches.length) {
            console.log("❌ No relevant chunks found in Pinecone.");
            return res.json({ answer: "I couldn't find relevant information in the PDF." });
        }

        // Extract retrieved text
        const retrievedTexts = searchResults.matches.map(match => match.metadata.text).join("\n\n");

        // Generate response using OpenAI GPT
        console.log("🤖 Generating AI response...");
        const aiResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: "You are an AI assistant. Answer strictly based on the provided text. If the answer is not in the text, respond with 'I don't know.'" },
                { role: "user", content: `Based on this text, answer the question: "${question}"\n\nText:\n${retrievedTexts}` },
            ],
        });

        res.json({ answer: aiResponse.choices[0].message.content });
    } catch (error) {
        console.error("❌ Error processing query:", error);
        res.status(500).json({ error: "Failed to process query" });
    }
}

module.exports = { uploadPDF, queryPDF };