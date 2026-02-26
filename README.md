# Interview AI Partner - Setup Guide

## Project Overview
This is a full-stack AI interview assistant that uses Gemini API for intelligent question generation and feedback. It features a modern React frontend with Tailwind CSS and a FastAPI backend.

## Project Structure
```
athena/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── requirements.txt      # Python dependencies
│   └── .env                  # Environment variables
└── frontend/
    ├── src/
    │   └── App.jsx           # Main React component
    ├── package.json          # Node dependencies
    ├── tailwind.config.js    # Tailwind configuration
    └── vite.config.js        # Vite configuration
```

## Prerequisites
- Python 3.8+ (for backend)
- Node.js 16+ (for frontend)
- Gemini API Key

## Backend Setup

### 1. Navigate to backend directory
```bash
cd backend
```

### 2. Create virtual environment (optional but recommended)
```bash
python -m venv .venv
.venv\Scripts\activate  # On Windows
source .venv/bin/activate  # On macOS/Linux
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure environment
Create/update `.env` file:
```bash
GEMINI_API_KEY=your_gemini_api_key_here
BACKEND_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173
```

### 5. Run backend server
```bash
python -m uvicorn main:app --port 8000
```

The backend will start at `http://localhost:8000`
- Health check: `http://localhost:8000/api/health`

## Frontend Setup

### 1. Navigate to frontend directory
```bash
cd frontend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run development server
```bash
npm run dev
```

The frontend will start at `http://localhost:5173` (or `5174` if 5173 is in use)

## Backend API Endpoints

### 1. Health Check
- **URL**: `GET /api/health`
- **Response**: Server status and Gemini API configuration

### 2. Start Interview
- **URL**: `POST /api/interview/start`
- **Body**:
```json
{
  "numberOfQuestions": 5
}
```
- **Response**: Welcome message and interview session initialization

### 3. Generate Question
- **URL**: `POST /api/interview/question`
- **Body**:
```json
{
  "conversationHistory": [
    {
      "role": "user",
      "content": "I am a software engineer with 5 years of experience"
    }
  ],
  "questionNumber": 1,
  "userResponse": "Your previous response"
}
```
- **Response**: Next interview question

### 4. Get Feedback
- **URL**: `POST /api/interview/feedback`
- **Body**:
```json
{
  "conversationHistory": [
    {
      "role": "user",
      "content": "User response"
    },
    {
      "role": "assistant",
      "content": "AI response"
    }
  ]
}
```
- **Response**: Comprehensive interview feedback

### 5. Transcribe Audio
- **URL**: `POST /api/transcribe`
- **Content-Type**: multipart/form-data
- **Body**: Audio file (WAV format)
- **Response**: Transcribed text

## Frontend Features

**Modern Chat Interface** - ChatGPT-like UI with Tailwind CSS
**Real-time Chat** - Send and receive messages
**Microphone Input** - Record audio responses
**Video Camera** - Live video feed during interview
**Error Handling** - User-friendly error messages
**Loading States** - Visual feedback during processing
**Responsive Design** - Works on desktop and mobile

## Usage

1. **Start Backend**:
   ```bash
   cd backend
   python -m uvicorn main:app --port 8000
   ```

2. **Start Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

3. **Open Browser**:
   - Visit `http://localhost:5173` (or the port shown in terminal)

4. **Start Interview**:
   - Click "Start Interview" button
   - Enable camera/microphone if desired
   - Answer questions by typing or speaking
   - End interview to receive feedback

## Technologies Used

### Backend
- **FastAPI** - Modern Python web framework
- **Uvicorn** - ASGI server
- **Pydantic** - Data validation
- **Google Genai** - Gemini API integration
- **python-multipart** - File upload handling

### Frontend
- **React** - UI library
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Lucide React** - Icon library

## Environment Variables

### Backend (.env)
```
GEMINI_API_KEY=your_api_key_here
BACKEND_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173
```

## Troubleshooting

### Backend
- **Port 8000 already in use**: Change port with `--port 8001`
- **Import errors**: Ensure all dependencies installed with `pip install -r requirements.txt`
- **Gemini API errors**: Verify API key is correct in `.env`

### Frontend
- **Port 5173 already in use**: Vite will automatically use next available port
- **Module not found**: Run `npm install` to ensure dependencies installed
- **API not responding**: Ensure backend is running on port 8000

## API CORS Configuration

Frontend and backend are configured for CORS communication:
- Frontend: `http://localhost:3000`, `http://localhost:5173`
- Backend: Accepts requests from both localhost URLs

## Database (Future)

Currently, conversations are stored in memory. For production:
- Implement persistent storage with PostgreSQL/MongoDB
- Add user authentication
- Store interview history

## Security Notes

- API key is hardcoded for development only
- Use environment variables in production
- Add authentication middleware for production
- Implement rate limiting
- Add request validation

## Next Steps

1. **Audio Transcription**: Integrate speech-to-text API (Google Cloud Speech-to-Text)
2. **Audio Output**: Add text-to-speech for questions
3. **Database**: Persist conversation history
4. **Authentication**: Add user login/signup
5. **Analytics**: Track interview metrics
6. **Deployment**: Deploy to cloud (Google Cloud, AWS, etc.)

## Support

For issues or questions:
1. Check backend logs: `python -m uvicorn main:app --port 8000`
2. Check browser console: Press F12
3. Verify API endpoints: Visit `http://localhost:8000/api/health`
4. Check network tab in browser developer tools

## License

This project is created for educational purposes.
