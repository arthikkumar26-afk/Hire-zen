import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateExamInvitationRequest {
  candidateId: string;
  jobId: string;
  deadlineDays?: number;
  examDurationMinutes?: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { candidateId, jobId, deadlineDays, examDurationMinutes }: CreateExamInvitationRequest = await req.json();

    if (!candidateId || !jobId) {
      return new Response(
        JSON.stringify({ error: "candidateId and jobId are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if exam invitation already exists
    const { data: existingBooking } = await supabase
      .from("exam_bookings")
      .select("id, status")
      .eq("candidate_id", candidateId)
      .eq("job_id", jobId)
      .in("status", ["pending", "scheduled", "in_progress"])
      .maybeSingle();

    if (existingBooking) {
      return new Response(
        JSON.stringify({
          success: true,
          bookingId: existingBooking.id,
          message: "Exam invitation already exists",
          existing: true,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get job configuration
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("exam_deadline_days, exam_duration_minutes, requires_exam")
      .eq("id", jobId)
      .single();

    if (jobError) throw jobError;

    // Skip exam if not required
    if (job.requires_exam === false) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Exam not required for this job",
          skipped: true,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Use job defaults or provided values
    const deadlineDaysToUse = deadlineDays || job.exam_deadline_days || 7;
    const examDurationToUse = examDurationMinutes || job.exam_duration_minutes || 60;

    // Calculate deadline (deadlineDays from now)
    const deadlineAt = new Date();
    deadlineAt.setDate(deadlineAt.getDate() + deadlineDaysToUse);

    // Create exam invitation (booking without slot)
    const { data: booking, error: bookingError } = await supabase
      .from("exam_bookings")
      .insert({
        candidate_id: candidateId,
        job_id: jobId,
        exam_slot_id: null, // No slot for on-demand
        exam_token: crypto.randomUUID(),
        status: "pending",
        deadline_at: deadlineAt.toISOString(),
        exam_duration_minutes: examDurationToUse,
        time_limit_seconds: examDurationToUse * 60,
        is_on_demand: true,
      })
      .select()
      .single();

    if (bookingError) throw bookingError;

    // Send exam invitation email
    await supabase.functions.invoke("send-candidate-email", {
      body: {
        candidateId: candidateId,
        type: "exam_invitation",
        examToken: booking.exam_token,
        deadlineDays: deadlineDaysToUse,
      },
    }).catch((err) => console.error("Failed to send exam invitation email:", err));

    return new Response(
      JSON.stringify({
        success: true,
        bookingId: booking.id,
        examToken: booking.exam_token,
        deadlineAt: booking.deadline_at,
        examDurationMinutes: examDurationToUse,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error creating exam invitation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);

