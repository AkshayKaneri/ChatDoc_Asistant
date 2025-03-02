import { extractTextFromPDF } from "../pdf-handler.js";
import { chunkText } from "../utils/text-chunker.js";
import path from "path";

// Test PDF file (Ensure you have a sample PDF in "uploads" folder)
const testPDF = path.join("uploads", "sample.pdf");

(async () => {
    console.log(`🚀 Extracting and Chunking PDF: ${testPDF}`);

    const extractedText = await extractTextFromPDF(testPDF);
    if (!extractedText) {
        console.error("❌ No text extracted! Check your PDF file.");
        return;
    }

    const textChunks = await chunkText(extractedText);
    console.log("\n📜 First 3 Chunks (Preview):", textChunks.slice(0, 3));
})();