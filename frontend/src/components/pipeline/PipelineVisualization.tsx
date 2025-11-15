import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, User, FileText, Calendar, ChevronRight, CheckCircle, Clock, XCircle, AlertCircle, Trophy, Video } from "lucide-react";
import { cn } from "@/lib/utils";

const PIPELINE_STAGES = [
  { id: "hr", label: "Screening Test", color: "bg-purple-500" },
  { id: "written_test", label: "Demo Round", color: "bg-orange-500" },
  { id: "demo_schedule", label: "Panel Interview", color: "bg-green-500" },
  { id: "confirmation", label: "HR Approval", color: "bg-blue-500" },
  { id: "offer_letter", label: "Offer Letter", color: "bg-pink-500" },
  { id: "onboarding", label: "Onboarding", color: "bg-teal-500" },
];

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "in_progress", label: "InProgress" },
  { value: "hr", label: "Screening Test" },
  { value: "written_test", label: "Demo Round" },
  { value: "demo_schedule", label: "Panel Interview" },
  { value: "placed", label: "Placed" },
  { value: "rejected", label: "Rejected" },
  { value: "completed", label: "Completed" },
];

export const PipelineVisualization = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: candidates, isLoading } = useQuery({
    queryKey: ["pipeline-candidates", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("candidates")
        .select(`
          *,
          jobs (
            id,
            position,
            department
          )
        `)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch all interview results from MongoDB at once
      let allInterviewResults: any[] = [];
      try {
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3002';
        const response = await fetch(`${apiBaseUrl}/interview-results`);
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            allInterviewResults = result.data;
          }
        }
      } catch (error) {
        console.warn('Failed to fetch interview results:', error);
      }

      // Create a map of candidate email to their latest interview result
      const interviewResultsMap: Record<string, any> = {};
      allInterviewResults.forEach(result => {
        if (result.candidate_email) {
          // If we don't have a result for this email, or this result is newer, use it
          if (!interviewResultsMap[result.candidate_email] ||
              new Date(result.created_at) > new Date(interviewResultsMap[result.candidate_email].created_at)) {
            interviewResultsMap[result.candidate_email] = result;
          }
        }
      });

      // Attach interview results to candidates by matching emails
      return data.map(candidate => ({
        ...candidate,
        interview_result: interviewResultsMap[candidate.email] || null
      }));
    },
  });

  // Filter by search query
  const filteredCandidates = candidates?.filter((candidate: any) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      candidate.full_name?.toLowerCase().includes(search) ||
      candidate.email?.toLowerCase().includes(search) ||
      candidate.jobs?.position?.toLowerCase().includes(search)
    );
  });

  const getCandidateStageIndex = (status: string) => {
    return PIPELINE_STAGES.findIndex((stage) => stage.id === status);
  };

  const getStageStatus = (candidateStatus: string, stageId: string) => {
    const candidateIndex = getCandidateStageIndex(candidateStatus);
    const stageIndex = PIPELINE_STAGES.findIndex((s) => s.id === stageId);

    if (stageIndex < candidateIndex) return "completed";
    if (stageIndex === candidateIndex) return "current";
    return "pending";
  };

  const getStageIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "current":
        return <Clock className="h-4 w-4 text-orange-500" />;
      case "pending":
        return <AlertCircle className="h-4 w-4 text-gray-300" />;
      default:
        return null;
    }
  };

  // Calculate stats
  const stats = {
    all: candidates?.length || 0,
    inProgress: candidates?.filter((c: any) => 
      ["hr", "written_test", "demo_schedule"].includes(c.status)
    ).length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search by name, email, or position..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4 flex-wrap">
            {STATUS_FILTERS.map((filter) => (
              <Button
                key={filter.value}
                variant={statusFilter === filter.value ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(filter.value)}
              >
                {filter.label}
                {filter.value === "all" && <Badge variant="secondary" className="ml-2">{stats.all}</Badge>}
                {filter.value === "in_progress" && <Badge variant="secondary" className="ml-2">{stats.inProgress}</Badge>}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pipeline View */}
      <Card>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredCandidates && filteredCandidates.length > 0 ? (
            <div className="space-y-4">
              {/* Header */}
              <div className="grid grid-cols-[200px_1fr] gap-4 pb-4 border-b">
                <div className="font-semibold text-sm text-muted-foreground">Candidate</div>
                <div className="font-semibold text-sm text-muted-foreground">Pipeline</div>
              </div>

              {/* Candidates */}
              <div className="space-y-6">
                {filteredCandidates.map((candidate: any) => (
                  <div
                    key={candidate.id}
                    className="grid grid-cols-[200px_1fr] gap-4 items-center"
                  >
                    {/* Candidate Info */}
                    <div 
                      className="space-y-2 cursor-pointer group"
                      onClick={() => navigate(`/profiles/${candidate.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {candidate.full_name?.charAt(0).toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                            {candidate.full_name}
                          </div>
                          {candidate.ai_match_score && (
                            <div className="text-sm text-muted-foreground">
                              AI Match: {candidate.ai_match_score}%
                            </div>
                          )}
                          {candidate.interview_result && (
                            <div className="flex items-center gap-1 mt-1">
                              <Trophy className="h-3 w-3 text-primary" />
                              <Badge
                                variant={candidate.interview_result.score >= 70 ? "default" : candidate.interview_result.score >= 50 ? "secondary" : "destructive"}
                                className="text-xs"
                              >
                                Interview: {candidate.interview_result.score}%
                              </Badge>
                            </div>
                          )}
                          {candidate.interview_result?.video_recorded && (
                            <div className="flex items-center gap-1 mt-1">
                              <Video className="h-3 w-3 text-blue-500" />
                              <span className="text-xs text-muted-foreground">Video Recorded</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        <FileText className="h-3 w-3" />
                      </div>
                    </div>

                    {/* Pipeline Stages */}
                    <div className="relative">
                      <div className="flex items-center gap-2">
                        {PIPELINE_STAGES.map((stage, index) => {
                          const status = getStageStatus(candidate.status, stage.id);
                          const isLast = index === PIPELINE_STAGES.length - 1;

                          return (
                            <div key={stage.id} className="flex items-center flex-1">
                              {/* Stage Node */}
                              <div className="relative flex flex-col items-center flex-1">
                                {/* Stage Circle */}
                                <div
                                  className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center border-2 relative z-10",
                                    status === "completed" && "bg-green-500 border-green-500",
                                    status === "current" && cn("border-orange-500", stage.color),
                                    status === "pending" && "bg-gray-100 border-gray-300"
                                  )}
                                >
                                  {status === "completed" ? (
                                    <CheckCircle className="h-4 w-4 text-white" />
                                  ) : status === "current" ? (
                                    <div className="w-3 h-3 rounded-full bg-white" />
                                  ) : (
                                    <Clock className="h-4 w-4 text-gray-400" />
                                  )}
                                </div>

                                {/* Stage Label */}
                                <div className="mt-2 text-xs text-center">
                                  <div className="font-medium whitespace-nowrap">{stage.label}</div>
                                  {status === "current" && (
                                    <Badge variant="secondary" className="mt-1 text-xs">
                                      In Progress
                                    </Badge>
                                  )}
                                </div>

                                {/* Connection Line */}
                                {!isLast && (
                                  <div
                                    className={cn(
                                      "absolute left-[calc(50%+16px)] top-4 h-0.5 w-[calc(100%-16px)]",
                                      status === "completed" ? "bg-green-500" : "bg-gray-200"
                                    )}
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No candidates found matching your filters
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
