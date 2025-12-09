import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BookSlotRequest {
  candidateId: string;
  jobId: string;
  examSlotId: string;
  timezone?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      candidateId, 
      jobId, 
      examSlotId,
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    }: BookSlotRequest = await req.json();

    if (!candidateId || !jobId || !examSlotId) {
      throw new Error("candidateId, jobId, and examSlotId are required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if candidate already has an active booking
    const { data: existingBooking } = await supabase
      .from("exam_bookings")
      .select("*")
      .eq("candidate_id", candidateId)
      .eq("job_id", jobId)
      .in("status", ['scheduled', 'checked_in', 'in_progress'])
      .single();

    if (existingBooking) {
      return new Response(
        JSON.stringify({ 
          error: "You already have an active exam booking",
          existingBooking
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get exam slot details
    const { data: slot, error: slotError } = await supabase
      .from("exam_slots")
      .select("*")
      .eq("id", examSlotId)
      .eq("is_active", true)
      .single();

    if (slotError || !slot) {
      throw new Error("Exam slot not found or not available");
    }

    // Check if slot has capacity
    if (slot.booked_count >= slot.max_candidates) {
      throw new Error("This exam slot is fully booked");
    }

    // Calculate scheduled times
    const slotDateTime = new Date(`${slot.slot_date}T${slot.slot_start_time}`);
    const scheduledStartTime = slotDateTime.toISOString();
    const scheduledEndTime = new Date(slotDateTime.getTime() + slot.duration_minutes * 60 * 1000).toISOString();

    // Create booking
    const { data: booking, error: bookingError } = await supabase
      .from("exam_bookings")
      .insert({
        candidate_id: candidateId,
        job_id: jobId,
        exam_slot_id: examSlotId,
        scheduled_start_time: scheduledStartTime,
        scheduled_end_time: scheduledEndTime,
        duration_minutes: slot.duration_minutes,
        time_limit_seconds: slot.duration_minutes * 60,
        time_zone: timezone,
        status: 'scheduled'
      })
      .select()
      .single();

    if (bookingError) {
      throw bookingError;
    }

    // Get candidate and job details for email
    const { data: candidate } = await supabase
      .from("candidates")
      .select("full_name, email")
      .eq("id", candidateId)
      .single();

    const { data: job } = await supabase
      .from("jobs")
      .select("position")
      .eq("id", jobId)
      .single();

    // Send confirmation email
    try {
      await supabase.functions.invoke("send-candidate-email", {
        body: {
          candidateId: candidateId,
          type: "exam_scheduled",
          examBookingId: booking.id,
          examToken: booking.exam_token,
          scheduledTime: scheduledStartTime,
          timezone: timezone,
          jobPosition: job?.position
        }
      });
    } catch (emailError) {
      console.error("Failed to send confirmation email:", emailError);
      // Don't fail the booking if email fails
    }

    console.log(`Exam slot booked for candidate ${candidateId}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        booking: {
          ...booking,
          exam_token: booking.exam_token, // Include token for exam access
          scheduled_start_time: booking.scheduled_start_time,
          scheduled_end_time: booking.scheduled_end_time
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in book-exam-slot function:", error);
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

