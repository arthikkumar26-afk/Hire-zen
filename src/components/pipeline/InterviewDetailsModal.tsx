import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Video, User, Mail, Briefcase, TrendingUp, TrendingDown, Download, Brain, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useToast } from "@/hooks/use-toast";
import { VideoAnalysisCard } from "./VideoAnalysisCard";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

interface InterviewDetailsModalProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   interview: {
     id?: string;
     candidate_name: string;
     candidate_email: string;
     job_position: string;
     score: number;
     video_url?: string | null;
     has_video?: boolean;
     questions: any[];
     answers: any[];
     evaluation: any;
     video_analysis?: any;
     mcq_score?: number;
     essay_score?: number;
     total_questions?: number;
     video_recorded?: boolean;
     _id?: string; // MongoDB ObjectId
   } | null;
 }

const InterviewDetailsModal = ({ open, onOpenChange, interview }: InterviewDetailsModalProps) => {
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  if (!interview) return null;

  const evaluation = interview.evaluation || {};

  const handleVideoAnalysis = async () => {
    if (!interview.id) return;
    
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-interview-video', {
        body: { interviewId: interview.id }
      });

      if (error) throw error;

      toast({
        title: "Analysis Complete",
        description: "Video analysis has been completed successfully.",
      });

      // Refresh the interview data
      window.location.reload();
    } catch (error) {
      console.error('Error analyzing video:', error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze video",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPos = 20;

      // Title
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("Interview Results Report", pageWidth / 2, yPos, { align: "center" });
      yPos += 15;

      // Candidate Profile Section
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Candidate Profile", 14, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Name: ${interview.candidate_name}`, 14, yPos);
      yPos += 6;
      doc.text(`Email: ${interview.candidate_email}`, 14, yPos);
      yPos += 6;
      doc.text(`Position Applied: ${interview.job_position}`, 14, yPos);
      yPos += 6;
      doc.text(`Overall Score: ${interview.score}%`, 14, yPos);
      yPos += 12;

      // Strengths Section
      if (evaluation.strengths && evaluation.strengths.length > 0) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(34, 197, 94); // green
        doc.text("Strengths", 14, yPos);
        yPos += 7;

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        evaluation.strengths.forEach((strength: string, idx: number) => {
          const lines = doc.splitTextToSize(`${idx + 1}. ${strength}`, pageWidth - 28);
          lines.forEach((line: string) => {
            if (yPos > 270) {
              doc.addPage();
              yPos = 20;
            }
            doc.text(line, 14, yPos);
            yPos += 5;
          });
        });
        yPos += 5;
      }

      // Weaknesses Section
      if (evaluation.weaknesses && evaluation.weaknesses.length > 0) {
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(249, 115, 22); // orange
        doc.text("Areas for Improvement", 14, yPos);
        yPos += 7;

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        evaluation.weaknesses.forEach((weakness: string, idx: number) => {
          const lines = doc.splitTextToSize(`${idx + 1}. ${weakness}`, pageWidth - 28);
          lines.forEach((line: string) => {
            if (yPos > 270) {
              doc.addPage();
              yPos = 20;
            }
            doc.text(line, 14, yPos);
            yPos += 5;
          });
        });
        yPos += 5;
      }

      // Overall Assessment
      if (evaluation.summary) {
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text("Overall Assessment", 14, yPos);
        yPos += 7;

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        const summaryLines = doc.splitTextToSize(evaluation.summary, pageWidth - 28);
        summaryLines.forEach((line: string) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }
          doc.text(line, 14, yPos);
          yPos += 5;
        });
        yPos += 10;
      }

      // Questions & Answers Section
      if (evaluation.answerEvaluations && evaluation.answerEvaluations.length > 0) {
        doc.addPage();
        yPos = 20;
        
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text("Questions & Answers", 14, yPos);
        yPos += 10;

        evaluation.answerEvaluations.forEach((answer: any, idx: number) => {
          const question = interview.questions[answer.questionIndex];
          const candidateAnswer = interview.answers[answer.questionIndex];
          const isCorrect = answer.score >= 70;

          if (yPos > 240) {
            doc.addPage();
            yPos = 20;
          }

          // Question
          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(0, 0, 0);
          const questionText = `Q${answer.questionIndex + 1}. ${question?.question}`;
          const questionLines = doc.splitTextToSize(questionText, pageWidth - 28);
          questionLines.forEach((line: string) => {
            doc.text(line, 14, yPos);
            yPos += 6;
          });

          // Score badge
          doc.setFontSize(9);
          doc.setFillColor(isCorrect ? 34 : 249, isCorrect ? 197 : 115, isCorrect ? 94 : 22);
          doc.setTextColor(255, 255, 255);
          doc.roundedRect(pageWidth - 40, yPos - 5, 26, 6, 2, 2, "F");
          doc.text(`${answer.score}%`, pageWidth - 27, yPos, { align: "center" });
          yPos += 8;

          // Candidate's Answer
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(0, 0, 0);
          doc.text("Candidate's Answer:", 14, yPos);
          yPos += 5;

          doc.setFont("helvetica", "normal");
          const answerLines = doc.splitTextToSize(candidateAnswer?.answer || "No answer", pageWidth - 28);
          answerLines.forEach((line: string) => {
            if (yPos > 270) {
              doc.addPage();
              yPos = 20;
            }
            doc.text(line, 14, yPos);
            yPos += 5;
          });
          yPos += 3;

          // Feedback
          if (answer.feedback) {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(34, 197, 94);
            doc.text("Good Points:", 14, yPos);
            yPos += 5;

            doc.setFont("helvetica", "normal");
            doc.setTextColor(0, 0, 0);
            const feedbackLines = doc.splitTextToSize(answer.feedback, pageWidth - 28);
            feedbackLines.forEach((line: string) => {
              if (yPos > 270) {
                doc.addPage();
                yPos = 20;
              }
              doc.text(line, 14, yPos);
              yPos += 5;
            });
            yPos += 2;
          }

          // Improvements
          if (answer.improvements) {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(249, 115, 22);
            doc.text("Areas to Improve:", 14, yPos);
            yPos += 5;

            doc.setFont("helvetica", "normal");
            doc.setTextColor(0, 0, 0);
            const improvementLines = doc.splitTextToSize(answer.improvements, pageWidth - 28);
            improvementLines.forEach((line: string) => {
              if (yPos > 270) {
                doc.addPage();
                yPos = 20;
              }
              doc.text(line, 14, yPos);
              yPos += 5;
            });
          }

          yPos += 10;
        });
      }

      // Save the PDF
      const fileName = `Interview_${interview.candidate_name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;
      doc.save(fileName);

      toast({
        title: "PDF Exported",
        description: "Interview results have been saved successfully.",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Export Failed",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl">Interview Details</DialogTitle>
            <div className="flex gap-2">
              {interview.video_url && !interview.video_analysis && (
                <Button 
                  onClick={handleVideoAnalysis} 
                  variant="outline" 
                  size="sm"
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-2" />
                      Analyze Video
                    </>
                  )}
                </Button>
              )}
              <Button onClick={exportToPDF} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <ScrollArea className="h-[calc(90vh-8rem)]">
          <div className="space-y-6 pr-4">
            {/* Candidate Profile */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Candidate Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-semibold">{interview.candidate_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Position Applied</p>
                    <p className="font-semibold flex items-center gap-1">
                      <Briefcase className="h-4 w-4" />
                      {interview.job_position}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-semibold flex items-center gap-1">
                      <Mail className="h-4 w-4" />
                      {interview.candidate_email}
                    </p>
                  </div>
                </div>
                
                <div className="pt-2">
                  <p className="text-sm text-muted-foreground mb-2">Overall Score</p>
                  <div className="flex items-center gap-3">
                    <Progress value={interview.score} className="flex-1" />
                    <Badge 
                      variant={interview.score >= 70 ? "default" : interview.score >= 50 ? "secondary" : "destructive"}
                      className="text-lg px-3"
                    >
                      {interview.score}%
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Interview Recording */}
            {(interview.video_url || interview.has_video) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Video className="h-5 w-5" />
                    Interview Recording
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {interview.video_url ? (
                    <video
                      src={interview.video_url}
                      controls
                      className="w-full rounded-lg bg-black"
                    />
                  ) : interview.has_video ? (
                    <video
                      src={`http://localhost:3002/activity-logs/${interview.id || interview._id}/video`}
                      controls
                      className="w-full rounded-lg bg-black"
                    />
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Video file is stored but cannot be displayed at this time.
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Video Analysis */}
            {interview.video_analysis && (
              <VideoAnalysisCard analysis={interview.video_analysis} />
            )}

            {/* Strengths & Weaknesses */}
            <div className="grid md:grid-cols-2 gap-4">
              {evaluation.strengths && evaluation.strengths.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-green-600">
                      <TrendingUp className="h-5 w-5" />
                      Strengths
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {evaluation.strengths.map((strength: string, index: number) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {evaluation.weaknesses && evaluation.weaknesses.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-orange-600">
                      <TrendingDown className="h-5 w-5" />
                      Areas for Improvement
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {evaluation.weaknesses.map((weakness: string, index: number) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <XCircle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                          <span>{weakness}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Overall Assessment */}
            {evaluation.summary && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Overall Assessment</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{evaluation.summary}</p>
                </CardContent>
              </Card>
            )}

            {/* Questions & Answers */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Questions & Answers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {evaluation.answerEvaluations?.map((answer: any, idx: number) => {
                    const question = interview.questions[answer.questionIndex];
                    const candidateAnswer = interview.answers[answer.questionIndex];
                    const isCorrect = answer.score >= 70;
                    
                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-lg border-2 ${
                          isCorrect 
                            ? 'border-green-200 bg-green-50 dark:bg-green-950/20' 
                            : 'border-orange-200 bg-orange-50 dark:bg-orange-950/20'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <h6 className="font-semibold text-sm flex-1">
                            Q{answer.questionIndex + 1}. {question?.question}
                          </h6>
                          <div className="flex items-center gap-2">
                            <Badge variant={isCorrect ? "default" : "secondary"}>
                              {answer.score}%
                            </Badge>
                            {isCorrect ? (
                              <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
                            ) : (
                              <XCircle className="h-6 w-6 text-orange-600 flex-shrink-0" />
                            )}
                          </div>
                        </div>
                        
                        <div className="space-y-3 text-sm">
                          <div className="bg-background/50 p-3 rounded">
                            <p className="font-medium text-muted-foreground mb-1">Candidate's Answer:</p>
                            <p className="text-foreground">{candidateAnswer?.answer}</p>
                          </div>
                          
                          {answer.feedback && (
                            <div className="flex items-start gap-2 text-green-700 dark:text-green-400">
                              <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                              <div>
                                <strong>Good Points:</strong>
                                <p className="mt-1">{answer.feedback}</p>
                              </div>
                            </div>
                          )}
                          
                          {answer.improvements && (
                            <div className="flex items-start gap-2 text-orange-700 dark:text-orange-400">
                              <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                              <div>
                                <strong>Areas to Improve:</strong>
                                <p className="mt-1">{answer.improvements}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default InterviewDetailsModal;
