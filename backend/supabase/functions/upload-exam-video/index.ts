import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UploadVideoRequest {
  examBookingId: string;
  videoBlob: string; // Base64 encoded video
  chunkIndex?: number;
  isFinal?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { examBookingId, videoBlob, chunkIndex, isFinal = false }: UploadVideoRequest = await req.json();

    if (!examBookingId || !videoBlob) {
      throw new Error("examBookingId and videoBlob are required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Convert base64 to blob
    const base64Data = videoBlob.split(',')[1] || videoBlob;
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'video/webm' });

    // Generate file name
    const timestamp = Date.now();
    const fileName = isFinal 
      ? `exams/${examBookingId}/final_${timestamp}.webm`
      : `exams/${examBookingId}/chunk_${chunkIndex || 0}_${timestamp}.webm`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from("exam-videos")
      .upload(fileName, blob, {
        contentType: "video/webm",
        upsert: false,
      });

    if (error) {
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("exam-videos")
      .getPublicUrl(fileName);

    // Update exam booking with video URL if final
    if (isFinal) {
      await supabase
        .from("exam_bookings")
        .update({
          video_url: urlData.publicUrl,
          video_recorded: true,
        })
        .eq("id", examBookingId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        url: urlData.publicUrl,
        fileName: fileName,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error uploading exam video:", error);
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

