import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mail, Phone, Calendar, Briefcase, Target, FileText, Clock, MapPin, Download, ExternalLink, User, FileDown, Video, Play } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Candidate } from "@/hooks/useCandidates";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ProfileDetailDrawerProps {
  candidate: Candidate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ProfileDetailDrawer = ({ candidate, open, onOpenChange }: ProfileDetailDrawerProps) => {
  const { toast } = useToast();
  const [examBookings, setExamBookings] = useState<any[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  
  useEffect(() => {
    if (candidate?.id && open) {
      loadExamBookings();
    }
  }, [candidate?.id, open]);
  
  const loadExamBookings = async () => {
    if (!candidate?.id) return;
    
    setLoadingExams(true);
    try {
      const { data, error } = await supabase
        .from("exam_bookings")
        .select(`
          *,
          jobs (position, id)
        `)
        .eq("candidate_id", candidate.id)
        .eq("status", "completed")
        .eq("video_recorded", true)
        .order("completed_at", { ascending: false });

      if (error) throw error;
      setExamBookings(data || []);
    } catch (error: any) {
      console.error("Error loading exam bookings:", error);
    } finally {
      setLoadingExams(false);
    }
  };
  
  if (!candidate) return null;

  const getScoreColor = (score: number | null) => {
    if (!score) return "bg-muted text-muted-foreground";
    if (score >= 80) return "bg-green-500/10 text-green-600 border-green-500/20";
    if (score >= 60) return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    if (score >= 40) return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
    return "bg-red-500/10 text-red-600 border-red-500/20";
  };

  const getScoreLabel = (score: number | null) => {
    if (!score) return "No Match";
    if (score >= 80) return "Strong Match";
    if (score >= 60) return "Good Match";
    if (score >= 40) return "Potential Match";
    return "Low Match";
  };

  const extractSkills = (skillsString: string | null, resumeText: string | null): string[] => {
    // First try to use AI-extracted skills from database
    if (skillsString) {
      const skillsArray = skillsString.split(',').map(s => s.trim()).filter(Boolean);
      if (skillsArray.length > 0) return skillsArray;
    }
    
    // Fallback to basic extraction from resume text
    if (!resumeText) return [];
    
    const commonSkills = [
      "React.js", "Next.js", "React Native", "Redux", "Redux-Saga",
      "TypeScript", "JavaScript", "Python", "Java", "C++", "C#",
      "Node.js", "Express", "MongoDB", "PostgreSQL", "MySQL", "AWS", "Azure", "Docker",
      "Kubernetes", "Tailwind CSS", "Styled Components", "CSS", "HTML", "Git",
      "Communication Skills", "Staff Development", "Leadership",
      "Educational Technology", "Curriculum Development",
      "Clerical Skills", "Teamwork", "Computer Proficiency",
      "Basic Knowledge of Computer", "Problem Solving", "Project Management"
    ];
    
    const foundSkills = commonSkills.filter(skill => 
      resumeText.toLowerCase().includes(skill.toLowerCase())
    );
    
    return foundSkills.length > 0 ? foundSkills : [];
  };

  const analysis = candidate.ai_match_analysis as {
    strengths?: string[];
    weaknesses?: string[];
    recommendation?: string;
    summary?: string;
  } | null;

  const skills = extractSkills(candidate.skills, candidate.resume_text);

  const generatePDF = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let yPosition = 20;

      // Helper function to add text with wrapping
      const addWrappedText = (text: string, y: number, maxWidth: number, fontSize: number = 10) => {
        doc.setFontSize(fontSize);
        const lines = doc.splitTextToSize(text, maxWidth);
        doc.text(lines, margin, y);
        return y + (lines.length * (fontSize * 0.5));
      };

      // Header with candidate name
      doc.setFillColor(59, 130, 246); // Primary blue
      doc.rect(0, 0, pageWidth, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text(candidate.full_name, margin, 25);
      
      // Experience badge
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`${candidate.experience_years?.toFixed(1) || '0'} Years Experience`, margin, 33);

      yPosition = 50;
      doc.setTextColor(0, 0, 0);

      // Job Match Section (if available)
      if (candidate.jobs && candidate.ai_match_score) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(59, 130, 246);
        doc.text('Job Match', margin, yPosition);
        yPosition += 8;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        
        autoTable(doc, {
          startY: yPosition,
          head: [['Position', 'Department', 'Match Score']],
          body: [[
            candidate.jobs.position,
            candidate.jobs.department || 'N/A',
            `${candidate.ai_match_score}% - ${getScoreLabel(candidate.ai_match_score)}`
          ]],
          theme: 'grid',
          headStyles: { fillColor: [59, 130, 246] },
          margin: { left: margin, right: margin },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 10;
      }

      // Contact Information
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(59, 130, 246);
      doc.text('Contact Information', margin, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);

      const contactData = [
        ['Email', candidate.email],
        ['Phone', candidate.phone || 'Not provided'],
        ['Location', 'Location not specified']
      ];

      autoTable(doc, {
        startY: yPosition,
        body: contactData,
        theme: 'plain',
        margin: { left: margin, right: margin },
        columnStyles: {
          0: { cellWidth: 40, fontStyle: 'bold' },
          1: { cellWidth: 'auto' }
        }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;

      // Skills Section
      if (skills.length > 0) {
        if (yPosition > 250) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(59, 130, 246);
        doc.text('Skills & Expertise', margin, yPosition);
        yPosition += 8;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        
        const skillsText = skills.join(' • ');
        yPosition = addWrappedText(skillsText, yPosition, pageWidth - (margin * 2));
        yPosition += 10;
      }

      // AI Match Analysis
      if (analysis && candidate.ai_match_score) {
        if (yPosition > 230) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(59, 130, 246);
        doc.text('AI Match Analysis', margin, yPosition);
        yPosition += 8;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);

        if (analysis.summary) {
          doc.setFont('helvetica', 'italic');
          yPosition = addWrappedText(analysis.summary, yPosition, pageWidth - (margin * 2));
          yPosition += 5;
        }

        if (analysis.strengths && analysis.strengths.length > 0) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(34, 197, 94); // Green
          doc.text('Strengths:', margin, yPosition);
          yPosition += 5;
          
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          analysis.strengths.forEach((strength) => {
            if (yPosition > 270) {
              doc.addPage();
              yPosition = 20;
            }
            yPosition = addWrappedText(`• ${strength}`, yPosition, pageWidth - (margin * 2) - 5);
            yPosition += 2;
          });
          yPosition += 5;
        }

        if (analysis.weaknesses && analysis.weaknesses.length > 0) {
          if (yPosition > 250) {
            doc.addPage();
            yPosition = 20;
          }

          doc.setFont('helvetica', 'bold');
          doc.setTextColor(234, 179, 8); // Yellow
          doc.text('Areas for Consideration:', margin, yPosition);
          yPosition += 5;
          
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          analysis.weaknesses.forEach((weakness) => {
            if (yPosition > 270) {
              doc.addPage();
              yPosition = 20;
            }
            yPosition = addWrappedText(`• ${weakness}`, yPosition, pageWidth - (margin * 2) - 5);
            yPosition += 2;
          });
          yPosition += 5;
        }

        if (analysis.recommendation) {
          if (yPosition > 250) {
            doc.addPage();
            yPosition = 20;
          }

          doc.setFont('helvetica', 'bold');
          doc.setTextColor(59, 130, 246);
          doc.text('Recommendation:', margin, yPosition);
          yPosition += 5;
          
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          yPosition = addWrappedText(analysis.recommendation, yPosition, pageWidth - (margin * 2));
          yPosition += 10;
        }
      }

      // Resume Text (truncated if too long)
      if (candidate.resume_text) {
        if (yPosition > 230) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(59, 130, 246);
        doc.text('Resume Extract', margin, yPosition);
        yPosition += 8;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        
        // Truncate resume text to fit in PDF
        const maxResumeLength = 1500;
        const resumeText = candidate.resume_text.length > maxResumeLength 
          ? candidate.resume_text.substring(0, maxResumeLength) + '...\n\n[Resume truncated. Full resume available in system.]'
          : candidate.resume_text;
        
        const resumeLines = doc.splitTextToSize(resumeText, pageWidth - (margin * 2));
        const maxLines = Math.floor((doc.internal.pageSize.getHeight() - yPosition - 20) / 4);
        const displayLines = resumeLines.slice(0, maxLines);
        
        doc.text(displayLines, margin, yPosition);
      }

      // Footer with timestamp
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
          `Generated on ${format(new Date(), "MMM d, yyyy 'at' h:mm a")} | Page ${i} of ${pageCount}`,
          margin,
          doc.internal.pageSize.getHeight() - 10
        );
      }

      // Save the PDF
      const fileName = `${candidate.full_name.replace(/\s+/g, '_')}_Profile.pdf`;
      doc.save(fileName);

      toast({
        title: "PDF Generated Successfully",
        description: `Profile exported as ${fileName}`,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Export Failed",
        description: "There was an error generating the PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl overflow-hidden p-0">
        <SheetHeader className="px-6 pt-6 pb-4 bg-gradient-to-r from-muted/50 to-muted/30 border-b border-border">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <SheetTitle className="text-2xl font-bold text-foreground">
                {candidate.full_name}
              </SheetTitle>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Badge variant="outline" className="bg-background">
                  <Briefcase className="h-3 w-3 mr-1" />
                  {candidate.experience_years?.toFixed(1) || '0'} Years Experience
                </Badge>
                {candidate.ai_match_score !== null && (
                  <Badge variant="outline" className={getScoreColor(candidate.ai_match_score)}>
                    <Target className="h-3 w-3 mr-1" />
                    {candidate.ai_match_score}% • {getScoreLabel(candidate.ai_match_score)}
                  </Badge>
                )}
                {candidate.jobs && (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                    Matched to: {candidate.jobs.position}
                  </Badge>
                )}
              </div>
            </div>
            <Button
              variant="default"
              size="default"
              onClick={generatePDF}
              className="gap-2 shrink-0"
            >
              <FileDown className="h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-140px)]">
          <div className="px-6 py-6 space-y-6">
            {/* Job Match Information */}
            {candidate.jobs && (
              <>
                <section className="bg-muted/30 rounded-lg p-4 border border-border">
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    Job Match
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-foreground">{candidate.jobs.position}</p>
                        {candidate.jobs.department && (
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {candidate.jobs.department}
                          </p>
                        )}
                      </div>
                      {candidate.ai_match_score && (
                        <div className="text-right">
                          <p className="text-2xl font-bold text-foreground">
                            {candidate.ai_match_score}%
                          </p>
                          <p className="text-xs text-muted-foreground">Match Score</p>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <Separator />
              </>
            )}

            {/* Contact Information */}
            <section>
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Contact Information
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-muted/20 rounded-lg">
                  <Mail className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-0.5">Email</p>
                    <a 
                      href={`mailto:${candidate.email}`} 
                      className="text-sm text-foreground hover:text-primary transition-colors break-all"
                    >
                      {candidate.email}
                    </a>
                  </div>
                </div>
                
                {candidate.phone && (
                  <div className="flex items-start gap-3 p-3 bg-muted/20 rounded-lg">
                    <Phone className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-0.5">Phone</p>
                      <a 
                        href={`tel:${candidate.phone}`} 
                        className="text-sm text-foreground hover:text-primary transition-colors"
                      >
                        {candidate.phone}
                      </a>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3 p-3 bg-muted/20 rounded-lg">
                  <MapPin className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-0.5">Location</p>
                    <p className="text-sm text-foreground">Location not specified</p>
                  </div>
                </div>
              </div>
            </section>

            <Separator />

            {/* Skills */}
            {skills.length > 0 && (
              <>
                <section>
                  <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-primary" />
                    Skills & Expertise
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill, idx) => (
                      <Badge 
                        key={idx} 
                        variant="secondary"
                        className="bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </section>

                <Separator />
              </>
            )}

            {/* AI Match Analysis */}
            {analysis && (candidate.ai_match_score !== null) && (
              <>
                <section>
                  <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    AI Match Analysis
                  </h3>
                  
                  {analysis.summary && (
                    <div className="bg-muted/30 rounded-lg p-4 mb-4 border border-border">
                      <p className="text-sm text-foreground leading-relaxed">{analysis.summary}</p>
                    </div>
                  )}
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    {analysis.strengths && analysis.strengths.length > 0 && (
                      <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4 border border-green-200 dark:border-green-900/30">
                        <h4 className="text-xs font-semibold text-green-700 dark:text-green-400 mb-3 uppercase tracking-wide">
                          Strengths
                        </h4>
                        <ul className="space-y-2">
                          {analysis.strengths.map((strength, idx) => (
                            <li key={idx} className="text-sm text-foreground flex items-start gap-2">
                              <span className="text-green-500 font-bold mt-0.5">✓</span>
                              <span>{strength}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {analysis.weaknesses && analysis.weaknesses.length > 0 && (
                      <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-900/30">
                        <h4 className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 mb-3 uppercase tracking-wide">
                          Areas for Consideration
                        </h4>
                        <ul className="space-y-2">
                          {analysis.weaknesses.map((weakness, idx) => (
                            <li key={idx} className="text-sm text-foreground flex items-start gap-2">
                              <span className="text-yellow-500 font-bold mt-0.5">!</span>
                              <span>{weakness}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {analysis.recommendation && (
                    <div className="bg-primary/5 rounded-lg p-4 mt-4 border border-primary/20">
                      <h4 className="text-xs font-semibold text-primary mb-2 uppercase tracking-wide flex items-center gap-2">
                        <Target className="h-3 w-3" />
                        Recommendation
                      </h4>
                      <p className="text-sm text-foreground leading-relaxed">{analysis.recommendation}</p>
                    </div>
                  )}
                </section>

                <Separator />
              </>
            )}

            {/* Resume */}
            {(candidate.resume_text || candidate.resume_url) && (
              <>
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      Resume
                    </h3>
                    {candidate.resume_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(candidate.resume_url!, "_blank")}
                        className="gap-2"
                      >
                        <Download className="h-3 w-3" />
                        Download
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  
                  {candidate.resume_text && (
                    <div className="bg-muted/30 rounded-lg p-5 border border-border">
                      <ScrollArea className="max-h-96">
                        <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed">
                          {candidate.resume_text}
                        </pre>
                      </ScrollArea>
                    </div>
                  )}
                </section>

                <Separator />
              </>
            )}

            {/* Exam Videos */}
            {examBookings.length > 0 && (
              <>
                <section>
                  <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Video className="h-4 w-4 text-primary" />
                    Exam Recordings
                  </h3>
                  <div className="space-y-3">
                    {examBookings.map((booking) => (
                      <div
                        key={booking.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-foreground">
                            {booking.jobs?.position || "Screening Exam"}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {booking.scheduled_start_time && format(new Date(booking.scheduled_start_time), "MMM d, yyyy 'at' h:mm a")}
                            {booking.score !== null && (
                              <span className="ml-2">• Score: {booking.score}%</span>
                            )}
                          </div>
                        </div>
                        {booking.video_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedVideo(booking.video_url)}
                          >
                            <Play className="mr-2 h-4 w-4" />
                            View Video
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                <Separator />
              </>
            )}

            {/* Activity Timeline */}
            <section>
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Activity Timeline
              </h3>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className="h-3 w-3 rounded-full bg-green-500 ring-4 ring-green-500/20" />
                    <div className="w-0.5 h-full min-h-[40px] bg-border mt-2" />
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="text-sm font-medium text-foreground">Profile Last Updated</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(candidate.updated_at), { addSuffix: true })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(candidate.updated_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>

                {candidate.ai_match_score && candidate.jobs && (
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div className="h-3 w-3 rounded-full bg-blue-500 ring-4 ring-blue-500/20" />
                      <div className="w-0.5 h-full min-h-[40px] bg-border mt-2" />
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="text-sm font-medium text-foreground">
                        Matched to {candidate.jobs.position}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        AI Match Score: {candidate.ai_match_score}%
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className="h-3 w-3 rounded-full bg-primary ring-4 ring-primary/20" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Profile Created</p>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(candidate.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>

      {/* Video Viewer Dialog */}
      <Dialog open={!!selectedVideo} onOpenChange={(open) => !open && setSelectedVideo(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Exam Recording</DialogTitle>
          </DialogHeader>
          {selectedVideo && (
            <div className="space-y-4">
              <video
                src={selectedVideo}
                controls
                className="w-full rounded-lg border"
                style={{ maxHeight: "70vh" }}
              >
                Your browser does not support the video tag.
              </video>
              <div className="text-sm text-muted-foreground">
                <p>This is a recording of the candidate's exam session. You can use this for manual review and verification.</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Sheet>
  );
};

export default ProfileDetailDrawer;
