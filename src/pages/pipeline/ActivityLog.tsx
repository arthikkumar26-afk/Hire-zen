import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRight, Briefcase, Clock, User, Search, Mail, Trophy, Video } from "lucide-react";
import TopNavBar from "@/components/layout/TopNavBar";
import Sidebar from "@/components/layout/Sidebar";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";

interface ActivityLog {
  id: string;
  candidate_name: string;
  candidate_email?: string;
  job_position: string | null;
  old_stage: string | null;
  new_stage: string;
  old_stage_label: string | null;
  new_stage_label: string;
  changed_by_name: string;
  created_at: string;
  interview_score?: number;
  interview_details?: any;
  has_video?: boolean;
  video_size?: number;
  server_logs_video?: {
    size_bytes: number;
    size_mb: string;
    stored_at: string;
  };
}

const ActivityLog = () => {
  // Enhanced filtering state
  const [emailFilter, setEmailFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");

  // Activity logs from MongoDB (primary data source for pipeline changes)
  const { data: activityLogs, isLoading: activityLogsLoading, refetch: refetchActivityLogs } = useQuery({
    queryKey: ["activity-logs-mongodb", emailFilter, stageFilter],
    queryFn: async () => {
      const filters: Record<string, string> = {};
      if (emailFilter) filters.candidate_email = emailFilter;
      if (stageFilter && stageFilter !== 'all') {
        if (stageFilter === 'interview') filters.new_stage = 'Interview Started';
        if (stageFilter === 'passed') filters.new_stage = 'Interview Passed';
        if (stageFilter === 'failed') filters.new_stage = 'Interview Failed';
      }

      const queryParams = new URLSearchParams();
      queryParams.append('limit', '100');
      Object.entries(filters).forEach(([key, value]) => {
        queryParams.append(key, value);
      });

      const response = await fetch(`http://localhost:3002/activity-logs?${queryParams.toString()}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.success ? result.data : [];
    },
  });

  // Filter activity logs by status
  const interviewActivities = activityLogs?.filter(log =>
    log.new_stage?.includes('Interview') || log.interview_score
  ) || [];

  const passedActivities = interviewActivities.filter(log =>
    log.interview_score >= 50 || log.new_stage?.includes('Passed')
  );

  const failedActivities = interviewActivities.filter(log =>
    log.interview_score < 50 || log.new_stage?.includes('Failed')
  );

  const isLoading = activityLogsLoading;

  // Set up realtime subscriptions for MongoDB data
  useEffect(() => {
    const activityChannel = supabase
      .channel('activity-log-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pipeline_activity_logs'
        },
        () => {
          refetchActivityLogs(); // Refetch activities from MongoDB
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(activityChannel);
    };
  }, [refetchActivityLogs]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNavBar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="ml-0 lg:ml-56 flex-1 p-4 lg:p-8 bg-slate-50 dark:bg-slate-950">
          <div className="container mx-auto space-y-6">
            <div className="space-y-4">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Pipeline Activity Log</h1>
                <p className="text-muted-foreground mt-1">
                  Track all candidate movements across pipeline stages with enhanced journey tracking
                </p>
              </div>

              {/* Enhanced Filtering Section */}
              <Card className="bg-muted/50">
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                          placeholder="Search by email or candidate name..."
                          value={emailFilter}
                          onChange={(e) => setEmailFilter(e.target.value)}
                          className="w-full pl-10 pr-3 py-2 border border-input bg-background rounded-md text-sm"
                        />
                      </div>
                    </div>
                    <div className="sm:w-48">
                      <select
                        value={stageFilter}
                        onChange={(e) => setStageFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
                      >
                        <option value="all">All Stages</option>
                        <option value="interview">Interview Related</option>
                        <option value="passed">Interview Passed</option>
                        <option value="failed">Interview Failed</option>
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Rejected Candidates */}
            {failedActivities.length > 0 && (
              <Card className="border-destructive/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <div className="h-5 w-5 rounded-full bg-destructive flex items-center justify-center">
                      <span className="text-xs text-destructive-foreground">✗</span>
                    </div>
                    Rejected Candidates (Score {'<'} 50%)
                  </CardTitle>
                  <CardDescription>
                    {failedActivities.length} candidate{failedActivities.length !== 1 ? 's' : ''} with low interview scores
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {failedActivities.map((activity) => (
                      <div
                        key={activity.id}
                        className="rounded-lg border-2 border-destructive/30 bg-destructive/5 overflow-hidden"
                      >
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex-1">
                              <h4 className="font-semibold text-foreground flex items-center gap-2">
                                {activity.candidate_name}
                                <Badge variant="destructive" className="text-xs">
                                  {activity.interview_score || 0}% - Rejected
                                </Badge>
                              </h4>
                              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                <Briefcase className="h-3 w-3" />
                                {activity.job_position}
                              </p>
                              <p className="text-xs text-destructive font-medium mt-1">
                                Interview Failed
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatDistanceToNow(new Date(activity.created_at), {
                                  addSuffix: true,
                                })}
                              </span>
                            </div>
                          </div>

                          <div className="w-full bg-destructive/20 rounded-full h-2 mb-3">
                            <div
                              className="bg-destructive h-2 rounded-full"
                              style={{ width: `${activity.interview_score || 0}%` }}
                            />
                          </div>

                          {/* Activity Details */}
                          <div className="text-sm text-muted-foreground">
                            <p><strong>Stage:</strong> {activity.new_stage_label}</p>
                            <p><strong>Score:</strong> {activity.interview_score}%</p>
                            <p><strong>Changed by:</strong> {activity.changed_by_name}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Passed Candidates */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-xs text-primary-foreground">✓</span>
                  </div>
                  Passed Interviews (Score ≥ 50%)
                </CardTitle>
                <CardDescription>
                  {passedActivities.length} candidate{passedActivities.length !== 1 ? 's' : ''} passed the interview
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : passedActivities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No passed interviews yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {passedActivities.map((activity) => (
                      <div
                        key={activity.id}
                        className="rounded-lg border bg-card overflow-hidden"
                      >
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex-1">
                              <h4 className="font-semibold text-foreground flex items-center gap-2">
                                {activity.candidate_name}
                                <Badge
                                  variant={activity.interview_score >= 70 ? "default" : "secondary"}
                                  className="text-xs"
                                >
                                  {activity.interview_score}%
                                </Badge>
                              </h4>
                              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                <Briefcase className="h-3 w-3" />
                                {activity.job_position}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {activity.candidate_email}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatDistanceToNow(new Date(activity.created_at), {
                                  addSuffix: true,
                                })}
                              </span>
                            </div>
                          </div>

                          <div className="w-full bg-primary/20 rounded-full h-2 mb-3">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{ width: `${activity.interview_score || 0}%` }}
                            />
                          </div>

                          {/* Activity Details */}
                          <div className="text-sm text-muted-foreground">
                            <p><strong>Stage:</strong> {activity.new_stage_label}</p>
                            <p><strong>Score:</strong> {activity.interview_score}%</p>
                            <p><strong>Changed by:</strong> {activity.changed_by_name}</p>
                          </div>

                          {/* Video Recording */}
                          {activity.has_video && (
                            <div className="mt-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Video className="h-4 w-4 text-primary" />
                                <span className="text-sm font-medium">Interview Recording</span>
                                {activity.video_size && (
                                  <Badge variant="outline" className="text-xs">
                                    {(activity.video_size / 1024 / 1024).toFixed(2)} MB
                                  </Badge>
                                )}
                              </div>
                              <video
                                src={`http://localhost:3002/activity-logs/${activity.id}/video`}
                                controls
                                className="w-full rounded-lg bg-black max-h-48"
                                preload="metadata"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pipeline Stage Changes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Pipeline Stage Changes
                </CardTitle>
                <CardDescription>
                  {(activityLogs?.length || 0)} stage transitions recorded
                  {emailFilter && (
                    <span className="ml-2 text-sm">
                      (filtered from {activityLogs?.length || 0} total)
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : !activityLogs || activityLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No activity recorded yet. Stage changes will appear here.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activityLogs?.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex-shrink-0 mt-1">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <ArrowRight className="h-5 w-5 text-primary" />
                          </div>
                        </div>

                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-start gap-3">
                                <div className="flex-1">
                                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                                    {activity.candidate_name}
                                    {activity.interview_score && (
                                      <Badge variant={activity.interview_score >= 70 ? "default" : activity.interview_score >= 50 ? "secondary" : "destructive"} className="text-xs">
                                        <Trophy className="h-3 w-3 mr-1" />
                                        {activity.interview_score}%
                                      </Badge>
                                    )}
                                  </h4>
                                  {activity.candidate_email && (
                                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                      <Mail className="h-3 w-3" />
                                      {activity.candidate_email}
                                    </p>
                                  )}
                                  {activity.job_position && (
                                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                                      <Briefcase className="h-3 w-3" />
                                      {activity.job_position}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(new Date(activity.created_at), {
                                addSuffix: true,
                              })}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {activity.old_stage_label ? (
                              <>
                                <Badge variant="outline" className="text-xs">
                                  {activity.old_stage_label}
                                </Badge>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <Badge variant="default" className="text-xs">
                                  {activity.new_stage_label}
                                </Badge>
                              </>
                            ) : (
                              <Badge variant="default" className="text-xs">
                                Added to {activity.new_stage_label}
                              </Badge>
                            )}
                          </div>

                          {/* Interview Details for interview-related activities */}
                          {activity.interview_details && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              <Badge variant="secondary" className="text-xs">
                                MCQ: {activity.interview_details.mcq_score}%
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                Essay: {activity.interview_details.essay_score}%
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                Questions: {activity.interview_details.total_questions}
                              </Badge>
                              {activity.interview_details.video_recorded && (
                                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                  <Video className="h-3 w-3" />
                                  Video Recorded
                                </Badge>
                              )}
                            </div>
                          )}

                          {/* Simple video indicator */}
                          {activity.has_video && (
                            <div className="flex items-center gap-2 mt-2">
                              <Video className="h-3 w-3 text-primary" />
                              <span className="text-xs text-muted-foreground">Video recorded</span>
                            </div>
                          )}

                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>Changed by: {activity.changed_by_name}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ActivityLog;
