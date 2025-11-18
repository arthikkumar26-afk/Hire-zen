import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, CheckCircle, Camera, Mic, MicOff, Video, VideoOff, Play, Pause, Square, AlertTriangle, Download, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

interface Question {
  question: string;
  category: string;
  type: 'mcq' | 'written';
  options?: string[];
  expectedAnswer: string;
}

const InterviewQuiz = () => {
  const { jobId, candidateId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [essayAnswers, setEssayAnswers] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [job, setJob] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<'mcq' | 'essay'>('mcq');
  const [mcqQuestions, setMcqQuestions] = useState<Question[]>([]);
  const [essayQuestions, setEssayQuestions] = useState<Question[]>([]);
  const [mcqScore, setMcqScore] = useState<number>(0);
  const [essayScore, setEssayScore] = useState<number>(0);
  const [analyzingEssays, setAnalyzingEssays] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showSubmitConfirmation, setShowSubmitConfirmation] = useState(false);
   const [submitStep, setSubmitStep] = useState<'video' | 'interview' | 'completed'>('video');

  // Add LOVABLE_API_KEY check to prevent errors
  const LOVABLE_API_KEY = import.meta.env.VITE_LOVABLE_API_KEY;

  // Recording states - Enhanced for screen + webcam + audio recording
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [screenEnabled, setScreenEnabled] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [uploadedVideoFilename, setUploadedVideoFilename] = useState<string | null>(null);

  // Stable refs to prevent re-mounting and maintain streams
  const webcamVideoRef = useRef<HTMLVideoElement>(null); // Webcam preview (main area)
  const screenVideoRef = useRef<HTMLVideoElement>(null); // Screen preview (small overlay)
  const webcamStreamRef = useRef<MediaStream | null>(null); // Webcam stream
  const screenStreamRef = useRef<MediaStream | null>(null); // Screen stream
  const combinedStreamRef = useRef<MediaStream | null>(null); // Combined screen + mic stream
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]); // Stable ref for chunks

  useEffect(() => {
    loadJobAndQuestions();
    // Generate session ID for this interview session - simplified for URL safety
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    const newSessionId = `session_${timestamp}_${randomId}`;
    setSessionId(newSessionId);
    console.log('🎯 Generated session ID:', newSessionId);
  }, [jobId, candidateId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 Cleaning up streams and recorder...');

      // Stop all streams
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (combinedStreamRef.current) {
        combinedStreamRef.current.getTracks().forEach(track => track.stop());
      }

      // Stop recording if active
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
        console.log('⏹️ MediaRecorder stopped during cleanup');
      }

      // Clear timer
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }

      // Clean up video URLs
      if (recordedVideoUrl) {
        URL.revokeObjectURL(recordedVideoUrl);
      }
    };
  }, [recordedVideoUrl]);

  // Stream previews setup - Stable refs that never reset
  useEffect(() => {
    // Set up webcam preview in main area
    if (hasPermissions && webcamStreamRef.current && webcamVideoRef.current) {
      console.log('🎥 Setting up webcam preview in main area...');
      console.log('📹 Webcam tracks:', webcamStreamRef.current.getVideoTracks().length);

      // Ensure tracks are enabled
      webcamStreamRef.current.getVideoTracks().forEach((track, index) => {
        track.enabled = true;
        console.log(`📹 Webcam track ${index} enabled:`, track.label, 'readyState:', track.readyState);
      });

      // Set webcam stream to main video element
      webcamVideoRef.current.srcObject = webcamStreamRef.current;
      console.log('📹 Webcam stream assigned to video element');

      // Start playing webcam preview
      webcamVideoRef.current.play().then(() => {
        console.log('✅ Webcam preview started successfully in main area');
        setCameraEnabled(true);
      }).catch(error => {
        console.warn('⚠️ Webcam autoplay blocked:', error);
        // Try to play again after user interaction
        const playWebcam = () => {
          if (webcamVideoRef.current) {
            webcamVideoRef.current.play().catch(e => console.warn('⚠️ Webcam play failed:', e));
          }
        };
        document.addEventListener('click', playWebcam, { once: true });
      }).finally(() => {
        console.log('📹 Webcam setup attempt complete');
      });
    }

    // Set up screen preview in small overlay
    if (hasPermissions && screenStreamRef.current && screenVideoRef.current) {
      console.log('🖥️ Setting up screen preview in overlay...');
      console.log('🖥️ Screen tracks:', screenStreamRef.current.getVideoTracks().length);

      // Ensure tracks are enabled
      screenStreamRef.current.getVideoTracks().forEach((track, index) => {
        track.enabled = true;
        console.log(`🖥️ Screen track ${index} enabled:`, track.label, 'readyState:', track.readyState);
      });

      // Set screen stream to overlay video element
      screenVideoRef.current.srcObject = screenStreamRef.current;
      console.log('🖥️ Screen stream assigned to overlay video element');

      // Start playing screen preview
      screenVideoRef.current.play().then(() => {
        console.log('✅ Screen preview started successfully in overlay');
        setScreenEnabled(true);
      }).catch(error => {
        console.warn('⚠️ Screen autoplay blocked:', error);
        // Try to play again after user interaction
        const playScreen = () => {
          if (screenVideoRef.current) {
            screenVideoRef.current.play().catch(e => console.warn('⚠️ Screen play failed:', e));
          }
        };
        document.addEventListener('click', playScreen, { once: true });
      }).finally(() => {
        console.log('🖥️ Screen setup attempt complete');
      });
    }
  }, [hasPermissions]);

  const loadJobAndQuestions = async () => {
    try {
      // Load job details
      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", jobId)
        .single();

      if (jobError) throw jobError;
      setJob(jobData);

      // Load or generate questions
      let quizQuestions: Question[];

      if (jobData.interview_questions && Array.isArray(jobData.interview_questions)) {
        console.log('Using custom interview questions from job');
        quizQuestions = jobData.interview_questions as unknown as Question[];
      } else {
        // Generate questions using the existing function
        console.log('Generating questions for position:', jobData.position);
        const { data: genData, error: genError } = await supabase.functions.invoke("generate-interview-questions", {
          body: {
            position: jobData.position || "General",
            jobDescription: jobData.job_description || "",
            numQuestions: 10, // Smaller quiz for public access
          },
        });

        if (genError) {
          console.error('Supabase function error:', genError);
          // Fallback to default questions if AI fails
          console.log('Falling back to default questions due to AI error');
          quizQuestions = [
            {
              question: "What is your experience with this technology field?",
              category: "Experience",
              type: "written" as const,
              expectedAnswer: "Detailed response about experience"
            },
            {
              question: "What are your greatest strengths?",
              category: "Self-Assessment",
              type: "written" as const,
              expectedAnswer: "Personal strengths relevant to the role"
            },
            {
              question: "Why are you interested in this position?",
              category: "Motivation",
              type: "written" as const,
              expectedAnswer: "Career goals and company interest"
            }
          ];
          // Add some MCQs as fallback
          const mcqFallback = [
            {
              question: "Which programming language is primarily used for web development?",
              category: "Technical",
              type: "mcq" as const,
              options: ["Python", "JavaScript", "Java", "C++"],
              expectedAnswer: "JavaScript"
            },
            {
              question: "What does HTML stand for?",
              category: "Technical",
              type: "mcq" as const,
              options: ["HyperText Markup Language", "High Tech Modern Language", "Home Tool Management Language", "Hyperlink and Text Management Language"],
              expectedAnswer: "HyperText Markup Language"
            }
          ];
          quizQuestions = [...mcqFallback, ...quizQuestions];
        } else {
          quizQuestions = genData.questions;
          console.log('Successfully generated questions:', quizQuestions.length);
        }
      }

      // Separate MCQ and essay questions
      let mcqQuestions = quizQuestions.filter(q => q.type === 'mcq');
      let essayQuestions = quizQuestions.filter(q => q.type !== 'mcq'); // Get non-MCQ questions as essays

      // If no essay questions available, create some default ones
      if (essayQuestions.length === 0 && mcqQuestions.length > 0) {
        essayQuestions = [
          {
            question: "Describe your experience with this technology/field and how it has shaped your career goals.",
            category: "Experience & Goals",
            type: "written" as const,
            expectedAnswer: "Detailed written response"
          },
          {
            question: "What are your greatest strengths and how do you think they would benefit this role?",
            category: "Self-Assessment",
            type: "written" as const,
            expectedAnswer: "Detailed written response"
          }
        ];
      }

      // If no MCQ questions, use some as MCQs
      if (mcqQuestions.length === 0 && essayQuestions.length > 0) {
        // Convert first 2 essay questions to MCQs with options
        mcqQuestions = essayQuestions.slice(0, 2).map(q => ({
          ...q,
          type: 'mcq' as const,
          options: [
            "Strong technical skills and problem-solving ability",
            "Excellent communication and teamwork skills",
            "Leadership experience and project management",
            "Continuous learning and adaptability"
          ],
          expectedAnswer: "Strong technical skills and problem-solving ability"
        }));
      }

      setMcqQuestions(mcqQuestions);
      setEssayQuestions(essayQuestions);
      setQuestions(mcqQuestions); // Start with MCQ questions

    } catch (error: any) {
      console.error("Error loading quiz:", error);
      toast({
        title: "Error",
        description: "Failed to load interview questions.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Request screen capture, webcam, and microphone permissions
  const requestPermissions = async () => {
    console.log('🔐 Requesting screen capture, webcam, and microphone permissions...');

    try {
      // Request screen capture
      console.log('🖥️ Requesting screen capture...');
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: false // Screen sharing typically doesn't include audio
      });
      screenStreamRef.current = screenStream;
      setScreenEnabled(true);
      console.log('✅ Screen stream obtained:', {
        videoTracks: screenStream.getVideoTracks().length,
        audioTracks: screenStream.getAudioTracks().length
      });

      // Request webcam and microphone
      console.log('📹🎤 Requesting webcam and microphone...');
      const webcamStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      webcamStreamRef.current = webcamStream;
      setCameraEnabled(true);
      setMicEnabled(true);
      console.log('✅ Webcam stream obtained:', {
        videoTracks: webcamStream.getVideoTracks().length,
        audioTracks: webcamStream.getAudioTracks().length
      });

      // Combine screen video + microphone audio for recording
      console.log('🔀 Combining streams for recording...');
      const screenVideoTrack = screenStream.getVideoTracks()[0];
      const micAudioTrack = webcamStream.getAudioTracks()[0];

      const combinedStream = new MediaStream([screenVideoTrack, micAudioTrack]);
      combinedStreamRef.current = combinedStream;

      console.log('✅ Combined stream created:', {
        videoTracks: combinedStream.getVideoTracks().length,
        audioTracks: combinedStream.getAudioTracks().length,
        tracks: combinedStream.getTracks().map(t => ({
          kind: t.kind,
          label: t.label,
          enabled: t.enabled,
          readyState: t.readyState
        }))
      });

      // Set permissions state
      setHasPermissions(true);
      setRecordingError(null);

      toast({
        title: "Permissions granted",
        description: "Screen capture, webcam, and microphone are now active.",
      });

    } catch (error) {
      console.error('❌ Error accessing media:', error);
      setHasPermissions(false);
      setScreenEnabled(false);
      setCameraEnabled(false);
      setMicEnabled(false);

      // Provide specific error guidance
      let errorMessage = "Please allow access to screen, camera, and microphone to record your interview.";
      if (error.name === 'NotAllowedError') {
        errorMessage = "Media access denied. Please check your browser permissions.";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "Required media devices not found.";
      } else if (error.name === 'NotReadableError') {
        errorMessage = "Media devices are already in use by another application.";
      }

      setRecordingError(errorMessage);

      toast({
        title: "Permission denied",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Start recording - Screen + Microphone combined stream
  const startRecording = () => {
    console.log('🎬 Starting screen + audio recording...');

    if (!combinedStreamRef.current) {
      const error = "Media streams not ready. Please grant permissions first.";
      setRecordingError(error);
      toast({
        title: "Recording not ready",
        description: error,
        variant: "destructive",
      });
      return;
    }

    if (isRecording) {
      console.warn('⚠️ Recording already in progress');
      return;
    }

    try {
      // Reset state
      recordedChunksRef.current = [];
      setRecordedBlob(null);
      setRecordedVideoUrl(null);
      setRecordingError(null);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);

      // Create MediaRecorder with MIME type - try VP9+Opus first, fallback to VP8+Opus, then webm
      let mimeType = 'video/webm;codecs=vp9,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }
      }
      console.log('🎬 Using MIME type:', mimeType);

      const mediaRecorder = new MediaRecorder(combinedStreamRef.current, {
        mimeType: mimeType
      });

      // Attach ondataavailable before calling start()
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
          console.log('📊 Chunk received:', event.data.size, 'bytes (total chunks:', recordedChunksRef.current.length, ')');
        } else if (event.data) {
          // Handle zero-size chunks (end of recording)
          console.log('📊 End chunk received (size 0)');
        } else {
          console.warn('📊 Empty event.data received');
        }
      };

      mediaRecorder.onstop = () => {
        console.log('⏹️ MediaRecorder stopped, state:', mediaRecorder.state);
        console.log('📦 Total chunks collected:', recordedChunksRef.current.length);

        // Stop timer
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }

        // Combine chunks into Blob - use the same MIME type as the recorder
        if (recordedChunksRef.current.length > 0) {
          const blob = new Blob(recordedChunksRef.current, { type: mediaRecorder.mimeType || 'video/webm' });
          setRecordedBlob(blob);

          // Generate downloadable URL
          const videoUrl = URL.createObjectURL(blob);
          setRecordedVideoUrl(videoUrl);
    
          console.log('✅ Recording saved - Blob size:', blob.size, 'bytes, MIME type:', blob.type);
          console.log('🔗 Video URL generated:', videoUrl);
    
          // Validate blob is playable
          if (blob.size === 0) {
            console.error('❌ Recorded blob is empty!');
            setRecordingError("Recording failed - no data captured. Please try again.");
            return;
          }
    
          // Auto-upload to server for analysis (now using merged email-server.js)
          uploadVideoToServer();

          toast({
            title: "Recording saved",
            description: `Video recorded successfully (${(blob.size / 1024 / 1024).toFixed(2)}MB)`,
          });
        } else {
          console.warn('⚠️ No chunks recorded');
          setRecordingError("No recording data captured. Please try again.");
        }

        setIsRecording(false);
      };

      mediaRecorder.onerror = (error) => {
        console.error('❌ MediaRecorder error:', error);
        setRecordingError("Recording failed.");
        setIsRecording(false);

        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
        }
      };

      // Store reference and start recording
      mediaRecorderRef.current = mediaRecorder;
      console.log('▶️ Starting MediaRecorder with timeslice 1000ms...');
      mediaRecorder.start(1000); // Call start(1000) for chunks every second

      // Start timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      console.log('✅ Recording started successfully');
      toast({
        title: "Recording started",
        description: "Screen and audio are now being recorded.",
      });

    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      setRecordingError("Failed to start recording.");
      setIsRecording(false);
      toast({
        title: "Recording failed",
        description: "Could not start recording. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Stop recording
  const stopRecording = () => {
    console.log('⏹️ Stopping recording...');

    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
      console.warn('⚠️ No active recording to stop');
      return;
    }

    mediaRecorderRef.current.stop();
    console.log('✅ Stop command sent to MediaRecorder');
  };

  // Pause/Resume recording
  const togglePause = () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    if (isPaused) {
      console.log('▶️ Resuming recording...');
      mediaRecorderRef.current.resume();
      setIsPaused(false);

      // Resume timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      toast({
        title: "Recording resumed",
      });
    } else {
      console.log('⏸️ Pausing recording...');
      mediaRecorderRef.current.pause();
      setIsPaused(true);

      // Pause timer
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }

      toast({
        title: "Recording paused",
      });
    }
  };

  // Upload recorded video to server using GridFS
  const uploadVideoToServer = async () => {
    if (!recordedBlob) return;

    setIsUploading(true);
    try {
      console.log('🎬 Uploading recorded video to MongoDB GridFS...');

      const formData = new FormData();
      formData.append('video', recordedBlob, `interview_recording_${Date.now()}.webm`);
      formData.append('sessionId', sessionId || 'unknown_session');
      formData.append('candidateId', candidateId || 'public_user');
      formData.append('candidateName', 'Interview Candidate'); // Could be enhanced to get actual name
      formData.append('candidateEmail', 'candidate@example.com'); // Could be enhanced to get actual email
      formData.append('jobId', jobId || 'unknown_job');
      formData.append('jobPosition', job?.position || 'Unknown Position');

      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3002';
      const response = await fetch(`${apiBaseUrl}/upload-video`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload failed response:', errorText);
        throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Video uploaded to GridFS successfully:', result);

      // Store the filename and URL for preview
      const videoFilename = result.filename;
      const previewUrl = result.fileUrl; // Use the returned fileUrl instead of constructing it

      setUploadedVideoFilename(videoFilename);
      setUploadedVideoUrl(previewUrl);

      toast({
        title: "Video uploaded",
        description: `Video stored in MongoDB GridFS. File ID: ${result.fileId}`,
      });

      // Return the upload result - don't try to attach to activity log here
      // Activity log attachment will happen in handleSubmit after the log is created
      return { filename: videoFilename, url: previewUrl, fileId: result.fileId, mimeType: result.mimeType, size: result.size };

    } catch (error) {
      console.error('❌ Error uploading video to GridFS:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload video to MongoDB. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Download recorded video
  const downloadRecording = () => {
    if (!recordedBlob || !recordedVideoUrl) return;

    const link = document.createElement('a');
    link.href = recordedVideoUrl;
    link.download = `interview_recording_${Date.now()}.webm`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Download started",
      description: "Video download has been initiated.",
    });
  };

  // Format recording time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerSelect = (questionIndex: number, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionIndex]: answer
    }));
  };

  const handleNext = () => {
    if (currentPhase === 'mcq') {
      if (currentQuestionIndex < mcqQuestions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      } else if (essayQuestions.length > 0) {
        // Move to essay phase
        setCurrentPhase('essay');
        setQuestions(essayQuestions);
        setCurrentQuestionIndex(0);
      }
    } else {
      // Essay phase
      if (currentQuestionIndex < essayQuestions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      }
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const calculateScore = () => {
    if (currentPhase === 'mcq') {
      let correct = 0;
      mcqQuestions.forEach((question, index) => {
        if (answers[index] === question.expectedAnswer) {
          correct++;
        }
      });
      return correct;
    } else {
      // Essay scores are calculated by AI, return 0 for now
      return essayScore;
    }
  };

  const calculateMcqScore = () => {
    let correct = 0;
    mcqQuestions.forEach((question, index) => {
      if (answers[index] === question.expectedAnswer) {
        correct++;
      }
    });
    return correct;
  };

  // Analyze essay answers with AI
  const analyzeEssayAnswers = async () => {
    if (essayQuestions.length === 0) return 0;

    setAnalyzingEssays(true);
    try {
      if (!LOVABLE_API_KEY) {
        console.warn("AI analysis not configured, using default scores");
        return 70; // Return a default good score when AI is not available
      }

      let totalScore = 0;
      const essayScores: Record<number, number> = {};

      for (let i = 0; i < essayQuestions.length; i++) {
        const question = essayQuestions[i];
        const answer = essayAnswers[i];

        if (!answer || answer.trim().length < 10) {
          essayScores[i] = 0;
          continue;
        }

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: "You are an expert interviewer. Evaluate essay answers on a scale of 1-100 based on relevance, depth, clarity, and insight. Return only a JSON object with a 'score' field containing the numerical score."
              },
              {
                role: "user",
                content: `Question: ${question.question}\n\nAnswer: ${answer}\n\nEvaluate this answer on a scale of 1-100.`
              }
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "evaluate_answer",
                  description: "Evaluate the essay answer and provide a score",
                  parameters: {
                    type: "object",
                    properties: {
                      score: { type: "number", description: "Score from 1-100" }
                    },
                    required: ["score"]
                  }
                }
              }
            ],
            tool_choice: { type: "function", function: { name: "evaluate_answer" } }
          }),
        });

        if (!aiResponse.ok) {
          console.error("AI evaluation failed for essay", i);
          essayScores[i] = 50; // Default score
        } else {
          const aiData = await aiResponse.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall) {
            const evaluation = JSON.parse(toolCall.function.arguments);
            essayScores[i] = Math.max(1, Math.min(100, evaluation.score || 50));
          } else {
            essayScores[i] = 50;
          }
        }

        totalScore += essayScores[i];
      }

      const averageScore = totalScore / essayQuestions.length;
      setEssayScore(averageScore);
      return averageScore;

    } catch (error) {
      console.error("Error analyzing essays:", error);
      setEssayScore(50); // Default score
      return 50;
    } finally {
      setAnalyzingEssays(false);
    }
  };

  const handleSubmit = async () => {
    // Check if recording was done - use recordedBlob as primary check
    if (!recordedBlob || recordedBlob.size === 0) {
      toast({
        title: "Recording Required",
        description: "Please start and complete your video recording before submitting the interview.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Calculate MCQ score
      const mcqCorrect = calculateMcqScore();
      const mcqPercentage = mcqQuestions.length > 0 ? (mcqCorrect / mcqQuestions.length) * 100 : 0;
      setMcqScore(mcqPercentage);

      // Analyze essay answers if any
      let essayPercentage = 0;
      if (essayQuestions.length > 0) {
        essayPercentage = await analyzeEssayAnswers();
      }

      // Calculate final combined score (weighted average)
      let finalScore = 0;
      let totalWeight = 0;

      if (mcqQuestions.length > 0) {
        // MCQs get 40% weight
        finalScore += (mcqPercentage * 0.4);
        totalWeight += 0.4;
      }

      if (essayQuestions.length > 0) {
        // Essays get 60% weight (more important for detailed assessment)
        finalScore += (essayPercentage * 0.6);
        totalWeight += 0.6;
      }

      const combinedScore = totalWeight > 0 ? Math.round(finalScore / totalWeight) : 0;

      // Ensure final score is between 1-100
      const finalScoreBounded = Math.max(1, Math.min(100, combinedScore));

      // Upload video to GridFS and get real URL
      let videoUrl = null;
      let videoUploadResult = null;
      if (recordedBlob && recordedBlob.size > 0) {
        try {
          console.log('🎬 Uploading video to GridFS...');
          videoUploadResult = await uploadVideoToServer();
          videoUrl = videoUploadResult?.url || null; // Get the URL from upload result
          console.log('✅ Video uploaded, URL:', videoUrl);

          // Store video metadata in dedicated interview_videos collection
          if (videoUploadResult && candidateId) {
            const videoMetadata = {
              interview_id: candidateId,
              candidate_id: candidateId,
              session_id: sessionId,
              gridfs_file_id: videoUploadResult.fileId,
              filename: videoUploadResult.filename,
              mime_type: videoUploadResult.mimeType,
              size_bytes: videoUploadResult.size,
              size_mb: (videoUploadResult.size / 1024 / 1024).toFixed(2),
              video_url: videoUrl,
              upload_date: new Date().toISOString(),
              duration_seconds: recordingTime,
              metadata: {
                candidate_name: 'Interview Candidate', // Will be updated when candidate data is available
                candidate_email: 'candidate@example.com', // Will be updated when candidate data is available
                job_position: job?.position || 'Unknown Position',
                interview_type: 'written_quiz'
              },
              processing_status: 'completed',
              compression_info: {
                original_size: recordedBlob.size,
                processed_size: videoUploadResult.size,
                codec: 'vp9+opus'
              }
            };

            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3002';
            const videoResponse = await fetch(`${apiBaseUrl}/interview-videos`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(videoMetadata),
            });

            if (videoResponse.ok) {
              const videoResult = await videoResponse.json();
              console.log('✅ Video metadata saved to interview_videos collection:', videoResult.id);
            } else {
              console.warn('⚠️ Failed to save video metadata to interview_videos collection');
            }
          }
        } catch (uploadError) {
          console.error('❌ Video upload failed:', uploadError);
          // Continue with submission even if upload fails
        }
      }
      console.log('🎬 Video recording completed - data will be stored in MongoDB');

      if (recordedBlob && recordedBlob.size > 0) {
        console.log('🎬 Video blob size:', recordedBlob.size, 'bytes');
        console.log('🎬 Video will be stored in MongoDB activity logs collection');
      }

      // For public interviews (no candidate ID), still save to activity log with generic info
      console.log('Saving interview results for candidateId:', candidateId);
      if (candidateId && candidateId !== 'undefined') {
        try {
          // First get candidate details to populate activity log
          console.log('Fetching candidate data for ID:', candidateId);
          const { data: candidateData, error: candidateError } = await supabase
            .from('candidates')
            .select(`
              id,
              full_name,
              email
            `)
            .eq('id', candidateId)
            .single();

          if (candidateError) {
            console.warn('Candidate fetch failed, proceeding with limited data:', candidateError);
            // Continue without candidate data - don't throw error
          }

          // Candidate data handling moved above

          // Save comprehensive interview results to MongoDB - including candidate profile data
          try {
            // First, fetch candidate profile data from Supabase to include in MongoDB
            const { data: profileData, error: profileError } = await supabase
              .from('candidates')
              .select(`
                *,
                resumes (*),
                applied_jobs (*)
              `)
              .eq('id', candidateId)
              .single();

            if (profileError) {
              console.warn('Could not fetch detailed candidate profile, proceeding without it:', profileError);
              // Continue without profile data - don't throw error
            }

            const comprehensiveInterviewData = {
              // Basic interview info
              candidate_id: candidateId,
              candidate_name: candidateData.full_name,
              candidate_email: candidateData.email,
              job_id: jobId,
              job_position: job?.position || 'Unknown Position',
              score: finalScoreBounded, // Overall combined score
              status: 'completed',
              completed_at: new Date().toISOString(),
              video_url: videoUrl,

              // Questions and answers
              questions: [...mcqQuestions, ...essayQuestions],
              answers: { mcq: answers, essay: essayAnswers },

              // Detailed evaluation
              evaluation: {
                mcq_score: mcqPercentage,
                essay_score: essayPercentage,
                final_score: finalScoreBounded,
                mcq_correct: mcqCorrect,
                total_mcq: mcqQuestions.length,
                total_essay: essayQuestions.length,
                summary: `MCQ: ${mcqCorrect}/${mcqQuestions.length} (${mcqPercentage.toFixed(1)}%), Essay: ${essayPercentage.toFixed(1)}%, Final: ${finalScoreBounded}%`
              },

              // Complete candidate profile data
              candidate_profile: profileData ? {
                id: profileData.id,
                full_name: profileData.full_name,
                email: profileData.email,
                phone: profileData.phone,
                experience_years: profileData.experience_years,
                skills: profileData.skills,
                status: profileData.status,
                created_at: profileData.created_at,
                updated_at: profileData.updated_at,

                // Additional fields from resume_text or ai_match_analysis (if available)
                resume_text: profileData.resume_text,
                ai_match_analysis: profileData.ai_match_analysis,
                ai_match_score: profileData.ai_match_score,

                // Related data
                resumes: profileData.resumes || [],
                applied_jobs: profileData.applied_jobs || [],

                // Interview context
                interview_link_used: window.location.href,
                interview_token: null, // Would be populated if this was from AIInterview
                interview_quiz_type: 'written_quiz', // Distinguish from AI video interviews

                // System metadata
                submitted_from: 'InterviewQuiz',
                submission_timestamp: new Date().toISOString(),
                user_agent: navigator.userAgent,
                screen_resolution: `${window.screen.width}x${window.screen.height}`,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
              } : null,

              // Interview metadata
              interview_metadata: {
                quiz_type: 'written',
                phases_completed: currentPhase === 'essay' ? ['mcq', 'essay'] : ['mcq'],
                total_time_taken: recordingTime, // Use recording time as proxy for total time
                questions_answered: mcqQuestions.length + essayQuestions.length,
                video_recording_duration: recordingTime,
                video_recording_size_mb: recordedBlob ? (recordedBlob.size / 1024 / 1024).toFixed(2) : null,
                ai_evaluation_used: true,
                ai_model_used: 'google/gemini-2.5-flash',
                browser_info: {
                  userAgent: navigator.userAgent,
                  language: navigator.language,
                  platform: navigator.platform
                }
              },

              // Legacy fields for compatibility
              mcq_score: mcqPercentage,
              essay_score: essayPercentage,
              total_questions: mcqQuestions.length + essayQuestions.length,
              video_recorded: !!videoUrl
            };

            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3002';
            const mongoResponse = await fetch(`${apiBaseUrl}/interview-results`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(comprehensiveInterviewData),
            });

            if (mongoResponse.ok) {
              const mongoResult = await mongoResponse.json();
              console.log('Interview results saved to MongoDB:', mongoResult);
            } else {
              console.error('Failed to save interview results to MongoDB:', mongoResponse.statusText);
              toast({
                title: "Warning",
                description: "Interview completed but results couldn't be saved to MongoDB.",
                variant: "destructive",
              });
            }
          } catch (mongoError) {
            console.error('MongoDB save error:', mongoError);
            toast({
              title: "Warning",
              description: "Interview completed but results couldn't be saved.",
              variant: "destructive",
            });
          }

          // Save activity log to MongoDB via central server
          console.log('Creating activity log entry for interview completion...');
          const activityLogEntry = {
            candidate_id: candidateId,
            candidate_name: candidateData?.full_name || 'Unknown Candidate',
            candidate_email: candidateData?.email || '',
            job_id: jobId || null,
            job_position: job?.position || 'Unknown Position',
            old_stage: 'hr', // Screening Test stage
            new_stage: finalScoreBounded >= 50 ? 'written_test' : 'hr', // Demo Round if passed, stay in Screening Test if failed
            old_stage_label: 'Screening Test',
            new_stage_label: finalScoreBounded >= 50 ? 'Demo Round' : 'Screening Test (Failed)',
            changed_by_name: 'Interview Quiz System',
            created_at: new Date().toISOString(),
            interview_score: finalScoreBounded,
            video_url: videoUrl,
            // Include video metadata from GridFS upload
            video_file_id: videoUploadResult?.fileId || null,
            video_filename: videoUploadResult?.filename || null,
            video_mime_type: videoUploadResult?.mimeType || null,
            video_size_bytes: videoUploadResult?.size || null,
            video_size_mb: videoUploadResult?.size ? (videoUploadResult.size / 1024 / 1024).toFixed(2) : null,
            // Video is already stored in GridFS, no need for blob in activity log
            interview_details: {
              mcq_score: mcqPercentage,
              essay_score: essayPercentage,
              total_questions: mcqQuestions.length + essayQuestions.length,
              video_recorded: !!videoUrl,
              video_stored_in_gridfs: !!videoUploadResult,
              passed: finalScoreBounded >= 50
            }
          };

          try {
            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3002';
            const activityResponse = await fetch(`${apiBaseUrl}/activity-logs`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(activityLogEntry),
            });

            if (activityResponse.ok) {
              const activityResult = await activityResponse.json();
              console.log('✅ Activity log saved to MongoDB:', activityResult);
              toast({
                title: "Activity logged",
                description: "Interview completion recorded in activity log.",
              });
            } else {
              console.error('❌ Failed to save activity log to MongoDB:', activityResponse.statusText);
              toast({
                title: "Warning",
                description: "Interview completed but activity log couldn't be saved.",
                variant: "destructive",
              });
            }
          } catch (activityError) {
            console.error('❌ Activity log save error:', activityError);
            toast({
              title: "Warning",
              description: "Interview completed but activity couldn't be logged.",
              variant: "destructive",
            });
          }

          // Update candidate status if they passed the interview
          if (finalScoreBounded >= 50 && candidateData) {
            console.log('Updating candidate status to Demo Round (written_test)...');
            try {
              const { error: updateError } = await supabase
                .from('candidates')
                .update({
                  status: 'written_test', // This corresponds to "Demo Round" in the pipeline
                  updated_at: new Date().toISOString()
                })
                .eq('id', candidateId);

              if (updateError) {
                console.warn('Supabase update failed, skipping status update:', updateError);
                // Don't throw error, continue with submission
              } else {
                console.log('Candidate status updated to Demo Round successfully');
              }
            } catch (statusUpdateError) {
              console.warn('Status update failed, continuing:', statusUpdateError);
              // Don't throw error, continue with submission
            }
          }

          console.log('✅ Interview submission completed for candidate:', candidateId);

        } catch (dbError) {
          console.error('Database error:', dbError);
        }

        // Don't log sensitive candidate data
        console.log('Quiz attempt with recording completed for candidate:', candidateId);
      } else {
        // For public interviews without candidate ID, create a generic activity log entry
        console.log('Creating activity log entry for public interview');
        const publicActivityLogEntry = {
          candidate_name: 'Public Interview User',
          candidate_email: `public_${Date.now()}@interview.test`,
          job_position: job?.position || 'Unknown Position',
          old_stage: 'Interview Started',
          new_stage: 'Interview Completed',
          old_stage_label: 'Interview Started',
          new_stage_label: `Interview Completed (${finalScoreBounded}%)`,
          changed_by_name: 'Public Interview System',
          created_at: new Date().toISOString(),
          interview_score: finalScoreBounded,
          video_url: videoUrl,
          // Include video metadata from GridFS upload for public interviews
          video_file_id: videoUploadResult?.fileId || null,
          video_filename: videoUploadResult?.filename || null,
          video_mime_type: videoUploadResult?.mimeType || null,
          video_size_bytes: videoUploadResult?.size || null,
          video_size_mb: videoUploadResult?.size ? (videoUploadResult.size / 1024 / 1024).toFixed(2) : null,
          // Video is already stored in GridFS, no need for blob in activity log
          interview_details: {
            mcq_score: mcqPercentage,
            essay_score: essayPercentage,
            total_questions: mcqQuestions.length + essayQuestions.length,
            video_recorded: !!videoUrl,
            video_stored_in_gridfs: !!videoUploadResult,
            passed: finalScoreBounded >= 50
          }
        };

        try {
          const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3002';
          const publicActivityResponse = await fetch(`${apiBaseUrl}/activity-logs`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(publicActivityLogEntry),
          });

          if (publicActivityResponse.ok) {
            const publicActivityResult = await publicActivityResponse.json();
            console.log('✅ Public activity log saved to MongoDB:', publicActivityResult);
          } else {
            console.error('❌ Failed to save public activity log to MongoDB:', publicActivityResponse.statusText);
          }
        } catch (publicActivityError) {
          console.error('❌ Public activity log save error:', publicActivityError);
        }

        // Save interview results to MongoDB for public users
        console.log('Saving public interview results...');
        const publicInterviewData = {
          candidate_id: '00000000-0000-0000-0000-000000000000', // dummy UUID for public interviews
          candidate_name: 'Public Interview User',
          candidate_email: `public_${Date.now()}@interview.test`,
          job_position: job?.position || 'Unknown Position',
          score: finalScoreBounded, // Overall combined score
          status: 'completed',
          completed_at: new Date().toISOString(),
          video_url: videoUrl,
          questions: [...mcqQuestions, ...essayQuestions] as any,
          answers: { mcq: answers, essay: essayAnswers } as any,
          evaluation: {
            mcq_score: mcqPercentage,
            essay_score: essayPercentage,
            final_score: finalScoreBounded,
            mcq_correct: mcqCorrect,
            total_mcq: mcqQuestions.length,
            total_essay: essayQuestions.length,
            summary: `MCQ: ${mcqCorrect}/${mcqQuestions.length} (${mcqPercentage.toFixed(1)}%), Essay: ${essayPercentage.toFixed(1)}%, Final: ${finalScoreBounded}%`
          } as any,
          mcq_score: mcqPercentage,
          essay_score: essayPercentage,
          total_questions: mcqQuestions.length + essayQuestions.length,
          video_recorded: !!videoUrl
        };

        try {
          const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3002';
          const publicInterviewResponse = await fetch(`${apiBaseUrl}/interview-results`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(publicInterviewData),
          });

          if (publicInterviewResponse.ok) {
            const publicInterviewResult = await publicInterviewResponse.json();
            console.log('✅ Public interview results saved to MongoDB:', publicInterviewResult);
          } else {
            console.error('❌ Failed to save public interview results to MongoDB:', publicInterviewResponse.statusText);
          }
        } catch (publicInterviewError) {
          console.error('❌ Public interview save error:', publicInterviewError);
        }
      }

      setShowResults(true);

      toast({
        title: "Interview Completed!",
        description: `MCQ: ${mcqCorrect}/${mcqQuestions.length} (${mcqPercentage.toFixed(1)}%), Essay: ${essayPercentage.toFixed(1)}%, Final: ${finalScoreBounded}%`,
      });

    } catch (error) {
      console.error("Error submitting interview:", error);
      toast({
        title: "Error",
        description: "Failed to submit interview.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show instructions page first
  if (showInstructions) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <Card className="p-8">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl">Interview Instructions</CardTitle>
              <p className="text-muted-foreground mt-2">
                Please read these instructions carefully before starting your interview
              </p>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-primary/10 p-2 rounded-full">
                      <Camera className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Camera & Microphone</h3>
                      <p className="text-sm text-muted-foreground">
                        Ensure your camera and microphone are working properly. You will be recorded during the interview.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="bg-primary/10 p-2 rounded-full">
                      <Monitor className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Screen Recording</h3>
                      <p className="text-sm text-muted-foreground">
                        Your screen will be recorded along with your responses for evaluation purposes.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="bg-primary/10 p-2 rounded-full">
                      <CheckCircle className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Assessment Structure</h3>
                      <p className="text-sm text-muted-foreground">
                        The interview consists of multiple choice questions followed by written responses that will be AI-evaluated.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">⚠️ Important Requirements</h3>
                    <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                      <li>• Stable internet connection required</li>
                      <li>• Quiet environment recommended</li>
                      <li>• No external help or notes allowed</li>
                      <li>• Complete all questions to submit</li>
                      <li>• Your responses will be automatically evaluated</li>
                    </ul>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">📊 What Happens Next</h3>
                    <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                      <li>• Results will be available immediately</li>
                      <li>• Detailed scoring breakdown provided</li>
                      <li>• Interview data saved for HR review</li>
                      <li>• Email notification sent upon completion</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="agree-terms"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-1"
                  />
                  <label htmlFor="agree-terms" className="text-sm">
                    <strong>I understand and agree to the following:</strong>
                    <ul className="mt-2 space-y-1 text-muted-foreground">
                      <li>• I consent to video and audio recording during this interview</li>
                      <li>• My responses will be evaluated by AI and HR personnel</li>
                      <li>• I will complete the assessment honestly without external assistance</li>
                      <li>• I understand that my performance will determine the next steps in the hiring process</li>
                    </ul>
                  </label>
                </div>
              </div>

              <div className="flex gap-4 justify-end pt-4">
                <Button variant="outline" onClick={() => navigate('/careers')}>
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (agreedToTerms) {
                      // Request permissions automatically when starting interview
                      try {
                        console.log('🚀 Starting interview - requesting permissions automatically...');

                        // Request screen capture first
                        console.log('🖥️ Requesting screen capture...');
                        const screenStream = await navigator.mediaDevices.getDisplayMedia({
                          video: {
                            width: { ideal: 1920 },
                            height: { ideal: 1080 },
                            frameRate: { ideal: 30 }
                          },
                          audio: false
                        });
                        screenStreamRef.current = screenStream;
                        setScreenEnabled(true);

                        // Request webcam and microphone
                        console.log('📹🎤 Requesting webcam and microphone...');
                        const webcamStream = await navigator.mediaDevices.getUserMedia({
                          video: {
                            width: { ideal: 640 },
                            height: { ideal: 480 },
                            facingMode: "user"
                          },
                          audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true
                          }
                        });
                        webcamStreamRef.current = webcamStream;
                        setCameraEnabled(true);
                        setMicEnabled(true);

                        // Combine streams for recording
                        const screenVideoTrack = screenStream.getVideoTracks()[0];
                        const micAudioTrack = webcamStream.getAudioTracks()[0];
                        const combinedStream = new MediaStream([screenVideoTrack, micAudioTrack]);
                        combinedStreamRef.current = combinedStream;

                        setHasPermissions(true);
                        setShowInstructions(false);

                        // Auto-start recording after permissions are granted
                        console.log('🔄 Auto-starting recording after permissions granted...');
                        setTimeout(() => {
                          startRecording();
                        }, 1000); // Small delay to ensure UI updates

                        toast({
                          title: "Recording started automatically",
                          description: "Screen and audio recording has begun. Answer the questions and click 'Submit Interview' when done.",
                        });

                      } catch (error) {
                        console.error('❌ Permission request failed:', error);
                        toast({
                          title: "Permission denied",
                          description: "Please allow camera and screen sharing access to continue.",
                          variant: "destructive",
                        });
                      }
                    }
                  }}
                  disabled={!agreedToTerms}
                  className="min-w-[120px]"
                >
                  Start Interview
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <Card className="p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading interview questions...</p>
        </Card>
      </div>
    );
  }

  if (!job || questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-lg">Interview questions not available.</p>
          <Button onClick={() => navigate('/careers')} className="mt-4">
            Back to Jobs
          </Button>
        </Card>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const answeredQuestions = Object.keys(answers).length;

  if (showResults) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 py-12">
        <div className="container mx-auto px-4 max-w-2xl">
          <Card className="p-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2">Interview Completed!</h1>
            <p className="text-xl text-muted-foreground mb-6">
              {job.position} Assessment Results
            </p>

            <div className="mb-8">
              <div className="text-6xl font-bold text-primary mb-2">
                {(() => {
                  // Calculate MCQ score
                  const mcqCorrect = calculateMcqScore();
                  const mcqPercentage = mcqQuestions.length > 0 ? (mcqCorrect / mcqQuestions.length) * 100 : 0;

                  // Get essay score (should be available from handleSubmit)
                  const essayPercentage = essayScore;

                  // Calculate final combined score (weighted average)
                  let finalScore = 0;
                  let totalWeight = 0;

                  if (mcqQuestions.length > 0) {
                    finalScore += (mcqPercentage * 0.4);
                    totalWeight += 0.4;
                  }

                  if (essayQuestions.length > 0) {
                    finalScore += (essayPercentage * 0.6);
                    totalWeight += 0.6;
                  }

                  const combinedScore = totalWeight > 0 ? Math.round(finalScore / totalWeight) : 0;
                  return Math.max(1, Math.min(100, combinedScore));
                })()}%
              </div>
              <div className="text-sm space-y-1">
                {(() => {
                  const mcqCorrect = calculateMcqScore();
                  const mcqPercentage = mcqQuestions.length > 0 ? (mcqCorrect / mcqQuestions.length) * 100 : 0;
                  const essayPercentage = essayScore;

                  return (
                    <>
                      {mcqQuestions.length > 0 && (
                        <p>MCQ Score: {mcqCorrect}/{mcqQuestions.length} ({mcqPercentage.toFixed(1)}%)</p>
                      )}
                      {essayQuestions.length > 0 && (
                        <p>Essay Score: {essayPercentage.toFixed(1)}%</p>
                      )}
                      <p className="text-muted-foreground mt-2">
                        Final score combines both sections with proper weighting (MCQ: 40%, Essay: 60%)
                      </p>
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="flex gap-4 justify-center">
              <Button onClick={() => navigate('/careers')}>
                View More Jobs
              </Button>
              <Button variant="outline" onClick={() => navigate(`/apply/${jobId}`)}>
                Apply for This Job
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Submit Confirmation Modal - Step-by-step submission
  const handleVideoSubmit = async () => {
    if (isRecording) {
      stopRecording();
      setSubmitStep('interview');
      toast({
        title: "Video recording stopped",
        description: "Now submitting your interview answers...",
      });
    } else {
      setSubmitStep('interview');
    }
  };

  const handleInterviewSubmit = async () => {
    setSubmitStep('completed');
    // Small delay to ensure UI updates
    setTimeout(() => {
      handleSubmit();
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 py-12">
      {/* Submit Confirmation Modal */}
      {showSubmitConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-center">Submit Interview</CardTitle>
              <p className="text-center text-muted-foreground">
                {submitStep === 'video' ? 'Stop video recording first' : submitStep === 'interview' ? 'Now submit your answers' : 'Completing submission...'}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {submitStep === 'video' && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">Step 1: Stop Video Recording</h4>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    Currently recording for {formatTime(recordingTime)}. Click below to stop recording and proceed to submit answers.
                  </p>
                </div>
              )}

              {submitStep === 'interview' && (
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Step 2: Submit Answers</h4>
                  <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                    <li>• Your answers will be evaluated by AI</li>
                    <li>• Results will be saved and emailed</li>
                    <li>• HR team will review your submission</li>
                  </ul>
                </div>
              )}

              {submitStep === 'completed' && (
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center justify-center">
                    <CheckCircle className="h-8 w-8 text-green-600 mr-2" />
                    <span className="font-semibold text-green-800 dark:text-green-200">Submission Complete!</span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-end">
                {submitStep === 'video' && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setShowSubmitConfirmation(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleVideoSubmit}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      <Square className="h-4 w-4 mr-2" />
                      Stop Recording
                    </Button>
                  </>
                )}

                {submitStep === 'interview' && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setShowSubmitConfirmation(false)}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleInterviewSubmit}
                      disabled={isSubmitting}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Submitting...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Submit Answers
                        </>
                      )}
                    </Button>
                  </>
                )}

                {submitStep === 'completed' && (
                  <Button
                    onClick={() => setShowSubmitConfirmation(false)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Done
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="w-[90vw] mx-auto px-4">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-center">
              {job.position} - Interview Assessment
            </CardTitle>
            <p className="text-center text-muted-foreground">
              {currentPhase === 'mcq' ? 'Multiple Choice Questions' : 'Essay Questions'} •
              Question {currentQuestionIndex + 1} of {currentPhase === 'mcq' ? mcqQuestions.length : essayQuestions.length}
              {mcqQuestions.length > 0 && essayQuestions.length > 0 && (
                <span className="block text-xs mt-1">
                  Phase: {currentPhase.toUpperCase()}
                </span>
              )}
            </p>
            <Progress value={progress} className="mt-4" />
          </CardHeader>
        </Card>

        {/* Main Content Layout - Questions on Left, Recording on Right */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Interview Questions Section - Left Side */}
          <Card className="h-fit">
          <CardHeader>
            <CardTitle>Interview Questions</CardTitle>
          </CardHeader>
          <CardContent>
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                {currentQuestion.category}
              </span>
            </div>
            <h2 className="text-2xl font-semibold mb-6 leading-relaxed text-center">
              {currentQuestion.question}
            </h2>
          </div>

          {currentPhase === 'mcq' && currentQuestion.type === 'mcq' && currentQuestion.options && (
            <div className="space-y-3">
              {currentQuestion.options.map((option, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-primary/50",
                    answers[currentQuestionIndex] === option
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  )}
                  onClick={() => handleAnswerSelect(currentQuestionIndex, option)}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                      answers[currentQuestionIndex] === option
                        ? "border-primary"
                        : "border-muted-foreground"
                    )}>
                      {answers[currentQuestionIndex] === option && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <span className="text-base">{option}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {currentPhase === 'essay' && (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-2 text-blue-800 dark:text-blue-200">
                  <div className="p-1 rounded-full bg-blue-100 dark:bg-blue-900">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium">Essay Question</p>
                    <p className="text-sm mt-1">Provide a detailed answer (minimum 50 characters). Your response will be evaluated by AI.</p>
                  </div>
                </div>
              </div>

              <textarea
                value={essayAnswers[currentQuestionIndex] || ''}
                onChange={(e) => {
                  const newAnswers = { ...essayAnswers };
                  newAnswers[currentQuestionIndex] = e.target.value;
                  setEssayAnswers(newAnswers);
                }}
                placeholder="Type your detailed answer here..."
                className="w-full min-h-[200px] p-4 border border-input rounded-lg bg-background resize-vertical focus:ring-2 focus:ring-primary focus:border-transparent"
                disabled={analyzingEssays}
              />

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{(essayAnswers[currentQuestionIndex] || '').length} characters</span>
                {analyzingEssays && (
                  <span className="flex items-center gap-2 text-primary">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    Analyzing response...
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center mt-8">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            <div className="text-sm text-muted-foreground">
              {currentPhase === 'mcq' ?
                `${Object.keys(answers).length}/${mcqQuestions.length} MCQ answered` :
                `${Object.keys(essayAnswers).filter(idx => (essayAnswers[parseInt(idx)] || '').trim().length >= 50).length}/${essayQuestions.length} essays answered`
              }
            </div>

            {currentPhase === 'mcq' && currentQuestionIndex === mcqQuestions.length - 1 && essayQuestions.length === 0 ? (
              <Button
                onClick={handleSubmit}
                disabled={Object.keys(answers).length !== mcqQuestions.length || isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit Quiz"}
              </Button>
            ) : currentPhase === 'essay' && currentQuestionIndex === essayQuestions.length - 1 ? (
              <Button
                onClick={() => setShowSubmitConfirmation(true)}
                disabled={Object.keys(essayAnswers).filter(idx => (essayAnswers[parseInt(idx)] || '').trim().length >= 50).length !== essayQuestions.length || isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit Interview"}
                {recordedChunksRef.current.length === 0 && (
                  <span className="ml-2 text-xs text-red-500">(Recording Required)</span>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={
                  currentPhase === 'mcq' ? !answers[currentQuestionIndex] :
                  currentPhase === 'essay' ? ((essayAnswers[currentQuestionIndex] || '').trim().length < 50) :
                  false
                }
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
          </CardContent>
          </Card>

          {/* Video Recording Section - Right Side */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Interview Recording
                {recordedBlob && recordedBlob.size > 0 && (
                  <Badge variant="default" className="text-xs bg-green-500">
                    ✓ Recorded
                  </Badge>
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Record your screen and audio during the interview questions
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Webcam Preview Overlay */}
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                {!hasPermissions ? (
                  <div className="flex items-center justify-center h-full text-white">
                    <div className="text-center">
                      <Video className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <p className="text-lg">Screen, camera, and microphone access required</p>
                      <Button onClick={requestPermissions} className="mt-4">
                        Enable Recording
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Webcam Preview - Main area (large) */}
                    {hasPermissions && cameraEnabled ? (
                      <video
                        ref={webcamVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                        style={{ backgroundColor: 'black' }}
                      />
                    ) : hasPermissions && screenEnabled ? (
                      <video
                        ref={screenVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                        style={{ backgroundColor: 'black' }}
                      />
                    ) : hasPermissions ? (
                      <div className="flex items-center justify-center h-full bg-gray-900 text-white">
                        <div className="text-center">
                          <Monitor className="h-16 w-16 mx-auto mb-4 opacity-50" />
                          <p className="text-lg">Setting up camera and screen preview...</p>
                          <p className="text-sm opacity-75 mt-2">Recording will combine both streams</p>
                        </div>
                      </div>
                    ) : null}


                    {/* Recording indicator */}
                    {isRecording && (
                      <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full text-sm">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                        REC
                        <span className="ml-2">{formatTime(recordingTime)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Recording Controls */}
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    variant={screenEnabled ? "default" : "outline"}
                    size="sm"
                    disabled
                    className="flex-1"
                  >
                    <Monitor className="h-4 w-4 mr-2" />
                    Screen {screenEnabled ? '✓' : '✗'}
                  </Button>
                  <Button
                    variant={cameraEnabled ? "default" : "outline"}
                    size="sm"
                    disabled
                    className="flex-1"
                  >
                    {cameraEnabled ? <Camera className="h-4 w-4 mr-2" /> : <VideoOff className="h-4 w-4 mr-2" />}
                    Webcam
                  </Button>
                  <Button
                    variant={micEnabled ? "default" : "outline"}
                    size="sm"
                    disabled
                    className="flex-1"
                  >
                    {micEnabled ? <Mic className="h-4 w-4 mr-2" /> : <MicOff className="h-4 w-4 mr-2" />}
                    Audio
                  </Button>
                </div>

                {/* Recording controls removed - recording starts automatically */}

                {/* Recording Status Display */}
                <div className="text-center">
                  <div className="text-lg font-mono font-semibold text-primary">
                    {formatTime(recordingTime)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {isRecording ? (isPaused ? 'Recording Paused' : 'Recording Active') : 'Setting up recording...'}
                  </div>
                </div>

                {/* Download recorded video */}
                {recordedBlob && recordedBlob.size > 0 && recordedVideoUrl && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm text-green-800 font-medium">
                          ✓ Recording saved ({formatTime(recordingTime)}, {(recordedBlob.size / 1024 / 1024).toFixed(2)}MB)
                        </p>
                        <p className="text-xs text-green-600 mt-1">
                          Combined screen video + microphone audio
                        </p>
                        {isUploading && (
                          <p className="text-xs text-blue-600 mt-1 flex items-center">
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2"></div>
                            Uploading to server...
                          </p>
                        )}
                        {uploadedVideoFilename && !isUploading && (
                          <p className="text-xs text-green-700 mt-1">
                            ✓ Uploaded to MongoDB GridFS
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {recordingError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <p className="text-sm text-red-800 font-medium">
                        {recordingError}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default InterviewQuiz;