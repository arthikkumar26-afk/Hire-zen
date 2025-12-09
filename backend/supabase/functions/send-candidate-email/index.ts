import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

interface ResendResponse {
  id: string;
  from: string;
  to: string[];
  created_at: string;
}

interface ResendEmailParams {
  from: string;
  to: string[];
  subject: string;
  html: string;
}

class Resend {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async send(params: ResendEmailParams): Promise<ResendResponse> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Resend API error: ${error}`);
    }

    return await response.json();
  }

  get emails() {
    return {
      send: (params: ResendEmailParams) => this.send(params),
    };
  }
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY") || Deno.env.get("VITE_RESEND_API_KEY")!);

// Email configuration - using hire-zen.com domain
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "HireZen HR <hr@hire-zen.com>";
const EMAIL_REPLY_TO = Deno.env.get("EMAIL_REPLY_TO") || "hr@hire-zen.com";
const EMAIL_NOREPLY = Deno.env.get("EMAIL_NOREPLY") || "noreply@hire-zen.com";
const EMAIL_NOREPLY_NAME = Deno.env.get("EMAIL_NOREPLY_NAME") || "HireZen";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  candidateId: string;
  type: "resume_processed" | "stage_change" | "ai_interview" | "exam_scheduled" | "exam_invitation";
  oldStage?: string;
  newStage?: string;
  jobPosition?: string;
  interviewToken?: string;
  jobId?: string;
  examBookingId?: string;
  examToken?: string;
  scheduledTime?: string;
  timezone?: string;
  deadlineDays?: number;
}

const getEmailTemplate = (
  type: string,
  candidateName: string,
  oldStage?: string,
  newStage?: string,
  jobPosition?: string,
  interviewToken?: string,
  jobId?: string,
  candidateId?: string,
  examToken?: string,
  scheduledTime?: string,
  timezone?: string,
  deadlineDays?: number
) => {
  if (type === "resume_processed") {
    // Generate interview link if jobId and candidateId are provided
    const frontendUrl = Deno.env.get("VITE_FRONTEND_URL") || Deno.env.get("SUPABASE_URL")?.replace('/rest/v1', '').replace('/functions/v1', '') || "https://hire-zen.com";
    const interviewLink = (jobId && candidateId) 
      ? `${frontendUrl}/interview-quiz/${jobId}/${candidateId}`
      : null;
    
    return {
      subject: jobPosition ? `Next Step: Start Your Interview - ${jobPosition}` : "Next Step: Start Your Interview",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .header h1 { margin: 0; font-size: 28px; }
              .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 10px 10px; }
              .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; padding: 20px; }
              .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; margin: 30px 0; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3); }
              .button:hover { box-shadow: 0 6px 12px rgba(102, 126, 234, 0.4); }
              .highlight-box { background: #f0f9ff; border-left: 4px solid #667eea; padding: 20px; margin: 25px 0; border-radius: 4px; }
              .info-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
              ul { margin: 15px 0; padding-left: 25px; }
              li { margin: 8px 0; }
              .cta-section { text-align: center; margin: 35px 0; }
              .link-alternative { margin-top: 20px; padding: 15px; background: #f9fafb; border-radius: 6px; font-size: 12px; color: #6b7280; word-break: break-all; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎉 Resume Received!</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Let's continue your journey</p>
              </div>
              <div class="content">
                <p>Dear ${candidateName},</p>
                <p>Thank you for your interest in joining our team${jobPosition ? ` for the <strong>${jobPosition}</strong> position` : ""}! We're excited to inform you that we've successfully received and processed your resume.</p>
                
                ${interviewLink ? `
                <div class="highlight-box">
                  <h2 style="margin-top: 0; color: #1e40af;">🚀 Ready to Start Your Interview?</h2>
                  <p style="margin-bottom: 20px;">Our AI system has analyzed your profile. Now it's time to showcase your skills!</p>
                  
                  <div class="cta-section">
                    <a href="${interviewLink}" class="button">Start Interview Now</a>
                  </div>
                  
                  <div class="info-box">
                    <p style="margin: 0; font-weight: 600; color: #92400e;">📋 What to Expect:</p>
                    <ul style="margin-top: 10px; color: #78350f;">
                      <li>MCQ questions to assess your knowledge</li>
                      <li>Written/essay questions to showcase your skills</li>
                      <li>Video recording of your responses</li>
                      <li>Approximately 20-30 minutes to complete</li>
                    </ul>
                  </div>
                  
                  <div class="link-alternative">
                    <strong>Or copy this link:</strong><br>
                    ${interviewLink}
                  </div>
                </div>
                ` : `
                <p><strong>What's Next?</strong></p>
                <ul>
                  <li>Our AI system has analyzed your profile</li>
                  <li>Your resume is being matched with relevant positions</li>
                  <li>Our recruitment team will review your application shortly</li>
                </ul>
                `}
                
                ${interviewLink ? `
                <p><strong>💡 Tips for Success:</strong></p>
                <ul>
                  <li>Find a quiet, well-lit space for the video portion</li>
                  <li>Ensure your camera and microphone are working properly</li>
                  <li>Take your time to provide thoughtful answers</li>
                  <li>Be yourself and showcase your unique skills!</li>
                </ul>
                ` : ''}
                
                <p style="margin-top: 30px;">${interviewLink ? 'We look forward to learning more about you!' : 'We\'ll keep you updated throughout the recruitment process. If your profile matches any of our open positions, you\'ll hear from us soon!'}</p>
                
                <p>Best regards,<br><strong>HireZen HR Team</strong></p>
              </div>
              <div class="footer">
                <p><strong>HireZen - Modern Recruitment Platform</strong></p>
                <p>Email: <a href="mailto:hr@hire-zen.com" style="color: #667eea;">hr@hire-zen.com</a> | Website: <a href="https://hire-zen.com" style="color: #667eea;">hire-zen.com</a></p>
                <p style="color: #6b7280; font-size: 12px; margin-top: 16px;">This is an automated message from HireZen recruitment system.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    };
  } else if (type === "ai_interview") {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const interviewUrl = `${supabaseUrl.replace('/rest/v1', '')}/ai-interview/${interviewToken}`;
    
    return {
      subject: "AI Interview Invitation - Next Step in Your Application",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
              .button { display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
              .info-box { background: #e0e7ff; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; border-radius: 4px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎥 AI Interview Invitation</h1>
              </div>
              <div class="content">
                <p>Dear ${candidateName},</p>
                <p>Congratulations! 🎉 You've progressed to the next stage of the recruitment process${jobPosition ? ` for the <strong>${jobPosition}</strong> position` : ""}.</p>
                
                <p><strong>We're inviting you to complete an AI-powered video interview.</strong></p>
                
                <div class="info-box">
                  <p><strong>What to expect:</strong></p>
                  <ul>
                    <li>🎥 Video recording of your responses</li>
                    <li>💡 AI-generated questions based on the role</li>
                    <li>⏱️ Approximately 15-20 minutes to complete</li>
                    <li>📊 Instant AI evaluation of your answers</li>
                  </ul>
                </div>

                <p><strong>Important Tips:</strong></p>
                <ul>
                  <li>Find a quiet, well-lit space</li>
                  <li>Ensure your camera and microphone are working</li>
                  <li>Answer questions clearly and confidently</li>
                  <li>Be yourself and showcase your skills!</li>
                </ul>

                <div style="text-align: center;">
                  <a href="${interviewUrl}" class="button">Start AI Interview</a>
                </div>

                <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
                  This link is unique to you. Please complete the interview at your earliest convenience.
                </p>
                
                <p>Best of luck!</p>
                <p>Best regards,<br><strong>HireZen HR Team</strong></p>
              </div>
              <div class="footer">
                <p><strong>HireZen - Modern Recruitment Platform</strong></p>
                <p>Email: <a href="mailto:hr@hire-zen.com" style="color: #667eea;">hr@hire-zen.com</a> | Website: <a href="https://hire-zen.com" style="color: #667eea;">hire-zen.com</a></p>
                <p style="color: #6b7280; font-size: 12px; margin-top: 16px;">This is an automated message from HireZen recruitment system.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    };
  } else if (type === "exam_scheduled") {
    const frontendUrl = Deno.env.get("VITE_FRONTEND_URL") || Deno.env.get("SUPABASE_URL")?.replace('/rest/v1', '').replace('/functions/v1', '') || "https://hire-zen.com";
    const examLink = examToken ? `${frontendUrl}/exam/${examToken}` : null;
    const formattedTime = scheduledTime ? new Date(scheduledTime).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone || 'UTC'
    }) : 'TBD';
    
    return {
      subject: `Exam Scheduled - ${jobPosition || 'Screening Exam'}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .header h1 { margin: 0; font-size: 28px; }
              .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 10px 10px; }
              .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; padding: 20px; }
              .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; font-size: 16px; }
              .info-box { background: #f0f9ff; border-left: 4px solid #667eea; padding: 20px; margin: 25px 0; border-radius: 4px; }
              .warning-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
              ul { margin: 15px 0; padding-left: 25px; }
              li { margin: 8px 0; }
              .exam-details { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .exam-detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
              .exam-detail-row:last-child { border-bottom: none; }
              .exam-detail-label { font-weight: 600; color: #6b7280; }
              .exam-detail-value { color: #111827; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>📅 Exam Scheduled!</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Your screening exam is confirmed</p>
              </div>
              <div class="content">
                <p>Dear ${candidateName},</p>
                <p>Your screening exam for <strong>${jobPosition || 'the position'}</strong> has been successfully scheduled!</p>
                
                <div class="exam-details">
                  <div class="exam-detail-row">
                    <span class="exam-detail-label">📅 Date & Time:</span>
                    <span class="exam-detail-value">${formattedTime}</span>
                  </div>
                  <div class="exam-detail-row">
                    <span class="exam-detail-label">⏱️ Duration:</span>
                    <span class="exam-detail-value">60 minutes</span>
                  </div>
                  <div class="exam-detail-row">
                    <span class="exam-detail-label">🌐 Timezone:</span>
                    <span class="exam-detail-value">${timezone || 'UTC'}</span>
                  </div>
                  <div class="exam-detail-row">
                    <span class="exam-detail-label">📝 Format:</span>
                    <span class="exam-detail-value">Online (MCQ + Written)</span>
                  </div>
                </div>

                ${examLink ? `
                <div class="info-box">
                  <p style="margin: 0 0 15px 0; font-weight: 600; color: #1e40af;">📋 What to Expect:</p>
                  <ul style="margin-top: 10px; color: #0369a1;">
                    <li>Multiple Choice Questions (MCQ) - Technical skills assessment</li>
                    <li>Written/Descriptive Questions - Problem-solving and communication</li>
                    <li>Video recording will be active during the exam</li>
                    <li>Timer with auto-submit when time expires</li>
                  </ul>
                </div>

                <div class="warning-box">
                  <p style="margin: 0 0 10px 0; font-weight: 600; color: #92400e;">⚠️ Important Requirements:</p>
                  <ul style="margin-top: 10px; color: #78350f;">
                    <li>Valid ID for verification</li>
                    <li>Quiet, well-lit environment</li>
                    <li>Stable internet connection</li>
                    <li>Working camera and microphone</li>
                    <li>Chrome or Edge browser recommended</li>
                  </ul>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                  <p style="margin-bottom: 15px; font-weight: 600;">Your exam link will be available 15 minutes before the scheduled time.</p>
                  <a href="${examLink}" class="button">View Exam Details</a>
                </div>
                ` : ''}
                
                <p style="margin-top: 30px;"><strong>💡 Tips for Success:</strong></p>
                <ul>
                  <li>Join 10 minutes early to complete pre-exam checks</li>
                  <li>Have your ID ready for verification</li>
                  <li>Ensure your camera and microphone are working</li>
                  <li>Close unnecessary browser tabs and applications</li>
                  <li>Read each question carefully before answering</li>
                </ul>

                <p style="margin-top: 30px;">You'll receive a reminder email 24 hours before your exam and another 1 hour before.</p>
                
                <p>Best of luck with your exam!</p>
                <p>Best regards,<br><strong>HireZen HR Team</strong></p>
              </div>
              <div class="footer">
                <p><strong>HireZen - Modern Recruitment Platform</strong></p>
                <p>Email: <a href="mailto:hr@hire-zen.com" style="color: #667eea;">hr@hire-zen.com</a> | Website: <a href="https://hire-zen.com" style="color: #667eea;">hire-zen.com</a></p>
                <p style="color: #6b7280; font-size: 12px; margin-top: 16px;">This is an automated message from HireZen recruitment system.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    };
  } else if (type === "exam_scheduled") {
    const frontendUrl = Deno.env.get("VITE_FRONTEND_URL") || Deno.env.get("SUPABASE_URL")?.replace('/rest/v1', '').replace('/functions/v1', '') || "https://hire-zen.com";
    const examLink = examToken ? `${frontendUrl}/exam/${examToken}` : null;
    const formattedTime = scheduledTime ? new Date(scheduledTime).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone || 'UTC'
    }) : 'TBD';
    
    return {
      subject: `Exam Scheduled - ${jobPosition || 'Screening Exam'}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .header h1 { margin: 0; font-size: 28px; }
              .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 10px 10px; }
              .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; padding: 20px; }
              .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; font-size: 16px; }
              .info-box { background: #f0f9ff; border-left: 4px solid #667eea; padding: 20px; margin: 25px 0; border-radius: 4px; }
              .warning-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
              ul { margin: 15px 0; padding-left: 25px; }
              li { margin: 8px 0; }
              .exam-details { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .exam-detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
              .exam-detail-row:last-child { border-bottom: none; }
              .exam-detail-label { font-weight: 600; color: #6b7280; }
              .exam-detail-value { color: #111827; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>📅 Exam Scheduled!</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Your screening exam is confirmed</p>
              </div>
              <div class="content">
                <p>Dear ${candidateName},</p>
                <p>Your screening exam for <strong>${jobPosition || 'the position'}</strong> has been successfully scheduled!</p>
                
                <div class="exam-details">
                  <div class="exam-detail-row">
                    <span class="exam-detail-label">📅 Date & Time:</span>
                    <span class="exam-detail-value">${formattedTime}</span>
                  </div>
                  <div class="exam-detail-row">
                    <span class="exam-detail-label">⏱️ Duration:</span>
                    <span class="exam-detail-value">60 minutes</span>
                  </div>
                  <div class="exam-detail-row">
                    <span class="exam-detail-label">🌐 Timezone:</span>
                    <span class="exam-detail-value">${timezone || 'UTC'}</span>
                  </div>
                </div>

                ${examLink ? `
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${examLink}" class="button">View Exam Details</a>
                </div>
                ` : ''}
                
                <p style="margin-top: 30px;">Best of luck with your exam!</p>
                <p>Best regards,<br><strong>HireZen HR Team</strong></p>
              </div>
              <div class="footer">
                <p><strong>HireZen - Modern Recruitment Platform</strong></p>
                <p>Email: <a href="mailto:hr@hire-zen.com" style="color: #667eea;">hr@hire-zen.com</a></p>
              </div>
            </div>
          </body>
        </html>
      `,
    };
  } else if (type === "exam_invitation") {
    const frontendUrl = Deno.env.get("VITE_FRONTEND_URL") || Deno.env.get("SUPABASE_URL")?.replace('/rest/v1', '').replace('/functions/v1', '') || "https://hire-zen.com";
    const examLink = examToken ? `${frontendUrl}/exam/${examToken}` : null;
    const deadlineText = deadlineDays ? `${deadlineDays} day${deadlineDays !== 1 ? 's' : ''}` : '7 days';
    
    return {
      subject: `Screening Exam Invitation - ${jobPosition || 'Complete Your Application'}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .header h1 { margin: 0; font-size: 28px; }
              .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 10px 10px; }
              .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; padding: 20px; }
              .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; margin: 30px 0; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3); }
              .button:hover { box-shadow: 0 6px 12px rgba(102, 126, 234, 0.4); }
              .info-box { background: #f0f9ff; border-left: 4px solid #667eea; padding: 20px; margin: 25px 0; border-radius: 4px; }
              .warning-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
              .highlight-box { background: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0; border-radius: 4px; }
              ul { margin: 15px 0; padding-left: 25px; }
              li { margin: 8px 0; }
              .exam-details { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .exam-detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
              .exam-detail-row:last-child { border-bottom: none; }
              .exam-detail-label { font-weight: 600; color: #6b7280; }
              .exam-detail-value { color: #111827; font-weight: 500; }
              .link-alternative { margin-top: 20px; padding: 15px; background: #f9fafb; border-radius: 6px; font-size: 12px; color: #6b7280; word-break: break-all; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>📝 Screening Exam Invitation</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Take it at your convenience</p>
              </div>
              <div class="content">
                <p>Dear ${candidateName},</p>
                <p>Thank you for submitting your application for <strong>${jobPosition || 'the position'}</strong>! We've reviewed your resume and would like to invite you to complete a screening exam.</p>
                
                <div class="highlight-box">
                  <h2 style="margin-top: 0; color: #047857;">✨ On-Demand Exam</h2>
                  <p style="margin-bottom: 0; color: #065f46;">You can take this exam at any time convenient for you, within the deadline below. No scheduling required - just click and start when you're ready!</p>
                </div>

                <div class="exam-details">
                  <div class="exam-detail-row">
                    <span class="exam-detail-label">⏱️ Exam Duration:</span>
                    <span class="exam-detail-value">60 minutes</span>
                  </div>
                  <div class="exam-detail-row">
                    <span class="exam-detail-label">📅 Deadline:</span>
                    <span class="exam-detail-value">${deadlineText} from now</span>
                  </div>
                  <div class="exam-detail-row">
                    <span class="exam-detail-label">🎯 Format:</span>
                    <span class="exam-detail-value">MCQ + Written Questions</span>
                  </div>
                </div>

                ${examLink ? `
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${examLink}" class="button">Start Exam Now</a>
                </div>
                
                <div class="link-alternative">
                  <strong>Or copy this link:</strong><br>
                  ${examLink}
                </div>
                ` : ''}
                
                <div class="info-box">
                  <p style="margin: 0; font-weight: 600; color: #1e40af;">📋 What to Expect:</p>
                  <ul style="margin-top: 10px; color: #1e3a8a;">
                    <li>AI-generated questions based on the job requirements</li>
                    <li>Multiple choice questions (MCQ) for technical assessment</li>
                    <li>Written/essay questions to showcase your skills</li>
                    <li>Video recording of your exam session for integrity</li>
                    <li>Complete the exam in one sitting (cannot pause)</li>
                  </ul>
                </div>

                <div class="warning-box">
                  <p style="margin: 0; font-weight: 600; color: #92400e;">⚠️ Before You Start:</p>
                  <ul style="margin-top: 10px; color: #78350f;">
                    <li>Ensure stable internet connection</li>
                    <li>Grant camera, microphone, and screen sharing permissions</li>
                    <li>Find a quiet, well-lit environment</li>
                    <li>Have your ID ready for verification</li>
                    <li>Set aside 60 minutes of uninterrupted time</li>
                  </ul>
                </div>

                <p style="margin-top: 30px;"><strong>💡 Tips for Success:</strong></p>
                <ul>
                  <li>Read each question carefully before answering</li>
                  <li>Manage your time wisely across all questions</li>
                  <li>Provide detailed, thoughtful written responses</li>
                  <li>Be yourself and showcase your unique skills!</li>
                </ul>
                
                <p style="margin-top: 30px;">Take your time, but don't wait until the last minute! We recommend completing the exam within the first few days.</p>
                
                <p>Best of luck!</p>
                <p>Best regards,<br><strong>HireZen HR Team</strong></p>
              </div>
              <div class="footer">
                <p><strong>HireZen - Modern Recruitment Platform</strong></p>
                <p>Email: <a href="mailto:hr@hire-zen.com" style="color: #667eea;">hr@hire-zen.com</a> | Website: <a href="https://hire-zen.com" style="color: #667eea;">hire-zen.com</a></p>
                <p style="color: #6b7280; font-size: 12px; margin-top: 16px;">This is an automated message from HireZen recruitment system.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    };
  } else {
    const stageLabels: Record<string, string> = {
      pending: "Application Review",
      hr: "HR Screening",
      written_test: "Written Test",
      demo_slot: "Demo Slot Selection",
      demo_schedule: "Demo Scheduled",
      feedback_result: "Feedback & Results",
      interaction: "Final Interaction",
      bgv: "Background Verification",
      confirmation: "Confirmation",
      upload_documents: "Document Upload",
      verify: "Verification",
      approval: "Approval",
      offer_letter: "Offer Letter",
      onboarding: "Onboarding",
    };

    const newStageLabel = stageLabels[newStage || ""] || newStage;
    const oldStageLabel = stageLabels[oldStage || ""] || oldStage;

    return {
      subject: `Application Update: Moving to ${newStageLabel}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
              .status-badge { display: inline-block; background: #10b981; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; }
              .progress { background: #e5e7eb; height: 8px; border-radius: 4px; margin: 20px 0; overflow: hidden; }
              .progress-bar { background: #667eea; height: 100%; width: 60%; border-radius: 4px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>📋 Application Status Update</h1>
              </div>
              <div class="content">
                <p>Dear ${candidateName},</p>
                <p>We have an update regarding your application${jobPosition ? ` for the <strong>${jobPosition}</strong> position` : ""}!</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <p style="color: #6b7280; margin-bottom: 10px;">Your application has moved to:</p>
                  <span class="status-badge">${newStageLabel}</span>
                </div>

                <div class="progress">
                  <div class="progress-bar"></div>
                </div>

                ${
                  newStage === "hr"
                    ? "<p>Our HR team will be reviewing your profile and will contact you soon to schedule an initial screening.</p>"
                    : ""
                }
                ${
                  newStage === "written_test"
                    ? "<p>Congratulations! You've been selected for the written test phase. You'll receive details about the test shortly.</p>"
                    : ""
                }
                ${
                  newStage === "demo_schedule"
                    ? "<p>Great news! We'd like to schedule a demo session with you. Our team will reach out with available time slots.</p>"
                    : ""
                }
                ${
                  newStage === "offer_letter"
                    ? "<p>🎉 <strong>Congratulations!</strong> We're pleased to extend an offer to join our team. You'll receive your official offer letter shortly.</p>"
                    : ""
                }
                ${
                  newStage === "onboarding"
                    ? "<p>Welcome aboard! We're excited to have you join us. You'll receive onboarding information and next steps soon.</p>"
                    : ""
                }

                <p>If you have any questions, please don't hesitate to reach out to our recruitment team.</p>
                
                <p>Best regards,<br><strong>HireZen HR Team</strong></p>
              </div>
              <div class="footer">
                <p><strong>HireZen - Modern Recruitment Platform</strong></p>
                <p>Email: <a href="mailto:hr@hire-zen.com" style="color: #667eea;">hr@hire-zen.com</a> | Website: <a href="https://hire-zen.com" style="color: #667eea;">hire-zen.com</a></p>
                <p style="color: #6b7280; font-size: 12px; margin-top: 16px;">This is an automated message from HireZen recruitment system.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    };
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { candidateId, type, oldStage, newStage, jobPosition, interviewToken }: EmailRequest = await req.json();

    console.log("Sending email for candidate:", candidateId, "type:", type);

    // Get candidate details from database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .select("full_name, email, job_id, jobs(position)")
      .eq("id", candidateId)
      .single();

    if (candidateError || !candidate) {
      console.error("Candidate not found:", candidateError);
      throw new Error("Candidate not found");
    }

    const candidateName = candidate.full_name || "Candidate";
    const candidateEmail = candidate.email;
    const position = jobPosition || (candidate.jobs as any)?.position || "";
    const jobIdFromCandidate = (candidate as any).job_id || null;
    const jobIdToUse = jobId || jobIdFromCandidate;

    const { subject, html } = getEmailTemplate(
      type, 
      candidateName, 
      oldStage, 
      newStage, 
      position, 
      interviewToken,
      jobIdToUse,
      candidateId,
      examToken,
      scheduledTime,
      timezone
    );

    // Determine sender based on email type
    let fromEmail = EMAIL_FROM;
    let replyTo = EMAIL_REPLY_TO;

    // Use noreply for automated confirmations (but still allow replies via replyTo)
    if (type === "resume_processed") {
      fromEmail = `${EMAIL_NOREPLY_NAME} <${EMAIL_NOREPLY}>`;
      replyTo = EMAIL_REPLY_TO; // Replies go to HR team
    }

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: fromEmail,
      replyTo: replyTo,
      to: [candidateEmail],
      subject: subject,
      html: html,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailId: emailResponse.id,
        message: "Email sent successfully" 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-candidate-email function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
