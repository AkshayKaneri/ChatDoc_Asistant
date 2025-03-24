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
        let searchResults;
        if (namespace) {
            searchResults = await index.namespace(namespace).query({
                vector: queryEmbedding,
                topK: topK,
                includeMetadata: true,
            });
        }
        else {

            const allNamespaces = ['R26_Hemodialysis_Requirements', 'R25_Hemodialysis_Requirements', 'R25 Requirements', 'R26 Requirements', 'dialysis']; // Or fetch dynamically
            let allMatches = [];

            for (const ns of allNamespaces) {
                const nsResults = await index.namespace(ns).query({
                    vector: queryEmbedding,
                    topK: topK,
                    includeMetadata: true,
                });

                if (nsResults.matches?.length) {
                    allMatches.push(
                        ...nsResults.matches.map(match => ({
                            ...match,
                            namespace: ns
                        }))
                    );
                }
            }
            return {
                matches: allMatches,
                namespace: null
            };
            searchResults = allMatches;
        }
        return searchResults;
    } catch (error) {
        console.error("❌ Error querying Pinecone:", error);
        throw error;
    }
}

// 📌 Get all the namespace from Pinecone
async function getNamespace() {
    try {
        const index = pinecone.index(process.env.PINECONE_INDEX_NAME);
        const stats = await index.describeIndexStats();
        if (!stats || !stats.namespaces) {
            return [];
        }
        return Object.keys(stats.namespaces);
    } catch (error) {
        console.error("❌ Error processing query:", error);
        throw error;
    }
}

// 📌 Delete the Namespace
async function deleteRequestedNameSpace(ns) {
    try {
        const pineconeindex = pinecone.index(process.env.PINECONE_INDEX_NAME);
        await pineconeindex.namespace(ns).deleteAll();
        return true;
    } catch (error) {
        console.error("❌ Error processing query:", error);
        throw error;
    }
}
module.exports = { storeEmbeddings, queryPinecone, getNamespace, deleteRequestedNameSpace };