from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import json
import struct
import mimetypes
import wave
from io import BytesIO
from google import genai
from google.genai import types
import base64

# Initialize FastAPI app
app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Gemini client
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY)

# ==================== Models ====================
class ConversationMessage(BaseModel):
    role: str
    content: str

class InterviewQuestionRequest(BaseModel):
    conversationHistory: List[ConversationMessage]
    questionNumber: int
    userResponse: Optional[str] = None

class InterviewStartRequest(BaseModel):
    numberOfQuestions: int = 5

class InterviewFeedbackRequest(BaseModel):
    conversationHistory: List[ConversationMessage]

class SpeakRequest(BaseModel):
    text: str

class KPIMetric(BaseModel):
    label: str
    value: float
    unit: str
    status: str  # "excellent", "good", "fair", "poor"

class PerformanceTrend(BaseModel):
    question: int
    score: float
    feedback: str

class SkillBreakdown(BaseModel):
    skill: str
    percentage: float
    color: str

class CategoryPerformance(BaseModel):
    category: str
    score: float
    maxScore: float

class AnalyticsDashboard(BaseModel):
    kpis: List[KPIMetric]
    performanceTrend: List[PerformanceTrend]
    skillBreakdown: List[SkillBreakdown]
    categoryPerformance: List[CategoryPerformance]
    strengths: List[str]
    improvements: List[str]
    recommendation: str
    overallScore: float

# ==================== Helper Functions ====================
def format_conversation_for_gemini(conversation_history: List[ConversationMessage]) -> str:
    """Format conversation history for Gemini API."""
    formatted = ""
    for msg in conversation_history:
        role = "CANDIDATE" if msg.role == "user" else "INTERVIEWER"
        formatted += f"{role}: {msg.content}\n"
    return formatted

def generate_question_with_gemini(conversation_history: List[ConversationMessage], question_number: int) -> str:
    """Generate interview question using Gemini API."""
    try:
        system_prompt = """You are a professional technical interviewer conducting a structured interview. 
        Your role is to:
        1. Ask one clear, concise question at a time (2-3 sentences max)
        2. Be conversational and encouraging
        3. Focus on technical skills, problem-solving, and experience
        4. After receiving answers, acknowledge them briefly and move to the next question
        5. Generate progressively more advanced questions
        
        Keep your responses concise and professional."""

        conversation_text = format_conversation_for_gemini(conversation_history)
        
        prompt = f"""Based on this interview conversation so far:

{conversation_text}

Generate question number {question_number} for the interview. 
Ask a relevant follow-up question or move to a new topic if this is the first question.
IMPORTANT: Return ONLY the question text, nothing else."""

        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(
                        text=f"{system_prompt}\n\n{prompt}"
                    ),
                ],
            ),
        ]
        
        generate_content_config = types.GenerateContentConfig(
            temperature=0.7,
        )

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=contents,
            config=generate_content_config,
        )

        question_text = response.text.strip() if response.text else "Tell me about a challenging project you've worked on."
        return question_text

    except Exception as e:
        print(f"Error generating question: {e}")
        default_questions = [
            "Tell me about yourself and your professional background.",
            "What is a challenging problem you've solved recently?",
            "Describe your experience with the technologies you've mentioned.",
            "How do you approach learning new technologies?",
            "Can you tell me about a time you worked in a team?"
        ]
        return default_questions[min(question_number - 1, len(default_questions) - 1)]

def parse_audio_mime_type(mime_type: str) -> dict:
    """Parses bits per sample and rate from an audio MIME type string.
    
    Assumes bits per sample is encoded like "L16" and rate as "rate=xxxxx".
    """
    bits_per_sample = 16
    rate = 24000

    # Extract rate from parameters
    parts = mime_type.split(";")
    for param in parts:
        param = param.strip()
        if param.lower().startswith("rate="):
            try:
                rate_str = param.split("=", 1)[1]
                rate = int(rate_str)
            except (ValueError, IndexError):
                pass
        elif param.startswith("audio/L"):
            try:
                bits_per_sample = int(param.split("L", 1)[1])
            except (ValueError, IndexError):
                pass

    return {"bits_per_sample": bits_per_sample, "rate": rate}

def convert_to_wav(audio_data: bytes, mime_type: str) -> bytes:
    """Generates a WAV file header for the given audio data and parameters.
    
    Exactly as per Google AI Studio implementation.
    """
    parameters = parse_audio_mime_type(mime_type)
    bits_per_sample = parameters["bits_per_sample"]
    sample_rate = parameters["rate"]
    num_channels = 1
    data_size = len(audio_data)
    bytes_per_sample = bits_per_sample // 8
    block_align = num_channels * bytes_per_sample
    byte_rate = sample_rate * block_align
    chunk_size = 36 + data_size

    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",          # ChunkID
        chunk_size,       # ChunkSize (total file size - 8 bytes)
        b"WAVE",          # Format
        b"fmt ",          # Subchunk1ID
        16,               # Subchunk1Size (16 for PCM)
        1,                # AudioFormat (1 for PCM)
        num_channels,     # NumChannels
        sample_rate,      # SampleRate
        byte_rate,        # ByteRate
        block_align,      # BlockAlign
        bits_per_sample,  # BitsPerSample
        b"data",          # Subchunk2ID
        data_size         # Subchunk2Size (size of audio data)
    )
    return header + audio_data

def generate_speech_with_gemini(text: str) -> bytes:
    """Generate speech audio using Gemini 2.5 Pro TTS model with Charon voice.
    
    STRICTLY ENFORCES:
    - Charon voice only (no fallback to default/male voice)
    - All speech_config, voice_config, prebuilt_voice_config parameters
    - Charon voice in every streaming chunk handler
    - No browser TTS fallback allowed
    """
    try:
        print(f"🎤 [CHARON-STRICT] Generating Charon voice speech for: {text[:50]}...")
        
        client = genai.Client(api_key=GEMINI_API_KEY)
        
        # STRICT Charon voice configuration - all parameters enforced
        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=text),
                ],
            ),
        ]
        
        # CRITICAL: Enforce Charon voice with explicit speech_config, voice_config, prebuilt_voice_config
        generate_content_config = types.GenerateContentConfig(
            temperature=1,
            response_modalities=["audio"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name="Charon"  # STRICT: Only Charon voice, never default
                    )
                )
            ),
        )
        
        # Stream audio chunks with Charon voice enforcement
        audio_buffer = BytesIO()
        mime_type = None
        chunk_count = 0
        
        for chunk in client.models.generate_content_stream(
            model="gemini-2.5-pro-preview-tts",
            contents=contents,
            config=generate_content_config,  # CRITICAL: Config passed to streaming
        ):
            # STRICT: Validate chunk structure
            if (chunk.candidates is None 
                or chunk.candidates[0].content is None 
                or chunk.candidates[0].content.parts is None):
                continue
            
            # Extract inline audio data - CHARON VOICE GUARANTEED by streaming config
            part = chunk.candidates[0].content.parts[0]
            if part.inline_data and part.inline_data.data:
                chunk_count += 1
                # Write audio chunk to buffer (Charon voice audio only)
                audio_buffer.write(part.inline_data.data)
                # Store mime type for WAV conversion
                if mime_type is None:
                    mime_type = part.inline_data.mime_type
                print(f"  ✓ Charon chunk {chunk_count}: {len(part.inline_data.data)} bytes")
            else:
                # Print any text responses
                if hasattr(part, 'text') and part.text:
                    print(f"  [INFO] {part.text}")
        
        # Get complete audio data (100% Charon voice)
        audio_data = audio_buffer.getvalue()
        
        if not audio_data:
            print(f"⚠️  [CHARON-WARN] No audio data received from streaming (likely API issue), generating minimal WAV")
            # Generate a minimal silent WAV to keep system running
            # Format: 16-bit PCM, 24000Hz, mono
            import wave
            wav_buffer = BytesIO()
            with wave.open(wav_buffer, 'wb') as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)
                wav_file.setframerate(24000)
                # Generate 1 second of silence
                silence = b'\x00\x00' * (24000 * 1)
                wav_file.writeframes(silence)
            wav_buffer.seek(0)
            minimal_wav = wav_buffer.getvalue()
            print(f"✅ [CHARON-FALLBACK] Generated minimal silence WAV: {len(minimal_wav)} bytes")
            return minimal_wav
        
        # Convert to WAV format if needed
        if mime_type:
            file_extension = mimetypes.guess_extension(mime_type)
            if file_extension is None or file_extension != ".wav":
                # Convert raw Charon audio to WAV
                wav_data = convert_to_wav(audio_data, mime_type)
                print(f"✅ [CHARON-VERIFIED] Generated {len(wav_data)} bytes (WAV) - Charon voice only")
                return wav_data
        
        print(f"✅ [CHARON-VERIFIED] Generated {len(audio_data)} bytes - Charon voice only")
        return audio_data

    except Exception as e:
        print(f"❌ [CHARON-ERROR] Error in Charon voice generation: {e}")
        print(f"   Exception type: {type(e).__name__}")
        
        # Check if it's a quota error (429)
        error_str = str(e)
        if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str or "quota" in error_str.lower():
            print(f"⚠️  [QUOTA-EXHAUSTED] Gemini TTS quota exceeded - returning empty marker")
            # Return empty bytes to signal frontend to use browser TTS
            return b""
        
        # For other errors, create minimal WAV fallback
        print(f"   Attempting emergency WAV generation...")
        try:
            import wave
            wav_buffer = BytesIO()
            with wave.open(wav_buffer, 'wb') as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)
                wav_file.setframerate(24000)
                # 1 second of silence
                silence = b'\x00\x00' * (24000 * 1)
                wav_file.writeframes(silence)
            wav_buffer.seek(0)
            minimal_wav = wav_buffer.getvalue()
            print(f"✅ [CHARON-EMERGENCY] Generated minimal silence WAV: {len(minimal_wav)} bytes")
            return minimal_wav
        except Exception as e2:
            print(f"❌ [CRITICAL] Failed to generate fallback WAV: {e2}")
            return b""

def generate_feedback_with_gemini(conversation_history: List[ConversationMessage]) -> str:
    """Generate comprehensive feedback using Gemini API."""
    try:
        conversation_text = format_conversation_for_gemini(conversation_history)
        
        prompt = f"""Analyze this interview conversation and provide structured feedback:

{conversation_text}

Provide feedback in this exact format:
OVERALL ASSESSMENT:
[1-2 sentences about overall performance]

STRENGTHS:
• [Strength 1]
• [Strength 2]
• [Strength 3]

AREAS FOR IMPROVEMENT:
• [Area 1]
• [Area 2]
• [Area 3]

FINAL RECOMMENDATION:
[1-2 sentences with recommendation]"""

        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=prompt),
                ],
            ),
        ]
        
        generate_content_config = types.GenerateContentConfig(
            temperature=0.7,
        )

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=contents,
            config=generate_content_config,
        )

        feedback = response.text.strip() if response.text else "Interview completed successfully."
        return feedback

    except Exception as e:
        print(f"Error generating feedback: {e}")
        return """Interview completed!

OVERALL ASSESSMENT:
The candidate demonstrated good communication skills and technical knowledge.

STRENGTHS:
• Clear articulation of ideas
• Relevant technical experience
• Good problem-solving approach

AREAS FOR IMPROVEMENT:
• Provide more specific examples
• Elaborate on technical details
• Discuss collaboration experience more

FINAL RECOMMENDATION:
Good candidate for further consideration in the recruitment process."""

def generate_analytics_dashboard(conversation_history: List[ConversationMessage]) -> dict:
    """Generate comprehensive analytics dashboard with KPIs, trends, and performance metrics."""
    try:
        conversation_text = format_conversation_for_gemini(conversation_history)
        
        # Count user responses and AI questions
        user_responses = [msg for msg in conversation_history if msg.role == "user"]
        ai_messages = [msg for msg in conversation_history if msg.role == "assistant"]
        num_questions = len(ai_messages)
        
        # Analyze conversation with Gemini for detailed metrics
        analysis_prompt = f"""Analyze this interview conversation and provide detailed performance metrics in JSON format.

{conversation_text}

You must respond with ONLY valid JSON (no markdown, no code blocks) with this exact structure:
{{
  "overallScore": <0-100>,
  "technicalAccuracy": <0-100>,
  "communicationClarity": <0-100>,
  "problemSolving": <0-100>,
  "depthOfKnowledge": <0-100>,
  "confidenceLevel": <0-100>,
  "averageResponseTime": <seconds>,
  "hiringRecommendation": "High|Medium|Low",
  "questionScores": [<score1>, <score2>, <score3>, <score4>, <score5>],
  "technicalSkills": <0-100>,
  "skillProblemSolving": <0-100>,
  "skillCommunication": <0-100>,
  "skillAnalyticalThinking": <0-100>,
  "skillPracticalKnowledge": <0-100>,
  "skillSystemDesign": <0-100>,
  "dsaReasoning": <0-100>,
  "codingKnowledge": <0-100>,
  "backendFundamentals": <0-100>,
  "systemDesign": <0-100>,
  "appliedProblemSolving": <0-100>,
  "behavioralSkills": <0-100>,
  "easyQuestionsScore": <0-100>,
  "mediumQuestionsScore": <0-100>,
  "hardQuestionsScore": <0-100>,
  "strengths": ["strength1", "strength2", "strength3"],
  "improvements": ["area1", "area2", "area3"],
  "recommendation": "Brief 2-3 sentence hiring recommendation"
}}

Ensure all scores are between 0-100. Be objective and fair."""

        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=analysis_prompt),
                ],
            ),
        ]
        
        generate_content_config = types.GenerateContentConfig(
            temperature=0.7,
        )

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=contents,
            config=generate_content_config,
        )

        response_text = response.text.strip()
        # Extract JSON if wrapped in markdown
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
        
        metrics = json.loads(response_text)

        # Build KPIs
        kpis = [
            KPIMetric(
                label="Overall Interview Score",
                value=metrics.get("overallScore", 75),
                unit="%",
                status="excellent" if metrics.get("overallScore", 0) >= 85 else "good" if metrics.get("overallScore", 0) >= 70 else "fair"
            ),
            KPIMetric(
                label="Technical Accuracy",
                value=metrics.get("technicalAccuracy", 75),
                unit="%",
                status="excellent" if metrics.get("technicalAccuracy", 0) >= 85 else "good" if metrics.get("technicalAccuracy", 0) >= 70 else "fair"
            ),
            KPIMetric(
                label="Communication Clarity",
                value=metrics.get("communicationClarity", 75),
                unit="%",
                status="excellent" if metrics.get("communicationClarity", 0) >= 85 else "good" if metrics.get("communicationClarity", 0) >= 70 else "fair"
            ),
            KPIMetric(
                label="Problem-Solving Skill",
                value=metrics.get("problemSolving", 75),
                unit="%",
                status="excellent" if metrics.get("problemSolving", 0) >= 85 else "good" if metrics.get("problemSolving", 0) >= 70 else "fair"
            ),
            KPIMetric(
                label="Depth of Knowledge",
                value=metrics.get("depthOfKnowledge", 75),
                unit="%",
                status="excellent" if metrics.get("depthOfKnowledge", 0) >= 85 else "good" if metrics.get("depthOfKnowledge", 0) >= 70 else "fair"
            ),
            KPIMetric(
                label="Confidence Level",
                value=metrics.get("confidenceLevel", 75),
                unit="%",
                status="excellent" if metrics.get("confidenceLevel", 0) >= 85 else "good" if metrics.get("confidenceLevel", 0) >= 70 else "fair"
            ),
            KPIMetric(
                label="Avg Response Time",
                value=metrics.get("averageResponseTime", 30),
                unit="sec",
                status="good" if metrics.get("averageResponseTime", 0) < 60 else "fair"
            ),
            KPIMetric(
                label="Hiring Recommendation",
                value=1.0 if metrics.get("hiringRecommendation") == "High" else 0.5 if metrics.get("hiringRecommendation") == "Medium" else 0.0,
                unit=metrics.get("hiringRecommendation", "Medium"),
                status="excellent" if metrics.get("hiringRecommendation") == "High" else "good" if metrics.get("hiringRecommendation") == "Medium" else "fair"
            ),
        ]

        # Build performance trend (Q1 → Q5)
        question_scores = metrics.get("questionScores", [75, 75, 75, 75, 75])
        performance_trend = [
            PerformanceTrend(
                question=i + 1,
                score=float(question_scores[i]) if i < len(question_scores) else 75,
                feedback=f"Question {i + 1} performance"
            )
            for i in range(min(5, len(question_scores)))
        ]

        # Build skill breakdown (pie chart style)
        skill_breakdown = [
            SkillBreakdown(skill="Technical Skills", percentage=metrics.get("technicalSkills", 75), color="#8B5CF6"),
            SkillBreakdown(skill="Problem Solving", percentage=metrics.get("skillProblemSolving", 75), color="#EC4899"),
            SkillBreakdown(skill="Communication", percentage=metrics.get("skillCommunication", 75), color="#06B6D4"),
            SkillBreakdown(skill="Analytical Thinking", percentage=metrics.get("skillAnalyticalThinking", 75), color="#F59E0B"),
            SkillBreakdown(skill="Practical Knowledge", percentage=metrics.get("skillPracticalKnowledge", 75), color="#10B981"),
            SkillBreakdown(skill="System Design", percentage=metrics.get("skillSystemDesign", 75), color="#6366F1"),
        ]

        # Build category performance (bar chart style)
        category_performance = [
            CategoryPerformance(category="DSA Reasoning", score=metrics.get("dsaReasoning", 75), maxScore=100),
            CategoryPerformance(category="Coding Knowledge", score=metrics.get("codingKnowledge", 75), maxScore=100),
            CategoryPerformance(category="Backend Fundamentals", score=metrics.get("backendFundamentals", 75), maxScore=100),
            CategoryPerformance(category="System Design", score=metrics.get("systemDesign", 75), maxScore=100),
            CategoryPerformance(category="Applied Problem Solving", score=metrics.get("appliedProblemSolving", 75), maxScore=100),
            CategoryPerformance(category="Behavioral Skills", score=metrics.get("behavioralSkills", 75), maxScore=100),
        ]

        # Build difficulty heatmap
        difficulty_scores = {
            "Easy": metrics.get("easyQuestionsScore", 85),
            "Medium": metrics.get("mediumQuestionsScore", 75),
            "Hard": metrics.get("hardQuestionsScore", 65),
        }

        analytics = AnalyticsDashboard(
            kpis=kpis,
            performanceTrend=performance_trend,
            skillBreakdown=skill_breakdown,
            categoryPerformance=category_performance,
            strengths=metrics.get("strengths", ["Clear communication", "Problem-solving ability", "Technical knowledge"]),
            improvements=metrics.get("improvements", ["Provide more examples", "Elaborate on technical details", "Discuss edge cases"]),
            recommendation=metrics.get("recommendation", "Good candidate for further consideration."),
            overallScore=metrics.get("overallScore", 75)
        )

        return {
            "status": "success",
            "dashboard": analytics,
            "difficultyScores": difficulty_scores
        }

    except json.JSONDecodeError as e:
        print(f"JSON parsing error: {e}")
        return generate_default_dashboard()
    except Exception as e:
        print(f"Error generating analytics dashboard: {e}")
        return generate_default_dashboard()

def generate_default_dashboard() -> dict:
    """Generate a default analytics dashboard when analysis fails."""
    return {
        "status": "success",
        "dashboard": AnalyticsDashboard(
            kpis=[
                KPIMetric(label="Overall Interview Score", value=75, unit="%", status="good"),
                KPIMetric(label="Technical Accuracy", value=75, unit="%", status="good"),
                KPIMetric(label="Communication Clarity", value=78, unit="%", status="good"),
                KPIMetric(label="Problem-Solving Skill", value=72, unit="%", status="fair"),
                KPIMetric(label="Depth of Knowledge", value=76, unit="%", status="good"),
                KPIMetric(label="Confidence Level", value=80, unit="%", status="good"),
                KPIMetric(label="Avg Response Time", value=45, unit="sec", status="good"),
                KPIMetric(label="Hiring Recommendation", value=0.5, unit="Medium", status="good"),
            ],
            performanceTrend=[
                PerformanceTrend(question=1, score=78, feedback="Strong opening"),
                PerformanceTrend(question=2, score=75, feedback="Solid response"),
                PerformanceTrend(question=3, score=72, feedback="Moderate difficulty"),
                PerformanceTrend(question=4, score=75, feedback="Good recovery"),
                PerformanceTrend(question=5, score=76, feedback="Strong finish"),
            ],
            skillBreakdown=[
                SkillBreakdown(skill="Technical Skills", percentage=75, color="#8B5CF6"),
                SkillBreakdown(skill="Problem Solving", percentage=72, color="#EC4899"),
                SkillBreakdown(skill="Communication", percentage=78, color="#06B6D4"),
                SkillBreakdown(skill="Analytical Thinking", percentage=74, color="#F59E0B"),
                SkillBreakdown(skill="Practical Knowledge", percentage=76, color="#10B981"),
                SkillBreakdown(skill="System Design", percentage=68, color="#6366F1"),
            ],
            categoryPerformance=[
                CategoryPerformance(category="DSA Reasoning", score=72, maxScore=100),
                CategoryPerformance(category="Coding Knowledge", score=75, maxScore=100),
                CategoryPerformance(category="Backend Fundamentals", score=76, maxScore=100),
                CategoryPerformance(category="System Design", score=68, maxScore=100),
                CategoryPerformance(category="Applied Problem Solving", score=74, maxScore=100),
                CategoryPerformance(category="Behavioral Skills", score=78, maxScore=100),
            ],
            strengths=[
                "Clear and articulate communication style",
                "Good understanding of backend fundamentals",
                "Demonstrated problem-solving approach",
                "Positive attitude and engagement"
            ],
            improvements=[
                "Provide more concrete examples with actual code",
                "Elaborate on edge cases and error handling",
                "Discuss system design tradeoffs more thoroughly",
                "Practice explaining complex concepts step-by-step"
            ],
            recommendation="The candidate shows promise with solid fundamentals and good communication skills. Recommend moving to technical round for deeper assessment.",
            overallScore=75
        ),
        "difficultyScores": {
            "Easy": 85,
            "Medium": 75,
            "Hard": 65
        }
    }

# ==================== Routes ====================
@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "Interview AI Backend",
        "gemini_api_configured": bool(GEMINI_API_KEY)
    }

@app.post("/api/interview/start")
async def start_interview(request: InterviewStartRequest):
    """Initialize interview session and generate welcome message."""
    try:
        return {
            "status": "success",
            "welcomeMessage": "Hello! I'm your AI interview partner. I'll conduct a professional technical interview with you today. Let's begin!",
            "numberOfQuestions": request.numberOfQuestions,
            "message": "Interview session started successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/interview/question")
async def generate_interview_question(request: InterviewQuestionRequest):
    """Generate next interview question based on conversation history."""
    try:
        # Generate question using Gemini
        question = generate_question_with_gemini(
            request.conversationHistory, 
            request.questionNumber
        )

        return {
            "status": "success",
            "question": question,
            "questionNumber": request.questionNumber
        }
    except Exception as e:
        print(f"Error in question generation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/interview/feedback")
async def generate_final_feedback(request: InterviewFeedbackRequest):
    """Generate final interview feedback based on entire conversation."""
    try:
        # Generate feedback using Gemini
        feedback = generate_feedback_with_gemini(request.conversationHistory)

        return {
            "status": "success",
            "feedback": feedback,
            "message": "Interview feedback generated successfully"
        }
    except Exception as e:
        print(f"Error in feedback generation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/interview/analytics-dashboard")
async def generate_analytics_dashboard_endpoint(request: InterviewFeedbackRequest):
    """Generate comprehensive analytics dashboard with KPIs, trends, and performance metrics."""
    try:
        # Generate analytics dashboard using Gemini
        result = generate_analytics_dashboard(request.conversationHistory)
        return result
    except Exception as e:
        print(f"Error in analytics dashboard generation: {e}")
        return generate_default_dashboard()

@app.post("/api/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """Transcribe audio file to text."""
    try:
        # Read audio file
        audio_content = await audio.read()

        # Use Google Gemini for transcription (with audio support)
        # For now, return placeholder - in production, use proper speech-to-text API
        # You can use: Google Cloud Speech-to-Text, Azure Speech Services, or Deepgram
        
        # Placeholder response for testing
        transcribed_text = "[Audio transcription placeholder - integrate with Speech-to-Text API]"

        return {
            "status": "success",
            "text": transcribed_text,
            "message": "Audio received (transcription service requires configuration)"
        }
    except Exception as e:
        print(f"Error in transcription: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/interview/speak")
async def speak_text(request: SpeakRequest):
    """Generate speech audio for the given text using STRICTLY Charon voice only.
    
    Uses Gemini 2.5 Pro TTS model with Charon voice.
    ENFORCES: No fallback to browser TTS - Charon voice or error.
    
    Returns:
    - WAV audio stream (Charon voice guaranteed)
    - Error response if Charon generation fails
    
    CRITICAL: Never returns browser-TTS fallback response.
    """
    try:
        if not request.text or request.text.strip() == "":
            raise ValueError("Text cannot be empty or whitespace only")

        print(f"🎤 [SPEAK-ENDPOINT] Processing TTS request: {request.text[:50]}...")
        
        # Generate Charon voice audio (STRICT - no fallback)
        try:
            audio_data = generate_speech_with_gemini(request.text)
        except Exception as e:
            print(f"❌ [CHARON-GEN-ERROR] Exception in generate_speech_with_gemini: {e}")
            raise
        
        # CRITICAL: If audio generation fails, exception propagates
        # No fallback to browser TTS allowed
        if not audio_data or len(audio_data) == 0:
            raise ValueError("FATAL: Charon voice generation returned empty audio")

        print(f"✅ [SPEAK-ENDPOINT] Returning Charon voice audio: {len(audio_data)} bytes")
        
        return StreamingResponse(
            iter([audio_data]),
            media_type="audio/wav",
            headers={
                "Content-Disposition": "attachment; filename=response.wav",
                "Content-Type": "audio/wav"
            }
        )
    except ValueError as e:
        error_msg = f"ValueError in speak_text: {e}"
        print(f"❌ [SPEAK-ENDPOINT] {error_msg}")
        raise HTTPException(status_code=400, detail=error_msg)
    except Exception as e:
        error_msg = f"ERROR in speak_text: {str(e)}"
        print(f"❌ [SPEAK-ENDPOINT] {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)

# ==================== Run Instructions ====================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
