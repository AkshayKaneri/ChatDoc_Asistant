const express = require("express");
const multer = require("multer");
const { uploadPDF, queryNamespace, getNamespaces, deleteNamespace, getChatHistory } = require("../controllers/pdfController");
const { queryGlobalChat, getGlobalChatHistory } = require("../controllers/globalChatController");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ✅ Supports multiple file uploads
router.post("/upload", upload.array("pdf", 5), uploadPDF);

// ✅ Query from a namespace
router.post("/query", queryNamespace);

// ✅ fetch list of namespaces
router.get("/namespaces", getNamespaces);

// ✅ delete the namespace
router.delete("/namespaces/delete/:namespace", deleteNamespace);

// 📌 API to Fetch Chat History (NEW)
router.get("/namespaces/history/:namespace", getChatHistory);

// gloabl chat
router.post("/query/global", queryGlobalChat);
router.get("/chat/global/history", getGlobalChatHistory);

module.exports = router;