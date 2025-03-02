import { extractTextFromPDF } from "../pdf-handler.js";
import path from "path";

// Test PDF file (Ensure you have a sample PDF in "uploads" folder)
const testPDF = path.join("uploads", "sample.pdf");

(async () => {
    console.log(`🚀 Testing PDF Extraction on: ${testPDF}`);
    const extractedDocs = await extractTextFromPDF(testPDF);

    console.log("\n📜 Extracted Text:");
    console.log(extractedDocs);
})();