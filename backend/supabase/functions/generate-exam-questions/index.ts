import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateExamQuestionsRequest {
  jobId: string;
  jobDescription?: string;
  position?: string;
  examDurationMinutes?: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobId, jobDescription, position, examDurationMinutes = 60 }: GenerateExamQuestionsRequest = await req.json();

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: "jobId is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Load job details if not provided
    let jobDesc = jobDescription;
    let jobPosition = position;

    if (!jobDesc || !jobPosition) {
      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .select("job_description, position, interview_questions")
        .eq("id", jobId)
        .single();

      if (jobError) throw jobError;

      jobDesc = job.job_description || "";
      jobPosition = job.position || "";

      // Check if job has custom questions
      if (job.interview_questions && Array.isArray(job.interview_questions)) {
        return new Response(
          JSON.stringify({ questions: job.interview_questions }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    console.log("Generating exam questions for position:", jobPosition);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Calculate number of questions based on duration (roughly 2-3 minutes per question)
    const numQuestions = Math.min(Math.max(Math.floor(examDurationMinutes / 3), 10), 30);

    const prompt = `You are an expert HR interviewer. Generate a comprehensive screening exam for a ${jobPosition} position.

Job Description:
${jobDesc || "No specific job description provided"}

Requirements:
- Generate EXACTLY ${numQuestions} questions total
- FIRST 10 questions MUST be Multiple Choice Questions (MCQ) with 4 options each
- REMAINING ${numQuestions - 10} questions MUST be written/descriptive questions
- Mix of technical skills, problem-solving, behavioral, and role-specific questions
- Questions should be relevant to the ${jobPosition} role
- Each question should be clear and specific
- For MCQ: one option must be the correct answer
- Include expected answer guideline for evaluation
- Vary difficulty levels (entry, mid, senior)

Return ONLY a JSON array in this exact format:
[
  {
    "question": "MCQ question text here?",
    "category": "technical",
    "type": "mcq",
    "difficulty": "entry",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "expectedAnswer": "The correct option from above"
  },
  {
    "question": "Written question text here?",
    "category": "behavioral",
    "type": "written",
    "difficulty": "mid",
    "expectedAnswer": "Brief guideline of what makes a good answer"
  }
]

IMPORTANT: First 10 must have type "mcq" with options array, remaining must have type "written" without options.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an expert HR interviewer. Always respond with valid JSON arrays only." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse the JSON response
    let questions;
    try {
      const jsonString = content.replace(/```json\n?|\n?```/g, '').trim();
      questions = JSON.parse(jsonString);
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse AI response as JSON");
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error("AI did not return valid questions array");
    }

    console.log("Generated exam questions:", questions.length);

    // Cache questions in exam_question_sets if table exists
    try {
      await supabase
        .from("exam_question_sets")
        .upsert({
          job_id: jobId,
          questions: questions,
          question_count: questions.length,
          version: 1,
        }, {
          onConflict: "job_id"
        });
    } catch (error) {
      console.log("Could not cache questions (table may not exist):", error);
    }

    return new Response(
      JSON.stringify({ questions }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in generate-exam-questions function:", error);
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
