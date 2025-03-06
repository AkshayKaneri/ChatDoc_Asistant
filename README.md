# **ChatDoc Assistant - AI-Powered PDF Chatbot**  

[![GitHub repo](https://img.shields.io/badge/GitHub-Repository-blue?logo=github)](https://github.com/AkshayKaneri/ChatDoc_Asistant)  
A full-stack AI-powered chatbot that enables users to upload PDFs, extract knowledge using OpenAI embeddings, and chat with documents seamlessly. Built with **Angular (Frontend), Node.js (Backend), MongoDB (Chat History), and Pinecone (Vector Storage).**  

---

## **🚀 Features**  
✅ **Upload PDFs** – Extract text and store embeddings in Pinecone.  
✅ **Chat with Documents** – AI retrieves relevant document context to generate responses.  
✅ **Persistent Chat History** – Stores conversation logs in MongoDB.  
✅ **Namespace Management** – Organize PDFs into separate chat namespaces.  
✅ **Real-time UI Updates** – Dynamic namespace and chat synchronization.  
✅ **Auto-scroll & UI Enhancements** – Smooth chat experience with typing animation.  

---

## **📦 Tech Stack & Dependencies**  

### **Frontend (Angular)**
- **Angular** – UI framework for frontend.  
- **Bootstrap** – UI components & styling.  
- **RxJS** – For API communication & state management.  
- **TypeScript** – Strongly typed JavaScript.  
- **FormsModule** – Two-way data binding for forms.  

### **Backend (Node.js + Express)**
- **Express.js** – Backend framework.  
- **Multer** – File upload handling.  
- **pdf-parse** – Extract text from PDFs.  
- **OpenAI SDK** – Generate embeddings & AI responses.  
- **Pinecone SDK** – Vector storage & retrieval.  
- **MongoDB + Mongoose** – Store chat history.  
- **Dotenv** – Manage environment variables.  
- **CORS & Body-parser** – Middleware setup.  

---

## **💾 Installation & Setup**  

### **1️⃣ Clone the Repository**
```bash
git clone https://github.com/AkshayKaneri/ChatDoc_Asistant.git
cd ChatDoc_Asistant
```
### **2️⃣ Install Dependencies**
 **Frontend**
```bash
cd frontend
npm install
```
 **Backend**
```bash
cd backend
npm install
```

### **⚙️ Environment Variables**
Before running the app, configure your .env file for the backend.

**🔹Backend .env (Example)**

A sample .env file is already present in the repository. If needed, update your keys.
```bash
PORT=3000
OPENAI_API_KEY=your_openai_api_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=your_index_name
MONGODB_URI=your_mongodb_connection_string
```
Replace your_openai_api_key, your_pinecone_api_key, and your_mongodb_connection_string with your actual API keys.

### **🛠 Running the Application**
1️⃣ Start the Backend
```bash
cd backend
node server.js
```
or using Nodemon (for auto-restart on changes):
```bash
npm run dev
```
2️⃣ Start the Frontend
```bash
cd frontend
ng serve
```
The Angular app will run at http://localhost:4200/.

### **📝 API Endpoints**
| Method  | Endpoint                 | Description                          |
|---------|--------------------------|--------------------------------------|
| **POST**   | `/upload`                | Upload PDFs & generate embeddings   |
| **POST**   | `/query`                 | Query namespace & retrieve answers  |
| **GET**    | `/namespaces`            | Get all available namespaces        |
| **DELETE** | `/namespaces/delete/:ns` | Delete a namespace                  |
| **GET**    | `/chat/history/:ns`      | Fetch chat history for a namespace  |

### **🎯 Future Enhancements**
	•	User Authentication & Roles
	•	More AI Models Support
	•	Better UI/UX Improvements
	•	Cloud Deployment with Docker

## **🛠 Contributors**
	•	[AkshayKaneri](https://github.com/AkshayKaneri)

## **⭐ Support**
If you like this project, feel free to ⭐ star the repository! 🚀
For any issues, open a GitHub issue here.
