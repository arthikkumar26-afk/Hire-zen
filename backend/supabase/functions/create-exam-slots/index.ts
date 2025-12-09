import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateSlotRequest {
  jobId: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  slotDuration?: number; // minutes
  timeSlots?: number[]; // Hour slots [9, 10, 11, 14, 15, 16]
  timezone?: string;
  maxCandidatesPerSlot?: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      jobId, 
      startDate, 
      endDate, 
      slotDuration = 60,
      timeSlots = [9, 10, 11, 14, 15, 16],
      timezone = 'UTC',
      maxCandidatesPerSlot = 1
    }: CreateSlotRequest = await req.json();

    if (!jobId || !startDate || !endDate) {
      throw new Error("jobId, startDate, and endDate are required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify job exists
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      throw new Error("Job not found");
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const slots: any[] = [];

    // Generate slots for each day
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];
      
      for (const hour of timeSlots) {
        const startTime = `${hour.toString().padStart(2, '0')}:00:00`;
        const endHour = hour + Math.floor(slotDuration / 60);
        const endMinute = slotDuration % 60;
        const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}:00:00`;

        slots.push({
          job_id: jobId,
          slot_date: dateStr,
          slot_start_time: startTime,
          slot_end_time: endTime,
          duration_minutes: slotDuration,
          max_candidates: maxCandidatesPerSlot,
          booked_count: 0,
          timezone: timezone,
          is_active: true
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Insert slots in batch
    const { data: insertedSlots, error: insertError } = await supabase
      .from("exam_slots")
      .insert(slots)
      .select();

    if (insertError) {
      throw insertError;
    }

    console.log(`Created ${insertedSlots?.length || 0} exam slots`);

    return new Response(
      JSON.stringify({ 
        success: true,
        slotsCreated: insertedSlots?.length || 0,
        slots: insertedSlots
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in create-exam-slots function:", error);
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

