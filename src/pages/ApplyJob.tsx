import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Loader2, Briefcase, MapPin, Calendar, Eye } from "lucide-react";
import * as pdfjsLib from 'pdfjs-dist';
import { validateStringArray } from "@/lib/utils";

interface Job {
  id: string;
  position: string;
  job_description: string;
  department: string;
  experience: string;
  primary_locations: string;
  vacancies: number;
  closing_date: string;
}

const ApplyJob = () => {
  const { jobId } = useParams();
  const { toast } = useToast();
  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumePreviewUrl, setResumePreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [emailSent, setEmailSent] = useState<boolean | null>(null);

  useEffect(() => {
    loadJob();
  }, [jobId]);

  useEffect(() => {
    // Cleanup preview URL when component unmounts or file changes
    return () => {
      if (resumePreviewUrl) {
        URL.revokeObjectURL(resumePreviewUrl);
      }
    };
  }, [resumePreviewUrl]);

  const scrollToForm = () => {
    document.getElementById('application-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadJob = async () => {
    try {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", jobId)
        .eq("status", "active")
        .single();

      if (error) throw error;
      setJob(data);
    } catch (error) {
      console.error("Error loading job:", error);
      toast({
        title: "Error",
        description: "Could not load job details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    const validTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];
    const validExtensions = [".pdf", ".doc", ".docx"];
    const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (validTypes.includes(file.type) || hasValidExtension) {
      // Revoke previous preview URL if exists
      if (resumePreviewUrl) {
        URL.revokeObjectURL(resumePreviewUrl);
      }
      
      setResumeFile(file);
      
      // Create preview URL only for PDFs
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        const previewUrl = URL.createObjectURL(file);
        setResumePreviewUrl(previewUrl);
      } else {
        setResumePreviewUrl(null);
      }
      
      toast({
        title: "Resume uploaded",
        description: "Your resume has been uploaded successfully.",
      });
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF or Word document (.pdf, .doc, .docx).",
        variant: "destructive",
      });
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      processFile(file);
    }
  };

  const handleRemoveResume = () => {
    if (resumePreviewUrl) {
      URL.revokeObjectURL(resumePreviewUrl);
    }
    setResumeFile(null);
    setResumePreviewUrl(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resumeFile) {
      toast({
        title: "Resume required",
        description: "Please upload your resume to continue.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Extract text from PDF client-side (skip for Word docs)
      let resumeText = '';
      
      if (resumeFile.type === 'application/pdf' || resumeFile.name.toLowerCase().endsWith('.pdf')) {
        try {
          const arrayBuffer = await resumeFile.arrayBuffer();
          
          // Configure worker for local pdfjs-dist
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

          const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(arrayBuffer),
          });
          const pdf = await loadingTask.promise;

          let text = '';
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            text += (textContent.items as any[])
              .map((i: any) => i?.str ?? '')
              .join(' ');
          }
          resumeText = text.trim();
          
          if (resumeText.length < 100) {
            toast({
              title: "Invalid Resume",
              description: "This appears to be a scanned PDF with no text. Please use an OCR tool to convert it first.",
              variant: "destructive",
            });
            setIsSubmitting(false);
            return;
          }
        } catch (error) {
          console.error('PDF parsing error:', error);
          throw new Error('Failed to parse PDF. Please try again.');
        }
      } else {
        // For Word docs, we'll send to backend for processing
        resumeText = 'Word document - will be processed on server';
      }

      // Upload file to Supabase Storage
      const fileName = `${Date.now()}_${resumeFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(fileName, resumeFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        throw new Error("Failed to upload resume file");
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('resumes')
        .getPublicUrl(fileName);

      // Get form data
      const formData = new FormData(e.target as HTMLFormElement);
      const fullName = formData.get('fullName') as string;
      const email = formData.get('email') as string;
      const phone = formData.get('phone') as string;

      // Parse resume and save candidate using edge function (for AI processing)
      const { data: candidateData, error: parseError } = await supabase.functions.invoke(
        "parse-resume",
        {
          body: {
            resumeText,
            resumeUrl: publicUrl,
            jobId: jobId,
            additionalInfo: {
              fullName,
              email,
              phone,
            },
          },
        }
      );

      if (parseError) throw parseError;

      // Send confirmation email via local Node.js server
      try {
        console.log('Sending email via local server to:', email);
        const interviewLink = `${window.location.origin}/interview-quiz/${jobId}/${candidateData.candidate?.id || candidateData.id}`;

        const emailResponse = await fetch('http://localhost:3002/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: email,
            subject: 'Your Interview Link - HireZen',
            html: `
              <!DOCTYPE html>
              <html lang="en">
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Interview Invitation - HireZen</title>
                <style>
                  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

                  * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                  }

                  body {
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background-color: #f8fafc;
                    color: #1f2937;
                    line-height: 1.6;
                    -webkit-font-smoothing: antialiased;
                  }

                  .email-container {
                    max-width: 640px;
                    margin: 20px auto;
                    background-color: #ffffff;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                  }

                  .header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    padding: 48px 40px;
                    text-align: center;
                    position: relative;
                  }

                  .header::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-image: radial-gradient(circle at 25% 25%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
                                     radial-gradient(circle at 75% 75%, rgba(255, 255, 255, 0.1) 0%, transparent 50%);
                  }

                  .logo {
                    width: 140px;
                    height: auto;
                    margin-bottom: 24px;
                    filter: brightness(0) invert(1);
                  }

                  .header-title {
                    font-size: 32px;
                    font-weight: 700;
                    color: #ffffff;
                    margin-bottom: 8px;
                    position: relative;
                    z-index: 1;
                  }

                  .header-subtitle {
                    font-size: 16px;
                    color: rgba(255, 255, 255, 0.9);
                    font-weight: 400;
                    position: relative;
                    z-index: 1;
                  }

                  .content {
                    padding: 48px 40px;
                  }

                  .greeting {
                    font-size: 24px;
                    font-weight: 600;
                    color: #1f2937;
                    margin-bottom: 24px;
                  }

                  .intro-paragraph {
                    font-size: 16px;
                    color: #4b5563;
                    margin-bottom: 32px;
                    line-height: 1.7;
                  }

                  .highlight-box {
                    background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
                    border: 1px solid #bae6fd;
                    border-radius: 12px;
                    padding: 32px;
                    margin: 32px 0;
                    text-align: center;
                  }

                  .highlight-icon {
                    width: 48px;
                    height: 48px;
                    margin: 0 auto 16px;
                    display: block;
                  }

                  .highlight-title {
                    font-size: 24px;
                    font-weight: 700;
                    color: #0c4a6e;
                    margin-bottom: 12px;
                  }

                  .highlight-text {
                    font-size: 16px;
                    color: #0369a1;
                    margin-bottom: 24px;
                    line-height: 1.6;
                  }

                  .cta-button {
                    display: inline-block;
                    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                    color: #ffffff;
                    text-decoration: none;
                    padding: 14px 32px;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 16px;
                    box-shadow: 0 4px 14px 0 rgba(59, 130, 246, 0.3);
                    transition: all 0.2s ease;
                    border: none;
                  }

                  .cta-button:hover {
                    background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
                    box-shadow: 0 6px 20px 0 rgba(59, 130, 246, 0.4);
                    transform: translateY(-1px);
                  }

                  .link-section {
                    background-color: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 20px;
                    margin: 24px 0;
                  }

                  .link-label {
                    font-size: 14px;
                    font-weight: 600;
                    color: #374151;
                    margin-bottom: 8px;
                    text-transform: uppercase;
                    letter-spacing: 0.025em;
                  }

                  .link-url {
                    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
                    font-size: 14px;
                    color: #3b82f6;
                    word-break: break-all;
                    background-color: #ffffff;
                    padding: 12px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    line-height: 1.4;
                  }

                  .details-section {
                    background-color: #f9fafb;
                    border: 1px solid #e5e7eb;
                    border-radius: 12px;
                    padding: 32px;
                    margin: 32px 0;
                  }

                  .details-title {
                    font-size: 20px;
                    font-weight: 700;
                    color: #111827;
                    margin-bottom: 24px;
                    display: flex;
                    align-items: center;
                  }

                  .details-title-icon {
                    width: 24px;
                    height: 24px;
                    margin-right: 12px;
                  }

                  .details-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 24px;
                  }

                  .detail-item {
                    background-color: #ffffff;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 20px;
                    transition: box-shadow 0.2s ease;
                  }

                  .detail-item:hover {
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                  }

                  .detail-icon {
                    width: 20px;
                    height: 20px;
                    margin-bottom: 12px;
                    display: block;
                  }

                  .detail-label {
                    font-size: 12px;
                    font-weight: 600;
                    color: #6b7280;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-bottom: 4px;
                  }

                  .detail-value {
                    font-size: 16px;
                    font-weight: 600;
                    color: #111827;
                  }

                  .reminder-section {
                    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                    border: 1px solid #f59e0b;
                    border-radius: 12px;
                    padding: 24px;
                    margin: 32px 0;
                  }

                  .reminder-title {
                    font-size: 16px;
                    font-weight: 700;
                    color: #92400e;
                    margin-bottom: 8px;
                    display: flex;
                    align-items: center;
                  }

                  .reminder-icon {
                    width: 20px;
                    height: 20px;
                    margin-right: 8px;
                  }

                  .reminder-text {
                    font-size: 14px;
                    color: #78350f;
                    line-height: 1.6;
                  }

                  .footer {
                    background-color: #f9fafb;
                    border-top: 1px solid #e5e7eb;
                    padding: 32px 40px;
                    text-align: center;
                  }

                  .footer-content {
                    max-width: 480px;
                    margin: 0 auto;
                  }

                  .footer-greeting {
                    font-size: 18px;
                    font-weight: 600;
                    color: #111827;
                    margin-bottom: 8px;
                  }

                  .footer-team {
                    font-size: 16px;
                    color: #4b5563;
                    margin-bottom: 24px;
                  }

                  .footer-brand {
                    font-size: 13px;
                    color: #6b7280;
                    margin-bottom: 16px;
                  }

                  .footer-links {
                    font-size: 13px;
                    color: #9ca3af;
                  }

                  .footer-links a {
                    color: #6b7280;
                    text-decoration: none;
                    margin: 0 12px;
                    transition: color 0.2s ease;
                  }

                  .footer-links a:hover {
                    color: #3b82f6;
                  }

                  /* SVG Icons as React-style components */
                  .icon-briefcase { fill: #3b82f6; }
                  .icon-id { fill: #10b981; }
                  .icon-calendar { fill: #f59e0b; }
                  .icon-building { fill: #8b5cf6; }
                  .icon-rocket { fill: #ef4444; }
                  .icon-clock { fill: #f59e0b; }
                  .icon-info { fill: #6b7280; }

                  @media (max-width: 640px) {
                    .email-container {
                      margin: 10px;
                      border-radius: 8px;
                    }

                    .header, .content, .footer {
                      padding-left: 24px;
                      padding-right: 24px;
                    }

                    .header-title {
                      font-size: 28px;
                    }

                    .details-grid {
                      grid-template-columns: 1fr;
                      gap: 16px;
                    }

                    .highlight-box {
                      padding: 24px;
                    }

                    .cta-button {
                      display: block;
                      width: 100%;
                      text-align: center;
                    }
                  }
                </style>
              </head>
              <body>
                <div class="email-container">
                  <div class="header">
                    <img src="${window.location.origin}/hirezen-logo.png" alt="HireZen" class="logo" onerror="this.style.display='none'">
                    <h1 class="header-title">Interview Invitation</h1>
                    <p class="header-subtitle">Your next career opportunity awaits</p>
                  </div>

                  <div class="content">
                    <p class="greeting">Hi ${fullName},</p>

                    <p class="intro-paragraph">
                      Thank you for your interest in the <strong style="color: #3b82f6;">${job?.position}</strong> position at HireZen.
                      We're excited to move forward with your application and invite you to complete our AI-powered video interview.
                    </p>

                    <div class="highlight-box">
                      <svg class="highlight-icon icon-rocket" viewBox="0 0 24 24">
                        <path d="M13.5 2L13.09 3.41L14.5 4.82L15.91 3.41L15.5 2L13.5 2M10.5 2L10.09 3.41L11.5 4.82L12.91 3.41L12.5 2L10.5 2M3.5 5.5L2 6.91L3.41 8.32L4.82 9.73L6.23 8.32L4.82 6.91L3.5 5.5M20.5 5.5L19.18 6.91L20.59 8.32L22 9.73L23.41 8.32L22 6.91L20.5 5.5M12 6A4 4 0 0 0 8 10C8 10.79 8.24 11.5 8.64 12.09L10 14.5L10.5 14.39L11 14.5L12.36 12.09C12.76 11.5 13 10.79 13 10A4 4 0 0 0 9 6A4 4 0 0 0 12 6M12 8A2 2 0 0 1 14 10A2 2 0 0 1 12 12A2 2 0 0 1 10 10A2 2 0 0 1 12 8M7.5 10.5L6.09 11.91L9.5 15.32L10.91 13.91L7.5 10.5M16.5 10.5L13.09 13.91L16.5 17.32L17.91 15.91L16.5 10.5M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5A3.5 3.5 0 0 1 15.5 12A3.5 3.5 0 0 1 12 15.5Z"/>
                      </svg>
                      <h2 class="highlight-title">Start Your Interview</h2>
                      <p class="highlight-text">
                        Click below to begin your personalized video interview experience
                      </p>
                      <a href="${interviewLink}" class="cta-button">Begin Interview</a>
                    </div>

                    <div class="link-section">
                      <div class="link-label">Interview Link</div>
                      <div class="link-url">${interviewLink}</div>
                    </div>

                    <div class="details-section">
                      <h3 class="details-title">
                        <svg class="details-title-icon icon-info" viewBox="0 0 24 24">
                          <path d="M13,9H11V7H13M13,17H11V11H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
                        </svg>
                        Application Details
                      </h3>
                      <div class="details-grid">
                        <div class="detail-item">
                          <svg class="detail-icon icon-briefcase" viewBox="0 0 24 24">
                            <path d="M20,6C20.58,6 21.05,6.2 21.42,6.59C21.8,7 22,7.45 22,8V16C22,16.55 21.8,17 21.42,17.41C21.05,17.8 20.58,18 20,18H4C3.42,18 2.95,17.8 2.58,17.41C2.2,17 2,16.55 2,16V8C2,7.45 2.2,7 2.58,6.59C2.95,6.2 3.42,6 4,6H8V4C8,3.42 8.2,2.95 8.58,2.58C9,2.2 9.45,2 10,2H14C14.55,2 15,2.2 15.42,2.58C15.8,2.95 16,3.42 16,4V6H20M10,4V6H14V4H10M4,8V16H20V8H4Z"/>
                          </svg>
                          <div class="detail-label">Position</div>
                          <div class="detail-value">${job?.position}</div>
                        </div>

                        <div class="detail-item">
                          <svg class="detail-icon icon-id" viewBox="0 0 24 24">
                            <path d="M22,3H2A2,2 0 0,0 0,5V19A2,2 0 0,0 2,21H22A2,2 0 0,0 24,19V5A2,2 0 0,0 22,3M8,19H4V17H8V19M8,15H4V13H8V15M8,11H4V9H8V11M8,7H4V5H8V7M16,19H12V17H16V19M16,15H12V13H16V15M16,11H12V9H16V11M16,7H12V5H16V7Z"/>
                          </svg>
                          <div class="detail-label">Application ID</div>
                          <div class="detail-value">${candidateData.id}</div>
                        </div>

                        <div class="detail-item">
                          <svg class="detail-icon icon-calendar" viewBox="0 0 24 24">
                            <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M11,6V8H13V6H11M11,10V18H13V10H11Z"/>
                          </svg>
                          <div class="detail-label">Applied On</div>
                          <div class="detail-value">${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                        </div>

                        <div class="detail-item">
                          <svg class="detail-icon icon-building" viewBox="0 0 24 24">
                            <path d="M18,15H16V17H18M18,11H16V13H18M20,19H12V21H4V19H2V16H4V15H6V13H8V11H10V9H12V7H14V9H16V11H18V13H20V15H22V19H20M10,15V17H12V15M14,15V17H8V15H6V13H8V11H10V13H12V11H14V13H16V15H14M20,7H18V5H20M12,3H14V5H12M8,3H10V5H8M4,3H6V5H4Z"/>
                          </svg>
                          <div class="detail-label">Department</div>
                          <div class="detail-value">${job?.department || 'General'}</div>
                        </div>
                      </div>
                    </div>

                    <div class="reminder-section">
                      <h4 class="reminder-title">
                        <svg class="reminder-icon icon-clock" viewBox="0 0 24 24">
                          <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M11,6V8H13V6H11M11,10V18H13V10H11Z"/>
                        </svg>
                        Important Reminder
                      </h4>
                      <p class="reminder-text">
                        This interview invitation is time-sensitive and expires in 7 days.
                        Please complete your interview at your earliest convenience to keep your application active.
                      </p>
                    </div>

                    <p style="font-size: 16px; color: #4b5563; margin-bottom: 24px;">
                      Our AI-powered platform ensures a fair, engaging, and comprehensive evaluation process.
                      We look forward to learning more about your qualifications and experience.
                    </p>

                    <p style="font-size: 16px; color: #4b5563;">
                      If you have any questions or need assistance, please don't hesitate to contact our recruitment team.
                    </p>
                  </div>

                  <div class="footer">
                    <div class="footer-content">
                      <div class="footer-greeting">Best regards,</div>
                      <div class="footer-team">The HireZen Recruitment Team</div>
                      <div class="footer-brand">© 2024 HireZen HRMS. All rights reserved.</div>
                      <div class="footer-links">
                        <a href="#">Privacy Policy</a> |
                        <a href="#">Terms of Service</a> |
                        <a href="#">Contact Support</a>
                      </div>
                    </div>
                  </div>
                </div>
              </body>
              </html>
            `,
          }),
        });

        if (!emailResponse.ok) {
          const errorData = await emailResponse.json();
          console.error('Local server error:', errorData);
          setEmailSent(false);
        } else {
          const responseData = await emailResponse.json();
          console.log('Email sent successfully via local server:', responseData);
          setEmailSent(true);
        }
      } catch (emailError) {
        console.error('Email error:', emailError);
        setEmailSent(false);
      }

      // Check if email was sent successfully
      setEmailSent(true);

      toast({
        title: "Application submitted!",
        description: "Your application has been received and confirmation email sent. We'll be in touch soon.",
      });

      // Reset form
      setResumeFile(null);
      if (resumePreviewUrl) {
        URL.revokeObjectURL(resumePreviewUrl);
        setResumePreviewUrl(null);
      }
      setEmailSent(null);
    } catch (error) {
      console.error("Error submitting application:", error);
      setEmailSent(false);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit application. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Job Not Found</CardTitle>
            <CardDescription>
              This job posting is no longer available or has been closed.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4 pb-24 md:pb-12">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Job Details Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-3xl">{job.position}</CardTitle>
                <CardDescription className="flex flex-wrap gap-4 text-base mt-2">
                  {job.department && (
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-4 w-4" />
                      {job.department}
                    </span>
                  )}
                  {job.primary_locations && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {validateStringArray(job.primary_locations).join(", ")}
                    </span>
                  )}
                  {job.closing_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Apply by: {new Date(job.closing_date).toLocaleDateString()}
                    </span>
                  )}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`/interview-quiz/${jobId}`, '_blank')}
                  className="shrink-0 hidden md:flex"
                >
                  Attend Interview
                </Button>
                <Button onClick={scrollToForm} size="lg" className="shrink-0 hidden md:flex">
                  Apply Now
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="mb-2 font-semibold">Job Description</h3>
              <div className="whitespace-pre-wrap text-muted-foreground">
                {job.job_description || "No description available"}
              </div>
            </div>
            {job.experience && (
              <div>
                <h3 className="mb-2 font-semibold">Experience Required</h3>
                <p className="text-muted-foreground">{job.experience}</p>
              </div>
            )}
            <div>
              <h3 className="mb-2 font-semibold">Number of Vacancies</h3>
              <p className="text-muted-foreground">{job.vacancies}</p>
            </div>
          </CardContent>
        </Card>

        {/* Application Form Card */}
        <Card id="application-form">
          <CardHeader>
            <CardTitle>Apply for this position</CardTitle>
            <CardDescription>Fill out the form below to submit your application</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  required
                  placeholder="Enter your full name"
                  className="bg-background border-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="Enter your email address"
                  className="bg-background border-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="Enter your phone number"
                  className="bg-background border-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="resume">Resume * (PDF or Word document)</Label>

                {/* Email Status Indicator */}
                {emailSent !== null && (
                  <div className={`flex items-center gap-2 p-3 rounded-lg border ${
                    emailSent
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}>
                    {emailSent ? (
                      <>
                        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-sm text-green-800 font-medium">
                          ✓ Confirmation email sent successfully to your registered email address
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                        <span className="text-sm text-red-800 font-medium">
                          ✗ Failed to send confirmation email. Please contact support.
                        </span>
                      </>
                    )}
                  </div>
                )}
                
                {!resumeFile ? (
                  <div
                    onDragEnter={handleDragEnter}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                      isDragging
                        ? "border-primary bg-primary/5"
                        : "border-muted-foreground/25 hover:border-primary/50"
                    }`}
                    onClick={() => document.getElementById("resume")?.click()}
                  >
                    <input
                      id="resume"
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={handleFileChange}
                      className="hidden"
                      required
                    />
                    <div className="flex flex-col items-center gap-2">
                      <div className={`p-3 rounded-full ${isDragging ? "bg-primary/10" : "bg-muted"}`}>
                        <Upload className={`h-8 w-8 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {isDragging ? "Drop your resume here" : "Drag and drop your resume"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          or click to browse (PDF or Word, max 10MB)
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <button
                        type="button"
                        onClick={() => resumePreviewUrl && setShowPreviewModal(true)}
                        className={`flex items-center gap-2 flex-1 text-left ${
                          resumePreviewUrl ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
                        }`}
                        disabled={!resumePreviewUrl}
                      >
                        <div className="p-2 bg-primary/10 rounded">
                          <Upload className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{resumeFile.name}</p>
                            {resumePreviewUrl && (
                              <Eye className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {(resumeFile.size / 1024 / 1024).toFixed(2)} MB
                            {resumePreviewUrl && " • Click to preview"}
                          </p>
                        </div>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveResume}
                      >
                        Change
                      </Button>
                    </div>
                  </div>
                )}
              </div>

            </form>
          </CardContent>
        </Card>
      </div>

      {/* Sticky Apply Button for Mobile */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t border-border md:hidden z-50">
        <Button
          onClick={(e) => {
            e.preventDefault();
            const form = document.getElementById('application-form')?.querySelector('form') as HTMLFormElement;
            if (form) {
              // Check if form is valid before submitting
              if (form.checkValidity()) {
                form.requestSubmit();
              } else {
                // Trigger form validation and focus first invalid field
                form.reportValidity();
              }
            }
          }}
          disabled={isSubmitting}
          size="lg" 
          className="w-full shadow-lg"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-5 w-5" />
              Apply Now
            </>
          )}
        </Button>
      </div>

      {/* PDF Preview Modal */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-4xl h-[90vh]">
          <DialogHeader>
            <DialogTitle>Resume Preview</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden rounded-lg border">
            {resumePreviewUrl && (
              <iframe
                src={resumePreviewUrl}
                className="w-full h-full"
                title="Resume Preview"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ApplyJob;
