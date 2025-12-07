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
  type: "resume_processed" | "stage_change" | "ai_interview";
  oldStage?: string;
  newStage?: string;
  jobPosition?: string;
  interviewToken?: string;
}

const getEmailTemplate = (
  type: string,
  candidateName: string,
  oldStage?: string,
  newStage?: string,
  jobPosition?: string,
  interviewToken?: string
) => {
  if (type === "resume_processed") {
    return {
      subject: "Your Resume Has Been Received",
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
              .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎉 Resume Received!</h1>
              </div>
              <div class="content">
                <p>Dear ${candidateName},</p>
                <p>Thank you for your interest in joining our team! We're excited to inform you that we've successfully received and processed your resume.</p>
                <p><strong>What's Next?</strong></p>
                <ul>
                  <li>Our AI system has analyzed your profile</li>
                  <li>Your resume is being matched with relevant positions</li>
                  <li>Our recruitment team will review your application shortly</li>
                </ul>
                <p>We'll keep you updated throughout the recruitment process. If your profile matches any of our open positions, you'll hear from us soon!</p>
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

    const { subject, html } = getEmailTemplate(type, candidateName, oldStage, newStage, position, interviewToken);

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
