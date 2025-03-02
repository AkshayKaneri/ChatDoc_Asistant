const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");

// Function to split text into smaller chunks
async function splitText(text) {
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 100,
    });

    return await splitter.splitText(text);
}

module.exports = { splitText };