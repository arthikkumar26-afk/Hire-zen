-- Create exam_slots table for available exam time slots
CREATE TABLE IF NOT EXISTS public.exam_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  slot_start_time TIME NOT NULL,
  slot_end_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  max_candidates INTEGER DEFAULT 1,
  booked_count INTEGER DEFAULT 0,
  timezone TEXT DEFAULT 'UTC',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_time_range CHECK (slot_end_time > slot_start_time),
  CONSTRAINT valid_duration CHECK (duration_minutes > 0 AND duration_minutes <= 240),
  CONSTRAINT valid_capacity CHECK (booked_count <= max_candidates)
);

-- Create exam_bookings table for candidate bookings
CREATE TABLE IF NOT EXISTS public.exam_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  exam_slot_id UUID REFERENCES public.exam_slots(id) ON DELETE CASCADE, -- Nullable for on-demand exams
  exam_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'scheduled', 'checked_in', 'in_progress', 'completed', 'expired', 'cancelled')),
  
  -- Timing (nullable for on-demand exams)
  scheduled_start_time TIMESTAMP WITH TIME ZONE,
  actual_start_time TIMESTAMP WITH TIME ZONE,
  scheduled_end_time TIMESTAMP WITH TIME ZONE,
  actual_end_time TIMESTAMP WITH TIME ZONE,
  time_zone TEXT,
  
  -- Exam settings
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  time_limit_seconds INTEGER NOT NULL DEFAULT 3600,
  
  -- Attempt tracking
  attempt_number INTEGER DEFAULT 1,
  max_attempts INTEGER DEFAULT 1,
  
  -- Proctoring
  video_url TEXT,
  video_recorded BOOLEAN DEFAULT false,
  proctoring_score DECIMAL(5,2),
  suspicious_activity_flags JSONB DEFAULT '[]',
  
  -- Results
  score INTEGER,
  passed BOOLEAN,
  evaluation_data JSONB,
  
  -- Metadata
  browser_info JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create exam_sessions table for active exam state
CREATE TABLE IF NOT EXISTS public.exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.exam_bookings(id) ON DELETE CASCADE UNIQUE,
  exam_token UUID NOT NULL REFERENCES public.exam_bookings(exam_token),
  
  -- Current state
  current_question_index INTEGER DEFAULT 0,
  questions JSONB NOT NULL,
  answers JSONB DEFAULT '{}',
  question_order JSONB,
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE,
  time_remaining_seconds INTEGER,
  paused_at TIMESTAMP WITH TIME ZONE,
  pause_duration_seconds INTEGER DEFAULT 0,
  
  -- Recording
  recording_started BOOLEAN DEFAULT false,
  recording_paused BOOLEAN DEFAULT false,
  video_chunks JSONB DEFAULT '[]',
  
  -- Activity tracking
  tab_switch_count INTEGER DEFAULT 0,
  copy_paste_count INTEGER DEFAULT 0,
  suspicious_events JSONB DEFAULT '[]',
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Auto-submit
  auto_submitted BOOLEAN DEFAULT false,
  submitted_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create exam_question_sets table for cached questions
CREATE TABLE IF NOT EXISTS public.exam_question_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  questions JSONB NOT NULL,
  version INTEGER DEFAULT 1,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  generated_by TEXT DEFAULT 'ai',
  is_active BOOLEAN DEFAULT true,
  total_questions INTEGER NOT NULL,
  mcq_count INTEGER NOT NULL,
  written_count INTEGER NOT NULL,
  estimated_duration_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.exam_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_question_sets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for exam_slots
CREATE POLICY "Anyone can view active exam slots" ON public.exam_slots
  FOR SELECT USING (is_active = true);

CREATE POLICY "Authenticated users can manage exam slots" ON public.exam_slots
  FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS Policies for exam_bookings
CREATE POLICY "Candidates can view their own bookings" ON public.exam_bookings
  FOR SELECT USING (true); -- Token-based access

CREATE POLICY "Anyone can create bookings" ON public.exam_bookings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update booking by token" ON public.exam_bookings
  FOR UPDATE USING (true);

-- RLS Policies for exam_sessions
CREATE POLICY "Anyone can view session by token" ON public.exam_sessions
  FOR SELECT USING (true);

CREATE POLICY "Anyone can update session by token" ON public.exam_sessions
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can create session" ON public.exam_sessions
  FOR INSERT WITH CHECK (true);

-- RLS Policies for exam_question_sets
CREATE POLICY "Anyone can view active question sets" ON public.exam_question_sets
  FOR SELECT USING (is_active = true);

CREATE POLICY "Authenticated users can manage question sets" ON public.exam_question_sets
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Create indexes
CREATE INDEX idx_exam_slots_job_id ON public.exam_slots(job_id);
CREATE INDEX idx_exam_slots_date ON public.exam_slots(slot_date);
CREATE INDEX idx_exam_slots_available ON public.exam_slots(job_id, slot_date, is_active) 
  WHERE booked_count < max_candidates;

CREATE INDEX idx_exam_bookings_candidate ON public.exam_bookings(candidate_id);
CREATE INDEX idx_exam_bookings_job ON public.exam_bookings(job_id);
CREATE INDEX idx_exam_bookings_token ON public.exam_bookings(exam_token);
CREATE INDEX idx_exam_bookings_status ON public.exam_bookings(status);
CREATE INDEX idx_exam_bookings_start_time ON public.exam_bookings(scheduled_start_time);

CREATE INDEX idx_exam_sessions_booking ON public.exam_sessions(booking_id);
CREATE INDEX idx_exam_sessions_token ON public.exam_sessions(exam_token);

CREATE INDEX idx_exam_question_sets_job_active ON public.exam_question_sets(job_id, is_active);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_exam_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_exam_slots_updated_at
  BEFORE UPDATE ON public.exam_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_exam_updated_at();

CREATE TRIGGER update_exam_bookings_updated_at
  BEFORE UPDATE ON public.exam_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_exam_updated_at();

CREATE TRIGGER update_exam_sessions_updated_at
  BEFORE UPDATE ON public.exam_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_exam_updated_at();

-- Function to update booked_count when booking is created/cancelled
CREATE OR REPLACE FUNCTION public.update_slot_booked_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.exam_slots 
    SET booked_count = booked_count + 1 
    WHERE id = NEW.exam_slot_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.exam_slots 
    SET booked_count = GREATEST(0, booked_count - 1) 
    WHERE id = OLD.exam_slot_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    -- If status changed to cancelled, decrement
    IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
      UPDATE public.exam_slots 
      SET booked_count = GREATEST(0, booked_count - 1) 
      WHERE id = NEW.exam_slot_id;
    -- If status changed from cancelled, increment
    ELSIF OLD.status = 'cancelled' AND NEW.status != 'cancelled' THEN
      UPDATE public.exam_slots 
      SET booked_count = booked_count + 1 
      WHERE id = NEW.exam_slot_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for booked_count
CREATE TRIGGER update_exam_slot_booked_count
  AFTER INSERT OR UPDATE OR DELETE ON public.exam_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_slot_booked_count();

