require("dotenv").config();
const { Pinecone } = require("@pinecone-database/pinecone");

// Initialize Pinecone client
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.index(process.env.PINECONE_INDEX_NAME);

// Function to store embeddings in Pinecone
async function storeEmbeddings(embeddings) {
    try {
        for (const data of embeddings) {
            await index.upsert([
                {
                    id: data.id,
                    values: data.embedding,
                    metadata: { text: data.chunk },
                },
            ]);
        }
        console.log("✅ Embeddings stored in Pinecone successfully!");
    } catch (error) {
        console.error("❌ Error storing embeddings in Pinecone:", error);
    }
}

// Function to query Pinecone
async function queryPinecone(queryEmbedding, topK = 5) {
    try {
        console.log("🔍 Searching Pinecone for relevant text...");
        const searchResults = await index.query({
            vector: queryEmbedding,
            topK: topK,
            includeMetadata: true,
        });

        return searchResults;
    } catch (error) {
        console.error("❌ Error querying Pinecone:", error);
        throw error;
    }
}

module.exports = { storeEmbeddings, queryPinecone };