import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ExamTimer } from "@/components/exam/ExamTimer";
import { ExamVideoRecorder } from "@/components/exam/ExamVideoRecorder";
import { PreExamCheck } from "@/components/exam/PreExamCheck";
import { ChevronLeft, ChevronRight, CheckCircle, Clock, AlertTriangle, Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface Question {
  question: string;
  category: string;
  type: 'mcq' | 'written';
  options?: string[];
  expectedAnswer: string;
  difficulty?: string;
  evaluationCriteria?: string[];
}

const Exam = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [booking, setBooking] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [job, setJob] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionOrder, setQuestionOrder] = useState<number[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [examStarted, setExamStarted] = useState(false);
  const [preExamComplete, setPreExamComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [recordingStarted, setRecordingStarted] = useState(false);
  
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (token) {
      loadExamData();
    }
  }, [token]);

  // Check deadline periodically
  useEffect(() => {
    if (!booking?.deadline_at) return;

    const checkDeadline = () => {
      const deadline = new Date(booking.deadline_at);
      const now = new Date();
      if (deadline < now && booking.status !== 'completed' && booking.status !== 'expired') {
        toast({
          title: "Exam Deadline Passed",
          description: "The deadline for this exam has passed. Please contact HR.",
          variant: "destructive",
        });
      }
    };

    const interval = setInterval(checkDeadline, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [booking]);

  // Auto-save answers every 30 seconds
  useEffect(() => {
    if (examStarted && sessionIdRef.current) {
      autoSaveIntervalRef.current = setInterval(() => {
        saveAnswers();
      }, 30000); // 30 seconds

      return () => {
        if (autoSaveIntervalRef.current) {
          clearInterval(autoSaveIntervalRef.current);
        }
      };
    }
  }, [examStarted, answers]);

  const loadExamData = async () => {
    try {
      // Load booking
      const { data: bookingData, error: bookingError } = await supabase
        .from("exam_bookings")
        .select(`
          *,
          candidates (*),
          jobs (*)
        `)
        .eq("exam_token", token)
        .single();

      if (bookingError) throw bookingError;
      if (!bookingData) {
        toast({
          title: "Exam Not Found",
          description: "This exam link is invalid or has expired.",
          variant: "destructive",
        });
        return;
      }

      setBooking(bookingData);
      setJob(bookingData.jobs);

      // Check deadline
      if (bookingData.deadline_at) {
        const deadline = new Date(bookingData.deadline_at);
        const now = new Date();
        if (deadline < now && bookingData.status !== 'completed') {
          toast({
            title: "Exam Deadline Passed",
            description: "The deadline for this exam has passed. Please contact HR for assistance.",
            variant: "destructive",
          });
          return;
        }
      }

      // Check if exam has started
      if (bookingData.status === 'in_progress' || bookingData.status === 'completed') {
        setExamStarted(true);
        setPreExamComplete(true);
      }

      // Load or create session
      const { data: sessionData } = await supabase
        .from("exam_sessions")
        .select("*")
        .eq("booking_id", bookingData.id)
        .single();

      if (sessionData) {
        setSession(sessionData);
        sessionIdRef.current = sessionData.id;
        
        if (sessionData.questions) {
          setQuestions(sessionData.questions);
          setQuestionOrder(sessionData.question_order || []);
          setCurrentQuestionIndex(sessionData.current_question_index || 0);
          setAnswers(sessionData.answers || {});
        }
      }

      // Load questions if not in session
      if (!sessionData?.questions) {
        await loadQuestions(bookingData);
      }

    } catch (error: any) {
      console.error("Error loading exam:", error);
      toast({
        title: "Error",
        description: "Failed to load exam data.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadQuestions = async (bookingData: any) => {
    try {
      // Generate questions using exam question generator
      const { data: questionData, error: questionError } = await supabase.functions.invoke("generate-exam-questions", {
        body: {
          jobId: bookingData.job_id,
          jobDescription: bookingData.jobs?.job_description || "",
          position: bookingData.jobs?.position || "",
          examDurationMinutes: bookingData.duration_minutes || 60,
        },
      });

      if (questionError) throw questionError;

      const generatedQuestions = questionData.questions || [];
      
      // Randomize question order
      const order = Array.from({ length: generatedQuestions.length }, (_, i) => i)
        .sort(() => Math.random() - 0.5);
      
      setQuestions(generatedQuestions);
      setQuestionOrder(order);

      // Create or update session
      await createOrUpdateSession(generatedQuestions, order);
    } catch (error: any) {
      console.error("Error loading questions:", error);
      toast({
        title: "Error",
        description: "Failed to load exam questions.",
        variant: "destructive",
      });
    }
  };

  const createOrUpdateSession = async (questions: Question[], order: number[]) => {
    if (!booking || !token) return;

    const sessionData = {
      booking_id: booking.id,
      exam_token: token,
      questions: questions,
      question_order: order,
      current_question_index: 0,
      answers: answers || {},
      time_remaining_seconds: booking.time_limit_seconds,
      started_at: examStarted ? new Date().toISOString() : null,
      recording_started: false,
    };

    const { data, error } = await supabase
      .from("exam_sessions")
      .upsert(sessionData, { onConflict: "booking_id" })
      .select()
      .single();

    if (error) {
      console.error("Error creating session:", error);
      return;
    }

    setSession(data);
    sessionIdRef.current = data.id;
  };

  const startExam = async () => {
    if (!booking || !session) return;

    try {
      // Update booking status
      await supabase
        .from("exam_bookings")
        .update({
          status: 'in_progress',
          actual_start_time: new Date().toISOString(),
        })
        .eq("id", booking.id);

      // Update session
      await supabase
        .from("exam_sessions")
        .update({
          started_at: new Date().toISOString(),
          time_remaining_seconds: booking.time_limit_seconds,
        })
        .eq("id", session.id);

      setExamStarted(true);
      setRecordingStarted(true); // Trigger video recording
      
      toast({
        title: "Exam Started",
        description: "Your exam has begun. Video recording has started. Good luck!",
      });
    } catch (error: any) {
      console.error("Error starting exam:", error);
      toast({
        title: "Error",
        description: "Failed to start exam.",
        variant: "destructive",
      });
    }
  };

  const saveAnswers = async () => {
    if (!sessionIdRef.current || !booking) return;

    try {
      await supabase
        .from("exam_sessions")
        .update({
          answers: answers,
          current_question_index: currentQuestionIndex,
          time_remaining_seconds: booking.time_limit_seconds,
          last_activity: new Date().toISOString(),
        })
        .eq("id", sessionIdRef.current);
    } catch (error) {
      console.error("Error saving answers:", error);
    }
  };

  const handleAnswerChange = (questionIndex: number, answer: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionIndex]: answer,
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      saveAnswers();
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleTimeUp = async () => {
    toast({
      title: "Time's Up!",
      description: "Your exam time has expired. Submitting automatically...",
      variant: "destructive",
    });
    await submitExam(true);
  };

  const handleWarning = (percentage: number) => {
    if (percentage === 25) {
      toast({
        title: "25% Time Remaining",
        description: "You have 25% of your time left.",
      });
    } else if (percentage === 10) {
      toast({
        title: "10% Time Remaining",
        description: "Please review and submit soon!",
        variant: "destructive",
      });
    } else if (percentage === 5) {
      toast({
        title: "5% Time Remaining",
        description: "Final warning! Submit your exam now!",
        variant: "destructive",
      });
    } else if (percentage === 1) {
      toast({
        title: "1 Minute Remaining",
        description: "Time is almost up! Submit immediately!",
        variant: "destructive",
      });
    }
  };

  const submitExam = async (autoSubmit: boolean = false) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Save final answers
      await saveAnswers();

      // Evaluate answers using exam-specific evaluation
      const { data: evaluation } = await supabase.functions.invoke("evaluate-exam-answers", {
        body: {
          examToken: token,
          questions: questions.map((q, idx) => ({
            question: q.question,
            category: q.category,
            type: q.type,
            expectedAnswer: q.expectedAnswer,
            difficulty: q.difficulty,
          })),
          answers: Object.entries(answers).map(([index, answer]) => {
            const qIndex = parseInt(index);
            const actualIndex = questionOrder[qIndex];
            return {
              question: questions[actualIndex]?.question || '',
              answer: answer || '',
            };
          }),
        },
      });

      // Update booking
      await supabase
        .from("exam_bookings")
        .update({
          status: 'completed',
          actual_end_time: new Date().toISOString(),
          score: evaluation?.evaluation?.overallScore || 0,
          evaluation_data: evaluation?.evaluation,
          passed: (evaluation?.evaluation?.overallScore || 0) >= 60,
        })
        .eq("id", booking.id);

      // Update session
      await supabase
        .from("exam_sessions")
        .update({
          submitted_at: new Date().toISOString(),
          auto_submitted: autoSubmit,
        })
        .eq("id", session.id);

      toast({
        title: "Exam Submitted",
        description: "Your exam has been submitted successfully.",
      });

      // Navigate to results or thank you page
      navigate(`/exam-results/${token}`);
    } catch (error: any) {
      console.error("Error submitting exam:", error);
      toast({
        title: "Error",
        description: "Failed to submit exam. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentQuestion = questions[questionOrder[currentQuestionIndex]];
  const answeredCount = Object.keys(answers).length;
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Exam Not Found</AlertTitle>
              <AlertDescription>
                This exam link is invalid or has expired.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pre-exam check screen
  if (!preExamComplete) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4">
        <div className="max-w-4xl mx-auto py-8">
          <PreExamCheck
            onComplete={() => {
              setPreExamComplete(true);
              startExam();
            }}
          />
        </div>
      </div>
    );
  }

  // Exam not started yet
  if (!examStarted) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4">
        <div className="max-w-4xl mx-auto py-8">
          <Card>
            <CardHeader>
              <CardTitle>Screening Exam - Ready to Start</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p><strong>Position:</strong> {job?.position}</p>
                <p><strong>Duration:</strong> {booking.duration_minutes} minutes</p>
                <p><strong>Total Questions:</strong> {questions.length}</p>
              </div>
              
              <ExamVideoRecorder
                examSessionId={session?.id || booking.id}
                onRecordingStarted={startExam}
              />

              <Button
                onClick={startExam}
                size="lg"
                className="w-full"
                disabled={!session}
              >
                Start Exam
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Exam interface
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header with Timer */}
      <div className="sticky top-0 z-50 bg-white dark:bg-slate-800 border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{job?.position} - Screening Exam</h1>
              <p className="text-sm text-muted-foreground">
                Question {currentQuestionIndex + 1} of {questions.length}
              </p>
            </div>
            <div className="w-64">
              <ExamTimer
                totalSeconds={booking.time_limit_seconds}
                onTimeUp={handleTimeUp}
                onWarning={handleWarning}
              />
            </div>
          </div>
          <Progress value={progress} className="mt-4" />
          <div className="flex items-center justify-between mt-2 text-sm text-muted-foreground">
            <span>{answeredCount} of {questions.length} answered</span>
            <span className="flex items-center gap-1">
              <Save className="h-3 w-3" />
              Auto-saving...
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Questions Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Questions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {questions.map((_, index) => {
                    const actualIndex = questionOrder[index];
                    const isAnswered = answers[actualIndex];
                    const isCurrent = index === currentQuestionIndex;
                    
                    return (
                      <Button
                        key={index}
                        variant={isCurrent ? "default" : isAnswered ? "secondary" : "outline"}
                        className={cn(
                          "w-full justify-start",
                          isCurrent && "ring-2 ring-primary"
                        )}
                        onClick={() => {
                          setCurrentQuestionIndex(index);
                          saveAnswers();
                        }}
                      >
                        {isAnswered && <CheckCircle className="mr-2 h-4 w-4" />}
                        Question {index + 1}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Question Area */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {currentQuestion?.category && (
                      <Badge variant="outline" className="mr-2">
                        {currentQuestion.category}
                      </Badge>
                    )}
                    Question {currentQuestionIndex + 1}
                  </CardTitle>
                  {currentQuestion?.difficulty && (
                    <Badge>
                      {currentQuestion.difficulty}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <p className="text-lg font-medium mb-4">
                    {currentQuestion?.question}
                  </p>

                  {currentQuestion?.type === 'mcq' && currentQuestion.options && (
                    <RadioGroup
                      value={answers[questionOrder[currentQuestionIndex]] || ""}
                      onValueChange={(value) => handleAnswerChange(questionOrder[currentQuestionIndex], value)}
                    >
                      {currentQuestion.options.map((option, optIndex) => (
                        <div key={optIndex} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted cursor-pointer">
                          <RadioGroupItem value={option} id={`option-${optIndex}`} />
                          <Label htmlFor={`option-${optIndex}`} className="flex-1 cursor-pointer">
                            {option}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}

                  {currentQuestion?.type === 'written' && (
                    <Textarea
                      placeholder="Type your answer here..."
                      value={answers[questionOrder[currentQuestionIndex]] || ""}
                      onChange={(e) => handleAnswerChange(questionOrder[currentQuestionIndex], e.target.value)}
                      className="min-h-[300px]"
                    />
                  )}
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={currentQuestionIndex === 0}
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Previous
                  </Button>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => saveAnswers()}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Save
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setShowSubmitConfirm(true)}
                    >
                      Submit Exam
                    </Button>
                  </div>

                  <Button
                    variant="outline"
                    onClick={handleNext}
                    disabled={currentQuestionIndex === questions.length - 1}
                  >
                    Next
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Confirm Submission</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>Are you sure you want to submit your exam? This action cannot be undone.</p>
              <p className="text-sm text-muted-foreground">
                You have answered {answeredCount} out of {questions.length} questions.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowSubmitConfirm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setShowSubmitConfirm(false);
                    submitExam(false);
                  }}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Exam"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Exam;

