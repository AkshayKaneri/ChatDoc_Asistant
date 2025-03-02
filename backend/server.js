require("dotenv").config();
const express = require("express");
const cors = require("cors");
const routes = require("./routes/routes");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Use routes from routes.js
app.use("/", routes);

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});