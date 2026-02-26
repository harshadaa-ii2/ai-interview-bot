import { useState, useRef, useEffect } from 'react'
import { MessageCircle, Mic, MicOff, Video, VideoOff, Send, Phone, PhoneOff, AlertCircle, Volume2, VolumeX } from 'lucide-react'
import UserSetup from './UserSetup'
import AnalyticsDashboard from './AnalyticsDashboard'


function App() {
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isVideoOn, setIsVideoOn] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [interviewActive, setInterviewActive] = useState(false)
  const [questionCount, setQuestionCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isSpeechEnabled] = useState(true) // Always on
  const [isListening, setIsListening] = useState(false)
  const [isSTTSupported, setIsSTTSupported] = useState(true)
  const [userInfo, setUserInfo] = useState(null)
  const [lastAIQuestion, setLastAIQuestion] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [lastPlayedId, setLastPlayedId] = useState(null)
  const [analyticsDashboard, setAnalyticsDashboard] = useState(null)
  const [difficultyScores, setDifficultyScores] = useState(null)
  const messagesEndRef = useRef(null)
  const videoRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const recognitionRef = useRef(null)
  const audioRef = useRef(null)
  const audioContextRef = useRef(null)
  const [audioUnlocked, setAudioUnlocked] = useState(false)

  const API_BASE_URL = 'http://localhost:8000/api'

  // Initialize Web Speech API
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setIsSTTSupported(false)
      setError('Speech-to-Text is not supported in this browser. Please use Chrome or Edge.')
      return
    }
    setIsSTTSupported(true)
    recognitionRef.current = new SpeechRecognition()
    recognitionRef.current.continuous = false
    recognitionRef.current.interimResults = true
    recognitionRef.current.language = 'en-US'

    recognitionRef.current.onstart = () => {
      setIsListening(true)
      setError(null)
    }

    recognitionRef.current.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error)
      if (event.error === 'not-allowed' || event.error === 'denied') {
        setError('Microphone access denied. Please allow mic permission in your browser.')
      } else if (event.error !== 'network') {
        setError(`Speech recognition error: ${event.error}`)
      }
      setIsListening(false)
    }

    recognitionRef.current.onresult = (event) => {
      let interimTranscript = ''
      let finalTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' '
        } else {
          interimTranscript += transcript
        }
      }
      if (interimTranscript || finalTranscript) {
        setInputValue(interimTranscript + finalTranscript)
      }
      // Do NOT auto-send - let user click Send to complete their answer
    }
  }, [])

  // Initialize AudioContext for robust playback and autoplay unlocking
  useEffect(() => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (AudioCtx) {
        audioContextRef.current = new AudioCtx()
       
      }
    } catch (err) {
      console.warn('AudioContext not available:', err)
    }
  }, [])

  const unlockAudio = async () => {
    try {
      if (!audioContextRef.current) return
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume()
      }
      // Play a tiny silent buffer to unlock audio on some browsers
      const ctx = audioContextRef.current
      const buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.connect(ctx.destination)
      src.start(0)
      setAudioUnlocked(true)
     
    } catch (err) {
      console.warn('Failed to unlock audio:', err)
    }
  }

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Handle video stream
  useEffect(() => {
    if (isVideoOn) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(stream => {
          streamRef.current = stream
          if (videoRef.current) {
            videoRef.current.srcObject = stream
          }
        })
        .catch(err => {
          console.error('Video access denied:', err)
          setError('Camera access denied')
          setIsVideoOn(false)
        })
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [isVideoOn])

  // Handle microphone input
  const startMicRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      const audioChunks = []

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' })
        const text = await transcribeAudio(audioBlob)
        if (text) {
          sendMessage(text)
        }
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setError(null)
    } catch (err) {
      console.error('Microphone access denied:', err)
      setError('Microphone access denied. Please check your permissions.')
      setIsMicOn(false)
    }
  }

  const stopMicRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const startSpeechRecognition = () => {
    if (recognitionRef.current && !isListening) {
      try {
        setInputValue('')
        recognitionRef.current.start()
      } catch (err) {
        console.error('Error starting recognition:', err)
        setError('Failed to start speech recognition')
      }
    }
  }

  const stopSpeechRecognition = () => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop()
      } catch (err) {
        
      }
    }
  }

  const playAudioMessage = async (text, messageId) => {
    try {
     
      
      // Stop any currently playing speech or audio
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
      
      // Request audio from backend
      const response = await fetch(`${API_BASE_URL}/interview/speak`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text })
      })

      if (!response.ok) {
        throw new Error(`Server error (${response.status})`)
      }

      const contentType = response.headers.get('content-type')
      
      // If response is empty or not audio, use browser TTS
      if (!contentType || !contentType.includes('audio')) {

        useBrowserTTS(text)
        return
      }
      
      const blob = await response.blob()
      if (blob.size === 0) {
     
        useBrowserTTS(text)
        return
      }
      

      
      const url = URL.createObjectURL(blob)
      
      if (audioRef.current) {
        // Ensure crossOrigin for blob URLs when needed
        try { audioRef.current.crossOrigin = 'anonymous' } catch (e) {}
        audioRef.current.src = url
       
        audioRef.current.onended = () => {
    
          setLoading(false)
        }
        audioRef.current.onerror = (err) => {

          useBrowserTTS(text)
        }

        const playPromise = audioRef.current.play()

        if (playPromise !== undefined) {
          playPromise.catch(async (err) => {
          
            try {
              // Try playing through AudioContext decode as a stronger fallback
              if (audioContextRef.current) {
                const ctx = audioContextRef.current
                if (ctx.state === 'suspended') await ctx.resume()
                const arrayBuffer = await blob.arrayBuffer()
                const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0))
                const srcNode = ctx.createBufferSource()
                srcNode.buffer = audioBuffer
                srcNode.connect(ctx.destination)
                srcNode.onended = () => {

                  setLoading(false)
                }
                srcNode.start(0)
                return
              }
            } catch (e2) {
             
            }
            // Final fallback to browser TTS
            useBrowserTTS(text)
          })
        }
      }
    } catch (err) {

      useBrowserTTS(text)
    }
  }

  // Browser TTS fallback when Gemini quota exhausted
  const useBrowserTTS = (text) => {
    try {
      if ('speechSynthesis' in window) {
        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current.currentTime = 0
        }
        
        window.speechSynthesis.cancel()
        
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.rate = 0.9
        utterance.pitch = 1.0
        utterance.volume = 1.0
        utterance.lang = 'en-US'
        
        utterance.onend = () => {
        
          setLoading(false)
        }
        
        utterance.onerror = (err) => {
         
          setLoading(false)
        }
        
        
        window.speechSynthesis.speak(utterance)
      }
    } catch (err) {

      setLoading(false)
    }
  }

  const transcribeAudio = async (audioBlob) => {
    try {
      setLoading(true)
      const formData = new FormData()
      formData.append('audio', audioBlob)

      const response = await fetch(`${API_BASE_URL}/transcribe`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Transcription failed')
      }

      const data = await response.json()
      return data.text || null
    } catch (err) {
      console.error('Transcription error:', err)
      setError('Failed to transcribe audio. Please try again.')
      return null
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = (text) => {
    // STRICT: Block on any empty or whitespace input
    if (!text || text.trim() === '') {
    
      setError('Cannot send empty response. Please answer the question.')
      return
    }

    ('📨 [SEND] Processing user message:', text.substring(0, 50), '...')
    
    const userMessage = {
      id: `user-${Date.now()}-${Math.random()}`,
      text: text.trim(),  // Use trimmed version
      sender: 'user',
      timestamp: new Date()
    }
    
    setMessages(prev => [...prev, userMessage])
    setInputValue('')  // Clear input immediately
    setError(null)  // Clear any previous errors

   
    // BLOCKING: generateAIResponse will hold control until next question generated
    generateAIResponse(text.trim())
  }

  const generateAIResponse = async (userText) => {
    try {
      setLoading(true)  // BLOCK: Set loading FIRST to prevent any input
      

      // Add loading message with unique ID
      const loadingId = `loading-${Date.now()}-${Math.random()}`
      const aiLoadingMessage = {
        id: loadingId,
        text: "Thinking...",
        sender: 'ai',
        timestamp: new Date(),
        isLoading: true
      }
      setMessages(prev => [...prev, aiLoadingMessage])

      const conversationHistory = messages.map(msg => ({
        role: msg.sender === 'ai' ? 'assistant' : 'user',
        content: msg.text
      }))

     
      const response = await fetch(`${API_BASE_URL}/interview/question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationHistory: conversationHistory,
          questionNumber: questionCount + 1,
          userResponse: userText,
          userInfo // send user info for context
        })
      })

      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}: Failed to generate response`)
      }

      const data = await response.json()
      const aiText = data.question || data.response || 'No response received'
      const questionId = `question-${Date.now()}-${Math.random()}`

      

      // Replace loading message with actual question (same ID)
      setMessages(prev => {
        const updated = [...prev]
        const lastIndex = updated.length - 1
        updated[lastIndex] = {
          id: questionId,
          text: aiText,
          sender: 'ai',
          timestamp: new Date(),
          isLoading: false
        }
        return updated
      })

      setQuestionCount(prev => prev + 1)
      setError(null)
      
      // CRITICAL: Keep loading=true until Charon voice finishes playing
      // Mark this question as ready for TTS (useEffect will trigger it)
      setLastPlayedId(null)  // Reset so new question triggers TTS
     
      
    } catch (err) {
      
      setError(`Error: ${err.message}. Please check backend logs.`)
      
      // Replace loading message with error (same ID)
      setMessages(prev => {
        const updated = [...prev]
        const lastIndex = updated.length - 1
        updated[lastIndex] = {
          id: `error-${Date.now()}-${Math.random()}`,
          text: "Sorry, I encountered an error. Please try again.",
          sender: 'ai',
          timestamp: new Date(),
          isLoading: false
        }
        return updated
      })
    } finally {
      // CRITICAL: Only unblock after Charon voice finishes (tracked by lastPlayedId)
      // See useEffect that monitors audio playback completion
   
      setLoading(false)
    }
  }

  const handleSendMessage = (e) => {
    e.preventDefault()
    
    // STRICT INPUT VALIDATION - NO AUTO-ADVANCE ON EMPTY INPUT
    const trimmedInput = inputValue.trim()
    
    if (trimmedInput === '') {
     
      setError('Please provide an answer before continuing. Your response cannot be empty.')
      return
    }
    
    if (loading) {
    
      return
    }
    
  
    sendMessage(trimmedInput)
  }

  const startInterview = async () => {
    try {
      setLoading(true)
      setError(null)
      setLastPlayedId(null)
      setLastAIQuestion('')

      const response = await fetch(`${API_BASE_URL}/interview/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          numberOfQuestions: 5
        })
      })

      if (!response.ok) {
        throw new Error('Failed to start interview')
      }

      const data = await response.json()

      setInterviewActive(true)
      setMessages([])
      setQuestionCount(0)

      const welcomeMessage = {
        id: `welcome-${Date.now()}`,
        text: data.welcomeMessage || "Hello! I'm your AI interview partner. Let's begin the interview. Please answer each question thoughtfully.",
        sender: 'ai',
        timestamp: new Date()
      }

      setMessages([welcomeMessage])

      // Get first question
      const firstQuestionResponse = await fetch(`${API_BASE_URL}/interview/question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationHistory: [],
          questionNumber: 1,
          userResponse: null
        })
      })

      if (firstQuestionResponse.ok) {
        const firstQuestionData = await firstQuestionResponse.json()
        const questionId = `first-question-${Date.now()}-${Math.random()}`
        const firstQuestionMessage = {
          id: questionId,
          text: firstQuestionData.question || "Tell me about yourself?",
          sender: 'ai',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, firstQuestionMessage])
        setQuestionCount(1)

        // Ensure audio is unlocked (user gesture) before attempting playback
        try {
          await unlockAudio()
          // audioRef crossOrigin set when playing; leave playback to useEffect
         
        } catch (e) {
       
        }
      }
  } catch (err) {
   
    setError('Failed to start interview. Please check if the backend is running.')
    setInterviewActive(false)
  } finally {
    setLoading(false)
  }
}

const endInterview = async () => {
  try {
    setLoading(true)

    const conversationHistory = messages.map(msg => ({
      role: msg.sender === 'ai' ? 'assistant' : 'user',
      content: msg.text
    }))

    // First get traditional feedback
    const feedbackResponse = await fetch(`${API_BASE_URL}/interview/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversationHistory: conversationHistory,
        userInfo
      })
    })

    if (feedbackResponse.ok) {
      const feedbackData = await feedbackResponse.json()
      setFeedback(feedbackData.feedback || 'Interview completed! Thank you for your participation.')
    }

    // Then get analytics dashboard
    const analyticsResponse = await fetch(`${API_BASE_URL}/interview/analytics-dashboard`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversationHistory: conversationHistory,
        userInfo
      })
    })

    if (analyticsResponse.ok) {
      const analyticsData = await analyticsResponse.json()
      if (analyticsData.dashboard) {
        setAnalyticsDashboard(analyticsData.dashboard)
        setDifficultyScores(analyticsData.difficultyScores)
      }
    }

    setShowFeedback(true)
    setInterviewActive(false)
    setIsVideoOn(false)
    setIsRecording(false)
    setQuestionCount(0)
  } catch (err) {
    
    setError('Failed to get feedback from server.')
    setInterviewActive(false)
  } finally {
    setLoading(false)
  }
}

  // Play STRICT Charon voice for AI questions (not loading or interim messages)
  // ENFORCED: Charon voice only, blocks input until complete
  // Uses Google AI Studio Charon voice via Gemini 2.5 Pro TTS
  useEffect(() => {
    if (messages.length === 0 || !interviewActive) return;
    const lastMsg = messages[messages.length - 1];
    
    // Only play Charon voice if it's an AI question message that hasn't been played yet
    if (lastMsg.sender === 'ai' && 
        lastMsg.text && 
        !lastMsg.isLoading && 
        lastMsg.text !== 'Thinking...' && 
        lastMsg.id !== lastPlayedId) {
      

      setLastAIQuestion(lastMsg.text);
      setLastPlayedId(lastMsg.id);
      
      // Add a small delay to ensure message is rendered before playing Charon voice
      setTimeout(() => {
        try {
          playAudioMessage(lastMsg.text);
          
          // Set up listener to track when Charon voice finishes
          if (audioRef.current) {
          
            
            audioRef.current.onended = () => {
             
              setLoading(false);  // Re-enable input after Charon finishes
            };
            
            audioRef.current.onerror = (err) => {
              
              setLoading(false);  // Enable input on error
              setError('Audio playback error - please try again');
            };
          }
        } catch (err) {
        
          setLoading(false);  // Enable input on error
        }
      }, 100);
    }
  }, [messages, lastPlayedId, interviewActive]);

  // Show UserSetup if userInfo not set

  if (!userInfo) {
    return <UserSetup onSubmit={info => setUserInfo(info)} />;
  }
// Sidebar item component
function SidebarItem({ icon, label, active }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '0.85rem 1rem',
      borderRadius: '0.75rem',
      background: active ? 'rgba(60,180,120,0.10)' : 'none',
      color: active ? '#3cb478' : '#6bbf8e',
      fontWeight: active ? 600 : 500,
      fontSize: 16,
      marginBottom: 8,
      cursor: 'pointer',
      transition: 'background 0.18s',
    }}>
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

// Profile field component
function ProfileField({ label, value, placeholder, onChange }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <label style={{ display: 'block', color: '#6bbf8e', fontWeight: 600, marginBottom: 6, fontSize: 15 }}>{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '0.85rem 1.1rem',
          borderRadius: '0.75rem',
          border: '1.5px solid #e0f2e9',
          background: '#f6fff8',
          fontSize: 16,
          color: '#222',
          fontWeight: 500,
          outline: 'none',
          boxShadow: '0 1px 4px 0 rgba(60,180,120,0.04)',
          marginBottom: 2,
          transition: 'border 0.18s',
        }}
      />
    </div>
  );
}

  // Show analytics dashboard if available, otherwise show traditional feedback
  if (showFeedback) {
    if (analyticsDashboard) {
      return (
        <div className="relative">
          <AnalyticsDashboard dashboard={analyticsDashboard} difficultyScores={difficultyScores} />
          <div className="fixed bottom-6 right-6">
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-white text-slate-900 rounded-lg font-semibold hover:shadow-lg transition transform hover:scale-105 shadow-lg"
            >
              Start New Interview
            </button>
          </div>
        </div>
      )
    }

    // Fallback to traditional feedback if analytics not available
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-violet-100 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-violet-700 px-8 py-8 text-white">
            <h2 className="text-3xl font-bold mb-2">Interview Feedback</h2>
            <p className="text-purple-100">Here's your performance summary</p>
          </div>
          <div className="p-8">
            <div className="bg-gradient-to-r from-purple-50 to-violet-50 border-l-4 border-purple-600 rounded-lg p-6 mb-8">
              <div className="whitespace-pre-line text-gray-800 leading-relaxed text-base">{feedback}</div>
            </div>
            <div className="flex gap-4 justify-center">
              <button 
                onClick={() => window.location.reload()}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-violet-700 text-white rounded-lg font-semibold hover:shadow-lg transition transform hover:scale-105"
              >
                Restart Interview
              </button>
              <button 
                onClick={() => {
                  const element = document.createElement('a');
                  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(feedback));
                  element.setAttribute('download', 'interview_feedback.txt');
                  element.style.display = 'none';
                  document.body.appendChild(element);
                  element.click();
                  document.body.removeChild(element);
                }}
                className="px-8 py-3 bg-white border-2 border-purple-600 text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition transform hover:scale-105"
              >
                Download Report
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white shadow-xl rounded-lg overflow-hidden m-2.5">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 to-violet-700 text-white px-6 py-5 shadow-lg">
        <div className="flex justify-between items-center max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <MessageCircle size={28} className="animate-pulse" />
            <div>
              <h1 className="text-2xl font-semibold">Interview AI Partner</h1>
            </div>
          </div>
          <div className="flex gap-3 items-center">
            <button 
              onClick={interviewActive ? endInterview : startInterview}
              disabled={loading}
              className={`flex items-center gap-2 px-5 py-2 rounded-full font-semibold transition-all duration-300 border-2 border-white ${
                interviewActive 
                  ? 'bg-red-500 border-red-500 hover:bg-red-600' 
                  : 'bg-transparent hover:bg-white hover:bg-opacity-20'
              } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {interviewActive ? <PhoneOff size={20} /> : <Phone size={20} />}
              <span className="text-sm">{interviewActive ? 'End Interview' : 'Start Interview'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 flex gap-3 items-start">
          <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700">{error}</p>
            <p className="text-xs text-red-600 mt-1">
              Make sure the backend server is running on {API_BASE_URL}
            </p>
          </div>
          <button 
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex flex-col flex-1 overflow-hidden">
        {/* Video Section */}
        {isVideoOn && (
          <div className="relative h-64 bg-black border-b border-gray-200">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 right-3 bg-black bg-opacity-60 text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              Live
            </div>
          </div>
        )}

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-5 bg-gray-50 space-y-4">
          {messages.length === 0 && !interviewActive && (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <MessageCircle size={64} className="text-gray-300 mb-4" />
              <h2 className="text-2xl font-semibold text-gray-700 mb-2">Ready to Interview?</h2>
              <p className="text-gray-500 max-w-sm">
                Click "Start Interview" to begin your AI-powered interview session. You can use text or microphone to answer questions.
              </p>
            </div>
          )}
          
          {messages.map((message) => (
            <div 
              key={message.id} 
              className={`flex gap-3 animate-in fade-in duration-300 ${
                message.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.sender === 'ai' && (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-violet-700 text-white text-xs font-semibold flex items-center justify-center flex-shrink-0">
                  AI
                </div>
              )}
              <div className={`flex flex-col gap-1 max-w-xs ${message.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div 
                  className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    message.sender === 'ai'
                      ? 'bg-white text-gray-800 rounded-bl-none shadow-sm'
                      : 'bg-gradient-to-r from-purple-600 to-violet-700 text-white rounded-br-none'
                  } ${message.isLoading ? 'animate-pulse' : ''}`}
                >
                  {message.text}
                </div>
                <span className="text-xs text-gray-500 px-2">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {message.sender === 'user' && (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-500 to-red-500 text-white text-xs font-semibold flex items-center justify-center flex-shrink-0">
                  You
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Section */}
        {interviewActive && (
          <div className="bg-white border-t border-gray-200 px-6 py-4 space-y-3">
            {/* Controls Bar - Only Video Toggle (optional, remove if not needed) */}
            <div className="flex gap-3">
              <button 
                onClick={() => setIsVideoOn(!isVideoOn)}
                disabled={loading}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                  isVideoOn
                    ? 'bg-gradient-to-r from-purple-600 to-violet-700 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="flex gap-3 items-center">
              <input 
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type your answer or use the microphone..."
                disabled={loading}
                className="flex-1 px-4 py-3 rounded-full border-2 border-gray-300 bg-white text-gray-900 text-sm placeholder-gray-500 focus:outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button 
                type="button"
                onClick={isListening ? stopSpeechRecognition : startSpeechRecognition}
                disabled={!isSTTSupported || loading}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
                  isListening
                    ? 'bg-purple-500 text-white animate-pulse'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title={isSTTSupported ? "Voice recognition" : "Speech-to-Text not supported"}
              >
                {isListening ? <Mic size={20} /> : <Mic size={20} />}
              </button>
              <button 
                type="submit"
                disabled={inputValue.trim() === '' || loading}
                className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-600 to-violet-700 text-white flex items-center justify-center hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                <Send size={20} />
              </button>
            </form>
          </div>
        )}
      </main>

      {/* Hidden audio element for text-to-speech */}
      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  )
}

export default App