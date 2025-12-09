import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EvaluationRequest {
  examToken: string;
  questions: Array<{
    question: string;
    category: string;
    type: 'mcq' | 'written';
    expectedAnswer: string;
    difficulty?: string;
  }>;
  answers: Array<{
    question: string;
    answer: string;
  }>;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { examToken, questions, answers }: EvaluationRequest = await req.json();

    if (!examToken) {
      return new Response(
        JSON.stringify({ error: "Exam token is required" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify the exam token
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: booking, error: bookingError } = await supabase
      .from("exam_bookings")
      .select("id, status, candidate_id")
      .eq("exam_token", examToken)
      .maybeSingle();

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ error: "Invalid exam token" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Evaluating exam answers for booking:", booking.id, "answers:", answers.length);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const prompt = `You are an expert HR evaluator. Evaluate the following screening exam answers and provide detailed feedback.

Questions and Expected Answers:
${questions.map((q, i) => `
Q${i + 1} (${q.category}, ${q.type}, ${q.difficulty || 'medium'}): ${q.question}
Expected: ${q.expectedAnswer}
`).join('\n')}

Candidate Answers:
${answers.map((a, i) => `
A${i + 1}: ${a.answer || 'No answer provided'}
`).join('\n')}

Evaluate each answer and provide:
1. A score from 0-100 for each answer
2. Feedback on what was good
3. Feedback on what could be improved
4. An overall score (0-100) for the entire exam
5. Overall strengths and weaknesses
6. Recommendation (pass/fail with threshold of 60%)

Return ONLY a JSON object in this exact format:
{
  "answerEvaluations": [
    {
      "questionIndex": 0,
      "score": 85,
      "feedback": "Good answer because...",
      "improvements": "Could improve by..."
    }
  ],
  "overallScore": 82,
  "strengths": ["List of strengths"],
  "weaknesses": ["List of areas to improve"],
  "summary": "Overall assessment of the candidate's performance",
  "recommendation": "Recommended for next stage" or "Needs improvement"
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an expert HR evaluator. Always respond with valid JSON objects only." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
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
    let evaluation;
    try {
      const jsonString = content.replace(/```json\n?|\n?```/g, '').trim();
      evaluation = JSON.parse(jsonString);
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse AI response as JSON");
    }

    console.log("Evaluation complete. Overall score:", evaluation.overallScore);

    return new Response(
      JSON.stringify({ evaluation }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in evaluate-exam-answers function:", error);
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

