const express = require("express");
const multer = require("multer");
const { uploadPDF, queryPDF } = require("../controllers/pdfController");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Use controllers in routes
router.post("/upload", upload.single("pdf"), uploadPDF);
router.post("/query", queryPDF);

module.exports = router;