import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();
import Index from "./pages/Index";
import Jobs from "./pages/Jobs";
import JobDetails from "./pages/JobDetails";
import JobTemplates from "./pages/JobTemplates";
import Profiles from "./pages/Tasks";
import CandidatePipeline from "./pages/CandidatePipeline";
import Requests from "./pages/Requests";
import Applications from "./pages/Applications";
import Attendance from "./pages/Attendance";
import SMM from "./pages/SMM";
import Settings from "./pages/Settings";
import Communication from "./pages/Communication";
import Knowledge from "./pages/Knowledge";
import NotFound from "./pages/NotFound";
import ApplyJob from "./pages/ApplyJob";
import PublicJobs from "./pages/PublicJobs";
import AIInterview from "./pages/AIInterview";
import AIInterviewResults from "./pages/AIInterviewResults";
import AIInterviewReview from "./pages/pipeline/AIInterviewReview";
import HR from "./pages/pipeline/HR";
import WrittenTest from "./pages/pipeline/WrittenTest";
import DemoSlot from "./pages/pipeline/DemoSlot";
import DemoSchedule from "./pages/pipeline/DemoSchedule";
import Feedback from "./pages/pipeline/Feedback";
import Interaction from "./pages/pipeline/Interaction";
import BGV from "./pages/pipeline/BGV";
import Confirmation from "./pages/pipeline/Confirmation";
import UploadDocuments from "./pages/pipeline/UploadDocuments";
import Verify from "./pages/pipeline/Verify";
import Approval from "./pages/pipeline/Approval";
import OfferLetter from "./pages/pipeline/OfferLetter";
import Onboarding from "./pages/pipeline/Onboarding";
import ActivityLog from "./pages/pipeline/ActivityLog";
import Profile from "./pages/Profile";
import GeoLocation from "./pages/GeoLocation";
import InterviewQuiz from "./pages/InterviewQuiz";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/jobs/:id" element={<JobDetails />} />
        <Route path="/job-templates" element={<JobTemplates />} />
        <Route path="/profiles" element={<Profiles />} />
        <Route path="/profiles/:id" element={<CandidatePipeline />} />
        <Route path="/requests" element={<Requests />} />
        <Route path="/applications" element={<Applications />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/smm" element={<SMM />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/communication" element={<Communication />} />
        <Route path="/knowledge" element={<Knowledge />} />
        <Route path="/geo-location" element={<GeoLocation />} />
        <Route path="/careers" element={<PublicJobs />} />
        <Route path="/apply/:jobId" element={<ApplyJob />} />
        <Route path="/pipeline/hr" element={<HR />} />
        <Route path="/pipeline/written-test" element={<WrittenTest />} />
        <Route path="/pipeline/demo-slot" element={<DemoSlot />} />
        <Route path="/pipeline/demo-schedule" element={<DemoSchedule />} />
        <Route path="/pipeline/feedback" element={<Feedback />} />
        <Route path="/pipeline/interaction" element={<Interaction />} />
        <Route path="/pipeline/bgv" element={<BGV />} />
        <Route path="/pipeline/confirmation" element={<Confirmation />} />
        <Route path="/pipeline/upload-documents" element={<UploadDocuments />} />
        <Route path="/pipeline/verify" element={<Verify />} />
        <Route path="/pipeline/approval" element={<Approval />} />
        <Route path="/pipeline/offer-letter" element={<OfferLetter />} />
        <Route path="/pipeline/onboarding" element={<Onboarding />} />
        <Route path="/pipeline/activity" element={<ActivityLog />} />
        <Route path="/pipeline/ai-interviews" element={<AIInterviewReview />} />
        <Route path="/ai-interview/:token" element={<AIInterview />} />
        <Route path="/ai-interview-results/:token" element={<AIInterviewResults />} />
        <Route path="/interview-quiz/:jobId" element={<InterviewQuiz />} />
        <Route path="/interview-quiz/:jobId/:candidateId" element={<InterviewQuiz />} />
        <Route path="/quiz/:jobId" element={<InterviewQuiz />} />
        <Route path="/quiz/:jobId/:candidateId" element={<InterviewQuiz />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
