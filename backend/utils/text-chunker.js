const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");

// ✅ Simplified function (No Page Number Tracking)
async function splitText(pdfData) {
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 100,
    });

    return await splitter.splitText(pdfData.text);
}

module.exports = { splitText };