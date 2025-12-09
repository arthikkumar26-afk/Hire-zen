import { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, Video, VideoOff, Mic, MicOff, AlertCircle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ExamVideoRecorderProps {
  examSessionId: string;
  onRecordingStarted?: () => void;
  onRecordingStopped?: () => void;
  onError?: (error: string) => void;
}

export const ExamVideoRecorder = ({
  examSessionId,
  onRecordingStarted,
  onRecordingStopped,
  onError,
}: ExamVideoRecorderProps) => {
  const { toast } = useToast();
  
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'paused' | 'uploading' | 'completed'>('idle');
  
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const combinedStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const chunkUploadQueueRef = useRef<string[]>([]);
  const chunkIndexRef = useRef(0);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      stopAllStreams();
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  const stopAllStreams = () => {
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (combinedStreamRef.current) {
      combinedStreamRef.current.getTracks().forEach((track) => track.stop());
    }
  };

  const requestPermissions = useCallback(async () => {
    try {
      // Request screen capture
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: false
      });
      screenStreamRef.current = screenStream;

      // Request webcam and microphone
      const webcamStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });
      webcamStreamRef.current = webcamStream;

      // Combine streams for recording
      const combinedStream = new MediaStream();
      webcamStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));
      webcamStream.getAudioTracks().forEach(track => combinedStream.addTrack(track));
      screenStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));
      combinedStreamRef.current = combinedStream;

      // Setup video previews
      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = webcamStream;
        webcamVideoRef.current.play();
      }
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = screenStream;
        screenVideoRef.current.play();
      }

      setHasPermissions(true);
      
      // Handle screen share stop
      screenStream.getVideoTracks()[0].addEventListener('ended', () => {
        toast({
          title: "Screen sharing stopped",
          description: "Please restart screen sharing to continue recording.",
          variant: "destructive",
        });
        setHasPermissions(false);
      });

    } catch (error: any) {
      console.error("Error requesting permissions:", error);
      onError?.(error.message);
      toast({
        title: "Permission Error",
        description: "Failed to access camera, microphone, or screen. Please grant permissions.",
        variant: "destructive",
      });
    }
  }, [toast, onError]);

  const uploadChunk = async (chunk: Blob, chunkIndex: number): Promise<string | null> => {
    try {
      // Get booking_id from session
      const { data: sessionData } = await supabase
        .from('exam_sessions')
        .select('booking_id')
        .eq('id', examSessionId)
        .single();

      const bookingId = sessionData?.booking_id || examSessionId;
      const fileName = `exams/${bookingId}/chunk_${chunkIndex}_${Date.now()}.webm`;
      
      const { data, error } = await supabase.storage
        .from('exam-videos')
        .upload(fileName, chunk, {
          contentType: 'video/webm',
          upsert: false
        });

      if (error) throw error;
      
      return fileName;
    } catch (error: any) {
      console.error("Error uploading chunk:", error);
      return null;
    }
  };

  const startRecording = useCallback(async () => {
    if (!combinedStreamRef.current) {
      await requestPermissions();
      if (!combinedStreamRef.current) {
        return;
      }
    }

    try {
      recordedChunksRef.current = [];
      chunkIndexRef.current = 0;
      setRecordingTime(0);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingStatus('recording');

      // Determine MIME type
      let mimeType = 'video/webm;codecs=vp9,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }
      }

      const mediaRecorder = new MediaRecorder(combinedStreamRef.current, {
        mimeType,
      });

      // Record in 5-minute chunks for reliability
      mediaRecorder.start(300000); // 5 minutes = 300000ms

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
          
          // Upload chunk asynchronously
          const chunkIndex = chunkIndexRef.current++;
          const fileName = await uploadChunk(event.data, chunkIndex);
          if (fileName) {
            chunkUploadQueueRef.current.push(fileName);
            
            // Update exam session with chunk info
            if (fileName) {
              await supabase
                .from('exam_sessions')
                .update({
                  video_chunks: chunkUploadQueueRef.current,
                  recording_started: true
                })
                .eq('id', examSessionId)
                .then(({ error }) => {
                  if (error) console.error("Error updating session chunks:", error);
                });
            }
          }
        }
      };

      mediaRecorder.onstop = async () => {
        // Final upload and merge will happen on exam completion
        setRecordingStatus('completed');
        onRecordingStopped?.();
      };

      mediaRecorderRef.current = mediaRecorder;
      onRecordingStarted?.();

      // Start timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      toast({
        title: "Recording Started",
        description: "Your exam session is being recorded.",
      });
    } catch (error: any) {
      console.error("Error starting recording:", error);
      onError?.(error.message);
      toast({
        title: "Recording Error",
        description: "Failed to start recording. Please try again.",
        variant: "destructive",
      });
    }
  }, [examSessionId, requestPermissions, toast, onRecordingStarted, onRecordingStopped, onError]);

  const stopRecording = useCallback(async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingStatus('uploading');
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }

      // Merge all chunks and create final video
      if (recordedChunksRef.current.length > 0) {
        try {
          const finalBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          const fileName = `${examSessionId}/final_${Date.now()}.webm`;
          
          const { data, error } = await supabase.storage
            .from('exam-videos')
            .upload(fileName, finalBlob, {
              contentType: 'video/webm',
              upsert: false
            });

          if (error) throw error;

          // Get public URL
          const { data: urlData } = supabase.storage
            .from('exam-videos')
            .getPublicUrl(fileName);

          // Update exam booking with video URL
          await supabase
            .from('exam_bookings')
            .update({
              video_url: urlData.publicUrl,
              video_recorded: true
            })
            .eq('id', examSessionId);

          setRecordingStatus('completed');
          toast({
            title: "Recording Saved",
            description: "Your exam video has been saved successfully.",
          });
        } catch (error: any) {
          console.error("Error saving final video:", error);
          toast({
            title: "Upload Error",
            description: "Video recorded but upload failed. It will be uploaded later.",
            variant: "destructive",
          });
        }
      }
    }
  }, [examSessionId, toast]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Video Previews (Hidden during exam, visible in settings) */}
      <div className="hidden space-y-2">
        <video
          ref={webcamVideoRef}
          autoPlay
          muted
          playsInline
          className="w-full rounded-lg border"
        />
        <video
          ref={screenVideoRef}
          autoPlay
          muted
          playsInline
          className="w-full rounded-lg border"
        />
      </div>

      {/* Recording Status */}
      <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
        <div className="flex items-center gap-3">
          {isRecording ? (
            <>
              <div className="relative">
                <Video className="h-5 w-5 text-red-500" />
                <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              </div>
              <div>
                <div className="font-semibold">Recording</div>
                <div className="text-sm text-muted-foreground">{formatTime(recordingTime)}</div>
              </div>
            </>
          ) : hasPermissions ? (
            <>
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <div className="font-semibold">Ready to Record</div>
                <div className="text-sm text-muted-foreground">Click start when exam begins</div>
              </div>
            </>
          ) : (
            <>
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              <div>
                <div className="font-semibold">Permissions Required</div>
                <div className="text-sm text-muted-foreground">Grant camera, mic, and screen access</div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!hasPermissions && (
            <Button onClick={requestPermissions} variant="outline" size="sm">
              <Camera className="mr-2 h-4 w-4" />
              Grant Permissions
            </Button>
          )}
          {hasPermissions && !isRecording && (
            <Button onClick={startRecording} variant="default" size="sm">
              <Video className="mr-2 h-4 w-4" />
              Start Recording
            </Button>
          )}
          {isRecording && (
            <Badge variant="destructive" className="animate-pulse">
              ● Recording
            </Badge>
          )}
        </div>
      </div>

      {/* Status Messages */}
      {recordingStatus === 'uploading' && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
          Uploading video... Please wait.
        </div>
      )}
      {recordingStatus === 'completed' && (
        <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg text-sm">
          Video saved successfully!
        </div>
      )}
    </div>
  );
};

