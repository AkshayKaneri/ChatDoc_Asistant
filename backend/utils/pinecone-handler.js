require("dotenv").config();
const { Pinecone } = require("@pinecone-database/pinecone");

// Initialize Pinecone client
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.index(process.env.PINECONE_INDEX_NAME);

// 📌 Store Embeddings in Pinecone under a Namespace
async function storeEmbeddings(embeddings, namespace) {
    try {
        for (const data of embeddings) {
            await index.namespace(namespace).upsert([
                {
                    id: data.id,
                    values: data.embedding,
                    metadata: {
                        text: data.chunk,
                        pdfName: data.pdfName,  // ✅ Store PDF Name
                        pageNumber: data.pageNumber  // ✅ Store Page Number
                    },
                },
            ]);
        }
        console.log(`✅ Embeddings stored in Pinecone under namespace: '${namespace}'`);
    } catch (error) {
        console.error("❌ Error storing embeddings in Pinecone:", error);
    }
}

// 📌 Query Pinecone Within a Namespace
async function queryPinecone(queryEmbedding, namespace, topK = 10) {
    try {
        console.log(`🔍 Searching Pinecone in namespace '${namespace}'...`);
        const searchResults = await index.namespace(namespace).query({
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