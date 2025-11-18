import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import TopNavBar from "@/components/layout/TopNavBar";
import Sidebar from "@/components/layout/Sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  MapPin, 
  Briefcase, 
  LayoutDashboard, 
  Sparkles, 
  GitBranch, 
  CheckCircle2,
  Filter,
  ChevronLeft,
  ChevronRight,
  User,
  FileText,
  MoreHorizontal,
  Loader2,
  Mail,
  Phone,
  Star,
  TrendingUp
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AIMatchesTabContent from "@/components/jobs/CandidateAIMatchesTab";
import MatchScoreDetailModal from "@/components/profiles/MatchScoreDetailModal";

interface CandidateData {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  experience_years: number | null;
  ai_match_score: number | null;
  ai_match_analysis: any;
  status: string;
  jobs: {
    position: string;
    department: string | null;
    job_description: string | null;
    experience: string | null;
    primary_locations: string | null;
    vacancies: number;
  } | null;
}

const PIPELINE_STAGES = [
  { 
    key: "applied",
    name: "Screening Test", 
    icon: "📝",
    color: "bg-purple-500"
  },
  { 
    key: "screening",
    name: "Demo Round", 
    icon: "🎯",
    color: "bg-orange-500"
  },
  { 
    key: "demo",
    name: "Panel Interview", 
    icon: "👥",
    color: "bg-green-500"
  },
  { 
    key: "interview",
    name: "HR Approval", 
    icon: "✓",
    color: "bg-green-600"
  }
];

const PIPELINE_ROUTES = [
  { route: "/pipeline/hr", label: "HR Screening", icon: "👥" },
  { route: "/pipeline/written-test", label: "Written Test", icon: "📝" },
  { route: "/pipeline/demo-slot", label: "Demo Slot", icon: "📅" },
  { route: "/pipeline/demo-schedule", label: "Demo Schedule", icon: "🗓️" },
  { route: "/pipeline/feedback", label: "Feedback", icon: "💬" },
  { route: "/pipeline/interaction", label: "Interaction", icon: "🤝" },
  { route: "/pipeline/bgv", label: "Background Verification", icon: "🔍" },
  { route: "/pipeline/confirmation", label: "Confirmation", icon: "✅" },
  { route: "/pipeline/upload-documents", label: "Upload Documents", icon: "📄" },
  { route: "/pipeline/verify", label: "Verify", icon: "✓" },
  { route: "/pipeline/approval", label: "Approval", icon: "👍" },
  { route: "/pipeline/offer-letter", label: "Offer Letter", icon: "📋" },
  { route: "/pipeline/onboarding", label: "Onboarding", icon: "🎯" },
  { route: "/pipeline/activity", label: "Activity Log", icon: "📊" },
  { route: "/pipeline/ai-interviews", label: "AI Interviews", icon: "🤖" },
];

const CandidatePipeline = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchName, setSearchName] = useState("");
  const [activeStage, setActiveStage] = useState("all");
  const [showMatchModal, setShowMatchModal] = useState(false);

  // Fetch candidate data
  const { data: candidate, isLoading } = useQuery({
    queryKey: ['candidate', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidates')
        .select(`
          *,
          jobs (
            position,
            department,
            job_description,
            experience,
            primary_locations,
            vacancies
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as CandidateData;
    },
    enabled: !!id
  });

  // Update candidate status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase
        .from('candidates')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate', id] });
      toast({
        title: "Status Updated",
        description: "Candidate status has been updated successfully.",
      });
    },
    onError: (error) => {
      console.error('Error updating status:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update candidate status. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleStageClick = (stageKey: string) => {
    if (updateStatusMutation.isPending) return;
    updateStatusMutation.mutate(stageKey);
  };

  const getStageStatus = (stageKey: string) => {
    if (!candidate) return 'pending';
    
    const currentStageIndex = PIPELINE_STAGES.findIndex(s => s.key === candidate.status);
    const stageIndex = PIPELINE_STAGES.findIndex(s => s.key === stageKey);
    
    if (stageIndex < currentStageIndex) return 'completed';
    if (stageIndex === currentStageIndex) return 'current';
    return 'pending';
  };

  const getMatchScoreColor = (score: number | null) => {
    if (!score) return { bg: "bg-gray-500/10", text: "text-gray-700", border: "border-gray-300" };
    if (score >= 80) return { bg: "bg-green-500/10", text: "text-green-700", border: "border-green-300" };
    if (score >= 60) return { bg: "bg-blue-500/10", text: "text-blue-700", border: "border-blue-300" };
    if (score >= 40) return { bg: "bg-amber-500/10", text: "text-amber-700", border: "border-amber-300" };
    return { bg: "bg-red-500/10", text: "text-red-700", border: "border-red-300" };
  };

  const getMatchLabel = (score: number | null) => {
    if (!score) return "Not Evaluated";
    if (score >= 80) return "Excellent Match";
    if (score >= 60) return "Good Match";
    if (score >= 40) return "Fair Match";
    return "Poor Match";
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <TopNavBar />
        <div className="flex flex-1">
          <Sidebar />
          <main className="ml-0 lg:ml-56 flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Loading candidate data...</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <TopNavBar />
        <div className="flex flex-1">
          <Sidebar />
          <main className="ml-0 lg:ml-56 flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-lg text-muted-foreground">Candidate not found</p>
              <Button onClick={() => navigate('/profiles')} className="mt-4">
                Back to Profiles
              </Button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const stages = [
    { key: "all", label: "All", count: 1 },
    { key: "inProgress", label: "InProgress", count: candidate.status !== 'placed' && candidate.status !== 'rejected' ? 1 : 0 },
    { key: "applied", label: "Screening Test", count: candidate.status === 'applied' ? 1 : 0, icon: "📝" },
    { key: "screening", label: "Demo Round", count: candidate.status === 'screening' ? 1 : 0, icon: "🎯" },
    { key: "demo", label: "Panel Interview", count: candidate.status === 'demo' ? 1 : 0, icon: "👥" },
    { key: "interview", label: "HR", count: candidate.status === 'interview' ? 1 : 0, icon: "✓" },
  ];

  const statusStages = [
    { key: "placed", label: "Placed", count: candidate.status === 'placed' ? 1 : 0 },
    { key: "rejected", label: "Rejected", count: candidate.status === 'rejected' ? 1 : 0 },
    { key: "completed", label: "Completed", count: 0 },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNavBar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="ml-0 lg:ml-56 flex-1">
          {/* Breadcrumb Navigation */}
          <div className="border-b border-border bg-card/50 px-8 py-3">
            <nav className="flex items-center gap-2 text-sm">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Recruitment Pipeline</span>
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <div className="flex items-center gap-2 flex-wrap">
                  {PIPELINE_ROUTES.slice(0, 5).map((stage, index) => (
                    <div key={stage.route} className="flex items-center gap-2">
                      <Button
                        variant="link"
                        className="h-auto p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => navigate(stage.route)}
                      >
                        <span className="mr-1">{stage.icon}</span>
                        {stage.label}
                      </Button>
                      {index < PIPELINE_ROUTES.slice(0, 5).length - 1 && (
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                  ))}
                  {PIPELINE_ROUTES.length > 5 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="link"
                          className="h-auto p-0 text-muted-foreground hover:text-foreground"
                        >
                          More...
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className="w-56 bg-popover z-50"
                      >
                        {PIPELINE_ROUTES.slice(5).map((stage) => (
                          <DropdownMenuItem
                            key={stage.route}
                            onClick={() => navigate(stage.route)}
                            className="cursor-pointer"
                          >
                            <span className="mr-2">{stage.icon}</span>
                            {stage.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground font-medium">{candidate?.full_name}</span>
            </nav>
          </div>

          {/* Header */}
          <div className="border-b border-border bg-card px-8 py-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4 flex-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/profiles')}
                  className="mt-1"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                  <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold text-foreground">
                      {candidate.full_name}
                    </h1>
                    {/* AI Match Score Badge */}
                    {candidate.ai_match_score !== null && (
                      <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${getMatchScoreColor(candidate.ai_match_score).bg} ${getMatchScoreColor(candidate.ai_match_score).border}`}>
                        <Star className={`h-5 w-5 ${getMatchScoreColor(candidate.ai_match_score).text} fill-current`} />
                        <div className="flex flex-col">
                          <span className={`text-2xl font-bold ${getMatchScoreColor(candidate.ai_match_score).text}`}>
                            {candidate.ai_match_score}%
                          </span>
                          <span className={`text-xs ${getMatchScoreColor(candidate.ai_match_score).text}`}>
                            {getMatchLabel(candidate.ai_match_score)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Job Position */}
                  {candidate.jobs && (
                    <div className="flex items-center gap-2 mt-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <span className="text-base font-medium text-foreground">
                        {candidate.jobs.position}
                      </span>
                      {candidate.jobs.department && (
                        <Badge variant="secondary" className="ml-2">
                          {candidate.jobs.department}
                        </Badge>
                      )}
                    </div>
                  )}
                  
                  {/* Contact Info */}
                  <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground flex-wrap">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{candidate.jobs?.primary_locations || 'Location Not Specified'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span>{candidate.email}</span>
                    </div>
                    {candidate.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span>{candidate.phone}</span>
                      </div>
                    )}
                    {candidate.experience_years !== null && (
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        <span>{candidate.experience_years} years experience</span>
                      </div>
                    )}
                  </div>

                  {/* AI Match Analysis Summary */}
                  {candidate.ai_match_analysis && (
                    <div className="mt-4 p-4 bg-muted/30 rounded-lg border border-border">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          AI Match Analysis
                        </h3>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setShowMatchModal(true)}
                          className="gap-2"
                        >
                          <FileText className="h-4 w-4" />
                          View Details
                        </Button>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {candidate.ai_match_analysis.summary && (
                          <p>{candidate.ai_match_analysis.summary}</p>
                        )}
                        {candidate.ai_match_analysis.strengths && candidate.ai_match_analysis.strengths.length > 0 && (
                          <div className="mt-2">
                            <span className="font-medium text-green-600">Strengths:</span>
                            <ul className="list-disc list-inside ml-2 mt-1">
                              {candidate.ai_match_analysis.strengths.slice(0, 3).map((strength: string, idx: number) => (
                                <li key={idx}>{strength}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <Tabs defaultValue="pipeline" className="mt-6">
              <TabsList className="bg-muted/50">
                <TabsTrigger value="dashboard" className="gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </TabsTrigger>
                <TabsTrigger value="ai-matches" className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  AI Matches
                </TabsTrigger>
                <TabsTrigger value="pipeline" className="gap-2">
                  <GitBranch className="h-4 w-4" />
                  Pipeline
                </TabsTrigger>
                <TabsTrigger value="placement" className="gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Placement
                </TabsTrigger>
              </TabsList>

              <TabsContent value="ai-matches" className="mt-0">
                {/* AI Matches Content */}
                <AIMatchesTabContent candidateId={candidate.id} />
              </TabsContent>

              <TabsContent value="pipeline" className="mt-0">
                {/* Filters and Search */}
                <div className="px-8 py-6 space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 max-w-md">
                <Input
                  type="text"
                  placeholder="Name"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="bg-background"
                />
              </div>
              <Button variant="ghost" size="icon">
                <Filter className="h-5 w-5" />
              </Button>
            </div>

            {/* Stage Filters */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                {stages.map((stage) => (
                  <Button
                    key={stage.key}
                    variant={activeStage === stage.key ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setActiveStage(stage.key)}
                    className="gap-2"
                  >
                    {stage.icon && <span>{stage.icon}</span>}
                    <span>{stage.label}</span>
                    <Badge variant="secondary" className="ml-1 bg-muted">
                      {stage.count}
                    </Badge>
                  </Button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {statusStages.map((stage) => (
                  <Button
                    key={stage.key}
                    variant="ghost"
                    size="sm"
                    className="gap-2"
                  >
                    <span>{stage.label}</span>
                    <Badge variant="secondary" className="bg-muted">
                      {stage.count}
                    </Badge>
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Candidate Pipeline Card */}
            <Card className="overflow-hidden">
              <div className="bg-muted/30 px-6 py-3 border-b border-border">
                <div className="flex items-center gap-8 text-sm font-medium text-muted-foreground">
                  <span>Candidate</span>
                  <span>Pipeline</span>
                </div>
              </div>

              <div className="p-6">
                <div className="flex items-center gap-8">
                  {/* Candidate Info */}
                  <div className="flex items-center gap-4 w-64">
                  <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{candidate.full_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="bg-background text-xs">
                            {candidate.ai_match_score || 0}
                          </Badge>
                          <Button variant="ghost" size="icon" className="h-5 w-5">
                            <User className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5">
                            <FileText className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5">
                            <MoreHorizontal className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pipeline Visualization */}
                  <div className="flex-1">
                    <div className="relative flex items-center gap-4">
                      {PIPELINE_STAGES.map((stage, index) => {
                        const status = getStageStatus(stage.key);
                        const isUpdating = updateStatusMutation.isPending;
                        
                        return (
                          <div key={index} className="flex items-center gap-4 flex-1">
                            {/* Stage Node */}
                            <button
                              onClick={() => handleStageClick(stage.key)}
                              disabled={isUpdating}
                              className="relative group disabled:cursor-not-allowed"
                            >
                              <div
                                className={`h-10 w-10 rounded-lg ${
                                  status === 'completed'
                                    ? stage.color
                                    : status === 'current'
                                    ? stage.color + ' ring-2 ring-offset-2 ring-primary'
                                    : 'bg-muted'
                                } flex items-center justify-center text-white font-semibold shadow-sm transition-all group-hover:scale-110 ${
                                  isUpdating ? 'opacity-50' : 'cursor-pointer'
                                }`}
                              >
                                {isUpdating && status === 'current' ? (
                                  <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                  <span className="text-lg">{stage.icon}</span>
                                )}
                              </div>
                              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-muted-foreground">
                                {stage.name}
                              </div>
                              {status === 'current' && (
                                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-primary font-medium">
                                  Current Stage
                                </div>
                              )}
                            </button>

                            {/* Connector Line */}
                            {index < PIPELINE_STAGES.length - 1 && (
                              <div className="flex-1 h-1 bg-border relative">
                                <div
                                  className={`absolute inset-0 transition-all ${
                                    status === 'completed'
                                      ? 'bg-green-500'
                                      : 'bg-transparent'
                                  }`}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {/* AI Match Detail Modal */}
      <MatchScoreDetailModal 
        open={showMatchModal}
        onOpenChange={setShowMatchModal}
        candidate={candidate}
      />
    </div>
  );
};

export default CandidatePipeline;
