import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GetSlotsRequest {
  jobId: string;
  startDate?: string; // Optional: filter from date
  endDate?: string; // Optional: filter to date
  timezone?: string;
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
      timezone
    }: GetSlotsRequest = await req.json();

    if (!jobId) {
      throw new Error("jobId is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase
      .from("exam_slots")
      .select("*")
      .eq("job_id", jobId)
      .eq("is_active", true)
      .gte("booked_count", 0) // Available slots
      .lt("booked_count", supabase.raw("max_candidates")) // Not fully booked
      .order("slot_date", { ascending: true })
      .order("slot_start_time", { ascending: true });

    // Filter by date range if provided
    if (startDate) {
      query = query.gte("slot_date", startDate);
    }
    if (endDate) {
      query = query.lte("slot_date", endDate);
    } else {
      // Default: show next 14 days
      const defaultEndDate = new Date();
      defaultEndDate.setDate(defaultEndDate.getDate() + 14);
      query = query.lte("slot_date", defaultEndDate.toISOString().split('T')[0]);
    }

    // Only show future slots
    const today = new Date().toISOString().split('T')[0];
    query = query.gte("slot_date", today);

    const { data: slots, error } = await query;

    if (error) {
      throw error;
    }

    // Group slots by date for easier UI rendering
    const slotsByDate: Record<string, any[]> = {};
    slots?.forEach((slot: any) => {
      const dateKey = slot.slot_date;
      if (!slotsByDate[dateKey]) {
        slotsByDate[dateKey] = [];
      }
      slotsByDate[dateKey].push(slot);
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        slots: slots || [],
        slotsByDate,
        totalSlots: slots?.length || 0
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in get-available-exam-slots function:", error);
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

