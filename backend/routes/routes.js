const express = require("express");
const multer = require("multer");
const { uploadPDF, queryNamespace } = require("../controllers/pdfController");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ✅ Supports multiple file uploads
router.post("/upload", upload.array("pdf", 5), uploadPDF);

// ✅ Query from a namespace
router.post("/query", queryNamespace);

module.exports = router;