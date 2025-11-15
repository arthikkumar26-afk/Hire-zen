import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Clock, CheckCircle, AlertCircle, Trophy, Video, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import TopNavBar from "@/components/layout/TopNavBar";
import Sidebar from "@/components/layout/Sidebar";
import { PipelineVisualization } from "@/components/pipeline/PipelineVisualization";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import InterviewDetailsModal from "@/components/pipeline/InterviewDetailsModal";

interface InterviewResult {
  id: string;
  candidate_id: string;
  candidate_name: string;
  candidate_email: string;
  job_position: string;
  score: number;
  status: string;
  completed_at: string;
  video_url: string | null;
  questions: any[];
  answers: any[];
  evaluation: any;
  video_analysis?: any;
  mcq_score: number;
  essay_score: number;
  total_questions: number;
  video_recorded: boolean;
}

const WrittenTest = () => {
  const [selectedInterview, setSelectedInterview] = useState<InterviewResult | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch interview results from MongoDB
  const { data: interviewResults, isLoading: interviewsLoading } = useQuery({
    queryKey: ["written-test-interview-results"],
    queryFn: async () => {
      const response = await fetch(`http://localhost:3002/interview-results`);
      if (!response.ok) throw new Error('Failed to fetch interview results');
      const result = await response.json();
      if (result.success) {
        return result.data as InterviewResult[];
      }
      return [];
    },
  });

  const openInterviewDetails = async (interview: InterviewResult) => {
    // For MongoDB data, we need to fetch the detailed interview data
    if (!interview.questions || !interview.answers || !interview.evaluation) {
      try {
        // Fetch detailed data from MongoDB if not available
        const response = await fetch(`http://localhost:3002/interview-results/${interview.id}`);
        if (response.ok) {
          const detailedData = await response.json();
          if (detailedData.success) {
            setSelectedInterview({
              ...interview,
              ...detailedData.data,
              // Ensure we have the right field names
              questions: detailedData.data.questions || interview.questions || [],
              answers: detailedData.data.answers || interview.answers || [],
              evaluation: detailedData.data.evaluation || interview.evaluation || {}
            });
          } else {
            setSelectedInterview(interview);
          }
        } else {
          setSelectedInterview(interview);
        }
      } catch (error) {
        console.warn('Failed to fetch detailed interview data:', error);
        setSelectedInterview(interview);
      }
    } else {
      setSelectedInterview(interview);
    }
    setIsModalOpen(true);
  };

  const passedInterviews = interviewResults?.filter(i => i.score >= 50) || [];
  const failedInterviews = interviewResults?.filter(i => i.score < 50) || [];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNavBar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="ml-0 lg:ml-56 flex-1 p-4 lg:p-8 bg-slate-50 dark:bg-slate-950">
          <div className="container mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Written Test Results</h1>
                <p className="text-muted-foreground mt-1">Review AI interview performance and candidate evaluations</p>
              </div>
              <Button>
                <FileText className="h-4 w-4 mr-2" />
                Schedule Test
              </Button>
            </div>

            {/* Interview Results Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-8 w-8 text-green-500" />
                    <div>
                      <p className="text-2xl font-bold text-green-600">{passedInterviews.length}</p>
                      <p className="text-sm text-muted-foreground">Passed (≥50%)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-8 w-8 text-red-500" />
                    <div>
                      <p className="text-2xl font-bold text-red-600">{failedInterviews.length}</p>
                      <p className="text-sm text-muted-foreground">{`Failed (< 50%)`}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <Trophy className="h-8 w-8 text-blue-500" />
                    <div>
                      <p className="text-2xl font-bold text-blue-600">
                        {interviewResults ? Math.round(interviewResults.reduce((sum, r) => sum + r.score, 0) / interviewResults.length) : 0}%
                      </p>
                      <p className="text-sm text-muted-foreground">Avg Score</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Passed Candidates */}
            {passedInterviews.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    Passed Candidates
                  </CardTitle>
                  <CardDescription>
                    Candidates who scored 50% or above in the written test
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {interviewsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {passedInterviews.map((interview) => (
                        <div
                          key={interview.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <h4 className="font-semibold">{interview.candidate_name}</h4>
                              <p className="text-sm text-muted-foreground">{interview.candidate_email}</p>
                              <p className="text-sm text-muted-foreground">{interview.job_position}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="default" className="flex items-center gap-1">
                                <Trophy className="h-3 w-3" />
                                {interview.score}%
                              </Badge>
                              {interview.video_recorded && (
                                <Badge variant="secondary" className="flex items-center gap-1">
                                  <Video className="h-3 w-3" />
                                  Recorded
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openInterviewDetails(interview)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Failed Candidates */}
            {failedInterviews.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="h-5 w-5" />
                    Failed Candidates
                  </CardTitle>
                  <CardDescription>
                    Candidates who scored below 50% in the written test
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {failedInterviews.map((interview) => (
                      <div
                        key={interview.id}
                        className="flex items-center justify-between p-4 border rounded-lg border-red-200 bg-red-50/50 dark:bg-red-950/10 hover:bg-red-100/50 dark:hover:bg-red-950/20 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <h4 className="font-semibold text-red-700 dark:text-red-300">{interview.candidate_name}</h4>
                            <p className="text-sm text-muted-foreground">{interview.candidate_email}</p>
                            <p className="text-sm text-muted-foreground">{interview.job_position}</p>
                          </div>
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <Trophy className="h-3 w-3" />
                            {interview.score}%
                          </Badge>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openInterviewDetails(interview)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Pipeline Visualization */}
            <Card>
              <CardHeader>
                <CardTitle>Live Pipeline Status</CardTitle>
                <CardDescription>
                  Track candidates through the entire recruitment process. Candidates who pass interviews automatically move to the next stage.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PipelineVisualization />
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      <InterviewDetailsModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        interview={selectedInterview}
      />
    </div>
  );
};

export default WrittenTest;
