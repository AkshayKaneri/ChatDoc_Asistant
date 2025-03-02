require("dotenv").config();
const { Pinecone } = require("@pinecone-database/pinecone");

const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY
});
// const index = pc.index('pdf-chatbot');
pc.listIndexes().then((value) => {
    console.log(value)
})
// console.log(pc.listCollections());

