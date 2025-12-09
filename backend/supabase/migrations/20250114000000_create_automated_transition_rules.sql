-- Migration: Create automated stage transition rules system
-- Date: 2025-01-14
-- Purpose: Enable automated candidate stage transitions based on configurable rules

-- Create table for automated transition rules
CREATE TABLE IF NOT EXISTS public.automated_transition_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_name TEXT NOT NULL,
  description TEXT,
  from_stage TEXT NOT NULL,
  to_stage TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- Rule conditions (stored as JSONB for flexibility)
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  /*
    Example conditions structure:
    {
      "type": "score_threshold" | "time_based" | "manual_trigger" | "combined",
      "score_threshold": 50,  // Minimum score required
      "time_in_stage_days": 7,  // Days candidate must be in stage
      "requires_video": true,  // Video recording required
      "requires_interview_completion": true,
      "combine_logic": "AND" | "OR"  // How to combine multiple conditions
    }
  */
  
  -- Transition settings
  auto_send_email BOOLEAN NOT NULL DEFAULT true,
  email_template_type TEXT DEFAULT 'stage_change', -- 'stage_change', 'custom'
  require_approval BOOLEAN NOT NULL DEFAULT false, -- For critical stages
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  
  -- Validation
  CONSTRAINT valid_stage_transition CHECK (
    from_stage != to_stage
  )
);

-- Create table to track transition executions (audit log)
CREATE TABLE IF NOT EXISTS public.transition_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES public.automated_transition_rules(id) ON DELETE SET NULL,
  from_stage TEXT NOT NULL,
  to_stage TEXT NOT NULL,
  execution_type TEXT NOT NULL CHECK (execution_type IN ('automatic', 'manual', 'scheduled')),
  triggered_by TEXT DEFAULT 'system', -- 'system', user_id, 'scheduler'
  
  -- Execution details
  conditions_met JSONB, -- Store which conditions were met
  execution_result TEXT NOT NULL CHECK (execution_result IN ('success', 'failed', 'skipped')),
  error_message TEXT,
  
  -- Related data
  activity_log_id UUID REFERENCES public.pipeline_activity_logs(id) ON DELETE SET NULL,
  email_sent BOOLEAN DEFAULT false,
  email_id TEXT, -- Resend email ID if sent
  
  -- Timestamps
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Index for faster lookups
  CONSTRAINT idx_transition_executions_candidate_id FOREIGN KEY (candidate_id) REFERENCES public.candidates(id)
);

-- Enable RLS
ALTER TABLE public.automated_transition_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transition_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for automated_transition_rules
CREATE POLICY "Anyone can view transition rules"
ON public.automated_transition_rules
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can manage rules"
ON public.automated_transition_rules
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for transition_executions
CREATE POLICY "Anyone can view transition executions"
ON public.transition_executions
FOR SELECT
USING (true);

CREATE POLICY "System can create transition executions"
ON public.transition_executions
FOR INSERT
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transition_rules_from_stage ON public.automated_transition_rules(from_stage);
CREATE INDEX IF NOT EXISTS idx_transition_rules_enabled ON public.automated_transition_rules(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_transition_executions_candidate_id ON public.transition_executions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_transition_executions_executed_at ON public.transition_executions(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_transition_executions_rule_id ON public.transition_executions(rule_id);

-- Create trigger for updated_at
CREATE TRIGGER update_transition_rules_updated_at
BEFORE UPDATE ON public.automated_transition_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default rules based on common workflow
INSERT INTO public.automated_transition_rules (
  rule_name,
  description,
  from_stage,
  to_stage,
  enabled,
  conditions,
  auto_send_email,
  require_approval
) VALUES
-- Rule 1: HR Screening → Written Test (Interview Score Based)
(
  'HR to Written Test (Score Based)',
  'Automatically advance candidate to written_test stage if interview score >= 50',
  'hr',
  'written_test',
  true,
  '{
    "type": "score_threshold",
    "score_threshold": 50,
    "requires_interview_completion": true,
    "requires_video": true
  }'::jsonb,
  true,
  false
),
-- Rule 2: Written Test → Demo Slot (Time Based - 7 days)
(
  'Written Test to Demo Slot (Time Based)',
  'Automatically advance candidate to demo_slot after 7 days in written_test stage',
  'written_test',
  'demo_slot',
  true,
  '{
    "type": "time_based",
    "time_in_stage_days": 7
  }'::jsonb,
  true,
  false
),
-- Rule 3: Demo Slot → Demo Schedule (Manual trigger - slot selected)
(
  'Demo Slot to Demo Schedule',
  'Automatically advance when demo slot is selected',
  'demo_slot',
  'demo_schedule',
  true,
  '{
    "type": "manual_trigger"
  }'::jsonb,
  true,
  false
)
ON CONFLICT DO NOTHING;

-- Create function to check if conditions are met
CREATE OR REPLACE FUNCTION public.check_transition_conditions(
  p_candidate_id UUID,
  p_rule_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rule RECORD;
  v_candidate RECORD;
  v_conditions JSONB;
  v_result JSONB := '{"met": false, "details": {}}'::jsonb;
  v_time_in_stage_days INTEGER;
  v_latest_interview_score INTEGER;
  v_has_completed_interview BOOLEAN := false;
  v_has_video BOOLEAN := false;
BEGIN
  -- Get rule details
  SELECT * INTO v_rule
  FROM public.automated_transition_rules
  WHERE id = p_rule_id AND enabled = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('met', false, 'error', 'Rule not found or disabled');
  END IF;
  
  -- Get candidate details
  SELECT * INTO v_candidate
  FROM public.candidates
  WHERE id = p_candidate_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('met', false, 'error', 'Candidate not found');
  END IF;
  
  -- Verify candidate is in the expected stage
  IF v_candidate.status != v_rule.from_stage THEN
    RETURN jsonb_build_object('met', false, 'error', format('Candidate not in expected stage: %s', v_rule.from_stage));
  END IF;
  
  v_conditions := v_rule.conditions;
  
  -- Check time-based condition
  IF v_conditions->>'type' = 'time_based' OR v_conditions ? 'time_in_stage_days' THEN
    SELECT EXTRACT(EPOCH FROM (now() - v_candidate.updated_at)) / 86400 INTO v_time_in_stage_days;
    
    IF v_time_in_stage_days >= COALESCE((v_conditions->>'time_in_stage_days')::INTEGER, 7) THEN
      v_result := jsonb_set(v_result, '{met}', 'true'::jsonb);
      v_result := jsonb_set(v_result, '{details,time_in_stage_days}', to_jsonb(v_time_in_stage_days));
    ELSE
      RETURN jsonb_build_object(
        'met', false,
        'reason', format('Time condition not met: %s days in stage (required: %s)', 
          ROUND(v_time_in_stage_days, 2), 
          COALESCE((v_conditions->>'time_in_stage_days')::INTEGER, 7))
      );
    END IF;
  END IF;
  
  -- Check score-based condition
  IF v_conditions->>'type' = 'score_threshold' OR v_conditions ? 'score_threshold' THEN
    -- Get latest interview score from activity logs
    SELECT interview_score INTO v_latest_interview_score
    FROM public.pipeline_activity_logs
    WHERE candidate_id = p_candidate_id
      AND interview_score IS NOT NULL
      AND new_stage = v_rule.from_stage
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_latest_interview_score IS NULL THEN
      RETURN jsonb_build_object('met', false, 'reason', 'No interview score found');
    END IF;
    
    IF v_latest_interview_score >= COALESCE((v_conditions->>'score_threshold')::INTEGER, 50) THEN
      v_result := jsonb_set(v_result, '{met}', 'true'::jsonb);
      v_result := jsonb_set(v_result, '{details,interview_score}', to_jsonb(v_latest_interview_score));
    ELSE
      RETURN jsonb_build_object(
        'met', false,
        'reason', format('Score condition not met: %s (required: %s)', 
          v_latest_interview_score, 
          COALESCE((v_conditions->>'score_threshold')::INTEGER, 50))
      );
    END IF;
  END IF;
  
  -- Check interview completion requirement
  IF v_conditions->>'requires_interview_completion' = 'true' THEN
    SELECT EXISTS(
      SELECT 1
      FROM public.pipeline_activity_logs
      WHERE candidate_id = p_candidate_id
        AND new_stage = v_rule.from_stage
        AND interview_score IS NOT NULL
    ) INTO v_has_completed_interview;
    
    IF NOT v_has_completed_interview THEN
      RETURN jsonb_build_object('met', false, 'reason', 'Interview not completed');
    END IF;
  END IF;
  
  -- Check video requirement
  IF v_conditions->>'requires_video' = 'true' THEN
    SELECT EXISTS(
      SELECT 1
      FROM public.pipeline_activity_logs
      WHERE candidate_id = p_candidate_id
        AND new_stage = v_rule.from_stage
        AND (video_url IS NOT NULL OR video_file_id IS NOT NULL)
    ) INTO v_has_video;
    
    IF NOT v_has_video THEN
      RETURN jsonb_build_object('met', false, 'reason', 'Video recording not found');
    END IF;
  END IF;
  
  -- If we get here and result is not set, default to met (for manual_trigger type)
  IF (v_result->>'met')::BOOLEAN IS NULL OR NOT (v_result->>'met')::BOOLEAN THEN
    IF v_conditions->>'type' = 'manual_trigger' THEN
      v_result := jsonb_build_object('met', true, 'details', jsonb_build_object('type', 'manual_trigger'));
    END IF;
  END IF;
  
  RETURN v_result;
END;
$$;

COMMENT ON TABLE public.automated_transition_rules IS 'Configuration table for automated candidate stage transition rules';
COMMENT ON TABLE public.transition_executions IS 'Audit log of all transition executions (automatic, manual, scheduled)';
COMMENT ON FUNCTION public.check_transition_conditions IS 'Evaluates if transition conditions are met for a candidate and rule';


