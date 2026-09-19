# 🤖 Coding Instructor AI

A simple and powerful AI-powered coding and DSA instructor built with Node.js and Google Gemini.

---

## 🚀 Features

- **Coding Specialist**: Answers coding and algorithm questions with clear explanations and code examples.
- **Smart Fallback**: Automatically switches Gemini models if free tier limits are reached so it never stops working.
- **Question History**: Saves your recent questions in the browser for easy 1-click access.
- **Modern UI**: Clean, dark-mode interface with syntax-highlighted code.

---

## 🛠️ Tech Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js (native HTTP)
- **AI**: Google Gemini API (`@google/genai`)

---

## 💻 How to Run

### 1. Clone & Install
```bash
git clone https://github.com/shubham6i/Coding-Instructor-.git
cd Coding-Instructor-
npm install
```

### 2. Add API Key
Create a `.env` file in the project root:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```
*(Get a free key from [Google AI Studio](https://aistudio.google.com/app/apikey))*

### 3. Start the Server
```bash
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

*(Optional) To run directly in terminal:*
```bash
npm run cli
```

---

## 📄 License
ISC