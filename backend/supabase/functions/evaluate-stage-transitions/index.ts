// Supabase Edge Function: Evaluate and Execute Automated Stage Transitions
// Purpose: Automatically move candidates through pipeline stages based on configurable rules

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TransitionRequest {
  candidateId?: string;
  ruleId?: string;
  fromStage?: string;
  triggerType?: "event" | "scheduled" | "manual";
  eventData?: Record<string, any>;
}

interface Rule {
  id: string;
  rule_name: string;
  from_stage: string;
  to_stage: string;
  enabled: boolean;
  conditions: any;
  auto_send_email: boolean;
  email_template_type: string;
  require_approval: boolean;
}

interface Candidate {
  id: string;
  full_name: string;
  email: string;
  status: string;
  job_id: string;
  updated_at: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { candidateId, ruleId, fromStage, triggerType = "event", eventData }: TransitionRequest = await req.json();

    console.log("Evaluating stage transitions:", { candidateId, ruleId, fromStage, triggerType });

    // If candidateId provided, evaluate all rules for that candidate
    if (candidateId) {
      const result = await evaluateCandidateTransitions(supabase, candidateId, triggerType, eventData);
      return new Response(
        JSON.stringify(result),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // If ruleId provided, evaluate that specific rule for all matching candidates
    if (ruleId) {
      const result = await evaluateRuleForAllCandidates(supabase, ruleId);
      return new Response(
        JSON.stringify(result),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // If fromStage provided, evaluate all rules for that stage
    if (fromStage) {
      const result = await evaluateStageTransitions(supabase, fromStage);
      return new Response(
        JSON.stringify(result),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Please provide candidateId, ruleId, or fromStage" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("Error in evaluate-stage-transitions:", error);
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

/**
 * Evaluate all applicable rules for a specific candidate
 */
async function evaluateCandidateTransitions(
  supabase: any,
  candidateId: string,
  triggerType: string,
  eventData?: Record<string, any>
): Promise<any> {
  // Get candidate details
  const { data: candidate, error: candidateError } = await supabase
    .from("candidates")
    .select("*")
    .eq("id", candidateId)
    .single();

  if (candidateError || !candidate) {
    throw new Error(`Candidate not found: ${candidateError?.message}`);
  }

  // Get all enabled rules for the candidate's current stage
  const { data: rules, error: rulesError } = await supabase
    .from("automated_transition_rules")
    .select("*")
    .eq("from_stage", candidate.status)
    .eq("enabled", true);

  if (rulesError) {
    throw new Error(`Error fetching rules: ${rulesError.message}`);
  }

  if (!rules || rules.length === 0) {
    return {
      success: true,
      message: "No applicable rules found for candidate's current stage",
      candidateId,
      currentStage: candidate.status,
      transitions: [],
    };
  }

  const transitions: any[] = [];
  
  // Evaluate each rule
  for (const rule of rules) {
    try {
      const evaluationResult = await evaluateRule(supabase, candidate, rule, triggerType, eventData);
      
      if (evaluationResult.shouldTransition) {
        // Execute the transition
        const executionResult = await executeTransition(supabase, candidate, rule, evaluationResult, triggerType);
        transitions.push(executionResult);
      } else {
        transitions.push({
          ruleId: rule.id,
          ruleName: rule.rule_name,
          status: "conditions_not_met",
          reason: evaluationResult.reason,
        });
      }
    } catch (error: any) {
      console.error(`Error evaluating rule ${rule.id}:`, error);
      transitions.push({
        ruleId: rule.id,
        ruleName: rule.rule_name,
        status: "error",
        error: error.message,
      });
    }
  }

  return {
    success: true,
    candidateId,
    currentStage: candidate.status,
    transitions,
  };
}

/**
 * Evaluate a specific rule for all matching candidates
 */
async function evaluateRuleForAllCandidates(supabase: any, ruleId: string): Promise<any> {
  // Get rule details
  const { data: rule, error: ruleError } = await supabase
    .from("automated_transition_rules")
    .select("*")
    .eq("id", ruleId)
    .eq("enabled", true)
    .single();

  if (ruleError || !rule) {
    throw new Error(`Rule not found or disabled: ${ruleError?.message}`);
  }

  // Get all candidates in the from_stage
  const { data: candidates, error: candidatesError } = await supabase
    .from("candidates")
    .select("*")
    .eq("status", rule.from_stage);

  if (candidatesError) {
    throw new Error(`Error fetching candidates: ${candidatesError.message}`);
  }

  const transitions: any[] = [];

  for (const candidate of candidates || []) {
    try {
      const evaluationResult = await evaluateRule(supabase, candidate, rule, "scheduled");
      
      if (evaluationResult.shouldTransition) {
        const executionResult = await executeTransition(supabase, candidate, rule, evaluationResult, "scheduled");
        transitions.push(executionResult);
      }
    } catch (error: any) {
      console.error(`Error processing candidate ${candidate.id}:`, error);
    }
  }

  return {
    success: true,
    ruleId,
    ruleName: rule.rule_name,
    candidatesProcessed: candidates?.length || 0,
    transitions,
  };
}

/**
 * Evaluate all rules for a specific stage
 */
async function evaluateStageTransitions(supabase: any, fromStage: string): Promise<any> {
  const result = await evaluateRuleForAllCandidates(supabase, fromStage);
  return result;
}

/**
 * Evaluate if a rule's conditions are met for a candidate
 */
async function evaluateRule(
  supabase: any,
  candidate: Candidate,
  rule: Rule,
  triggerType: string,
  eventData?: Record<string, any>
): Promise<{ shouldTransition: boolean; reason?: string; conditionsMet?: any }> {
  // Call the database function to check conditions
  const { data, error } = await supabase.rpc("check_transition_conditions", {
    p_candidate_id: candidate.id,
    p_rule_id: rule.id,
  });

  if (error) {
    throw new Error(`Error checking conditions: ${error.message}`);
  }

  const result = data as { met: boolean; error?: string; reason?: string; details?: any };

  return {
    shouldTransition: result.met,
    reason: result.error || result.reason,
    conditionsMet: result.details,
  };
}

/**
 * Execute the transition for a candidate
 */
async function executeTransition(
  supabase: any,
  candidate: Candidate,
  rule: Rule,
  evaluationResult: any,
  triggerType: string
): Promise<any> {
  // Check if transition was already executed recently (prevent duplicates)
  const { data: recentExecution } = await supabase
    .from("transition_executions")
    .select("id")
    .eq("candidate_id", candidate.id)
    .eq("from_stage", rule.from_stage)
    .eq("to_stage", rule.to_stage)
    .eq("execution_result", "success")
    .gte("executed_at", new Date(Date.now() - 60000).toISOString()) // Last minute
    .single();

  if (recentExecution) {
    return {
      ruleId: rule.id,
      ruleName: rule.rule_name,
      status: "skipped",
      reason: "Transition already executed recently",
    };
  }

  // Update candidate status
  const { error: updateError } = await supabase
    .from("candidates")
    .update({ 
      status: rule.to_stage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", candidate.id);

  if (updateError) {
    throw new Error(`Error updating candidate status: ${updateError.message}`);
  }

  // Get activity log ID (should be created by database trigger)
  const { data: activityLog } = await supabase
    .from("pipeline_activity_logs")
    .select("id")
    .eq("candidate_id", candidate.id)
    .eq("old_stage", rule.from_stage)
    .eq("new_stage", rule.to_stage)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Log the transition execution
  const { data: executionLog, error: logError } = await supabase
    .from("transition_executions")
    .insert({
      candidate_id: candidate.id,
      rule_id: rule.id,
      from_stage: rule.from_stage,
      to_stage: rule.to_stage,
      execution_type: triggerType === "manual" ? "manual" : "automatic",
      triggered_by: triggerType === "manual" ? "user" : "system",
      conditions_met: evaluationResult.conditionsMet,
      execution_result: "success",
      activity_log_id: activityLog?.id,
      email_sent: false,
    })
    .select()
    .single();

  if (logError) {
    console.error("Error logging transition execution:", logError);
  }

  // Send email notification if enabled
  let emailSent = false;
  let emailId: string | null = null;

  if (rule.auto_send_email) {
    try {
      // Invoke email function
      const emailResponse = await supabase.functions.invoke("send-candidate-email", {
        body: {
          candidateId: candidate.id,
          type: rule.email_template_type || "stage_change",
          oldStage: rule.from_stage,
          newStage: rule.to_stage,
        },
      });

      if (emailResponse.error) {
        console.error("Error sending email:", emailResponse.error);
      } else {
        emailSent = true;
        emailId = emailResponse.data?.emailId || null;
      }
    } catch (error: any) {
      console.error("Error invoking email function:", error);
    }
  }

  // Update execution log with email status
  if (executionLog) {
    await supabase
      .from("transition_executions")
      .update({
        email_sent: emailSent,
        email_id: emailId,
      })
      .eq("id", executionLog.id);
  }

  return {
    ruleId: rule.id,
    ruleName: rule.rule_name,
    status: "success",
    fromStage: rule.from_stage,
    toStage: rule.to_stage,
    emailSent,
    emailId,
    executionId: executionLog?.id,
  };
}

serve(handler);

