const pdfParse = require("pdf-parse");
const { OpenAI } = require("openai");
const { storeEmbeddings, queryPinecone } = require("../utils/pinecone-handler");
const { splitText } = require("../utils/text-chunker");

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
                // Extract filename without extension
                const pdfName = file.originalname.replace(/\.[^/.]+$/, "");

                // Parse the PDF from the file buffer
                const pdfData = await pdfParse(file.buffer);

                if (!pdfData.text.trim()) {
                    console.warn(`⚠️ PDF '${file.originalname}' contains no extractable text. Skipping.`);
                    continue;
                }

                // ✅ Get text chunks (No Page Numbers)
                const textChunks = await splitText(pdfData);
                if (textChunks.length === 0) {
                    console.warn(`⚠️ No meaningful text found in '${file.originalname}'. Skipping.`);
                    continue;
                }

                // Generate embeddings
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
                        pdfName: pdfName, // ✅ Store only PDF name
                    });
                }

                // Store embeddings for this PDF
                allEmbeddings.push(...embeddings);

            } catch (error) {
                console.error(`❌ Error processing file ${file.originalname}:`, error);
            }
        }

        // ✅ Store all embeddings in Pinecone under the namespace
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

// 📌 Query API → Retrieve Relevant Chunks from a Namespace → Generate Answer
async function queryNamespace(req, res) {
    try {
        const { question, namespace } = req.body;
        if (!question || !namespace) return res.status(400).json({ error: "Question and Namespace are required." });

        console.log(`🔍 User asked: "${question}" in namespace: '${namespace}'`);

        // Convert question to embedding
        const response = await openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: question,
        });
        const queryEmbedding = response.data[0].embedding;

        // Query Pinecone in the given namespace
        const searchResults = await queryPinecone(queryEmbedding, namespace, 15);

        if (!searchResults.matches.length) {
            console.log("❌ No relevant chunks found in namespace.");
            return res.json({ answer: "I couldn't find relevant information in this namespace." });
        }

        // Extract retrieved text and PDF name
        let retrievedChunks = searchResults.matches.map(match => ({
            text: match.metadata.text,
            pdfName: match.metadata.pdfName,
            score: match.score
        }));

        // ✅ Step 1: Group results by PDF Name and pick the most relevant one
        const groupedByPDF = retrievedChunks.reduce((acc, chunk) => {
            if (!acc[chunk.pdfName]) acc[chunk.pdfName] = [];
            acc[chunk.pdfName].push(chunk);
            return acc;
        }, {});

        // ✅ Step 2: Pick the highest-ranked PDF
        const sortedPDFs = Object.keys(groupedByPDF).sort((a, b) => {
            const avgScoreA = groupedByPDF[a].reduce((sum, c) => sum + c.score, 0) / groupedByPDF[a].length;
            const avgScoreB = groupedByPDF[b].reduce((sum, c) => sum + c.score, 0) / groupedByPDF[b].length;
            return avgScoreB - avgScoreA;
        });

        const bestPDF = sortedPDFs[0];  // Select the top-ranked PDF
        retrievedChunks = groupedByPDF[bestPDF];  // Use only chunks from the most relevant PDF

        // ✅ Step 3: Format retrieved text for GPT prompt
        const retrievedTextForGPT = retrievedChunks.map(chunk => chunk.text).join("\n\n").slice(0, 6000);

        // ✅ Step 4: Generate response using OpenAI
        console.log("🤖 Generating AI response...");
        const aiResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: "You are an AI assistant. Answer strictly based on the provided text. If the answer is not in the text, respond with 'I don't know'." },
                { role: "user", content: `Based on this text, answer the question: "${question}"\n\nText:\n${retrievedTextForGPT}` },
            ],
        });

        // ✅ Ensure only **one PDF name** is returned
        res.json({
            answer: aiResponse.choices[0].message.content,
            source: { pdfName: bestPDF }  // ✅ Return only the best-matching PDF name
        });

    } catch (error) {
        console.error("❌ Error processing query:", error);
        res.status(500).json({ error: "Failed to process query" });
    }
}

module.exports = { uploadPDF, queryNamespace };