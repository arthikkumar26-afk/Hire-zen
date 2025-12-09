-- Migration: Convert to On-Demand Exam System with Deadline
-- Instead of slot-based scheduling, candidates can take exams anytime before a deadline

-- Add deadline and on-demand fields to exam_bookings
ALTER TABLE exam_bookings
ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS exam_duration_minutes INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS is_on_demand BOOLEAN DEFAULT true;

-- Add exam deadline configuration to jobs table
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS exam_deadline_days INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS exam_duration_minutes INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS requires_exam BOOLEAN DEFAULT true;

-- Make exam_slot_id nullable (optional for on-demand exams)
-- First, drop the foreign key constraint if it exists
ALTER TABLE exam_bookings
DROP CONSTRAINT IF EXISTS exam_bookings_exam_slot_id_fkey;

-- Then make the column nullable
ALTER TABLE exam_bookings
ALTER COLUMN exam_slot_id DROP NOT NULL;

-- Re-add foreign key constraint but allow NULL
ALTER TABLE exam_bookings
ADD CONSTRAINT exam_bookings_exam_slot_id_fkey 
FOREIGN KEY (exam_slot_id) 
REFERENCES exam_slots(id) 
ON DELETE CASCADE;

-- Create index for deadline queries
CREATE INDEX IF NOT EXISTS idx_exam_bookings_deadline 
ON exam_bookings(deadline_at) 
WHERE status IN ('pending', 'scheduled') AND deadline_at IS NOT NULL;

-- Create index for candidate exam invitations
CREATE INDEX IF NOT EXISTS idx_exam_bookings_candidate_pending
ON exam_bookings(candidate_id, status, deadline_at)
WHERE status IN ('pending', 'scheduled');

-- Constraint handling is done above

-- Add function to check if exam deadline has passed
CREATE OR REPLACE FUNCTION check_exam_deadline()
RETURNS TRIGGER AS $$
BEGIN
    -- If deadline has passed and exam is not completed, mark as expired
    IF NEW.deadline_at IS NOT NULL 
       AND NEW.deadline_at < NOW() 
       AND NEW.status NOT IN ('completed', 'cancelled', 'expired') THEN
        NEW.status := 'expired';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-expire exams past deadline
DROP TRIGGER IF EXISTS trigger_check_exam_deadline ON exam_bookings;
CREATE TRIGGER trigger_check_exam_deadline
BEFORE INSERT OR UPDATE ON exam_bookings
FOR EACH ROW
EXECUTE FUNCTION check_exam_deadline();

-- Update exam_sessions to support immediate start
ALTER TABLE exam_sessions
ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMP WITH TIME ZONE;

-- Add comment explaining the change
COMMENT ON COLUMN exam_bookings.deadline_at IS 'Deadline by which candidate must complete the exam (on-demand)';
COMMENT ON COLUMN exam_bookings.is_on_demand IS 'If true, candidate can start exam anytime before deadline';
COMMENT ON COLUMN jobs.exam_deadline_days IS 'Number of days after resume upload to complete exam';
COMMENT ON COLUMN jobs.exam_duration_minutes IS 'Time limit for completing the exam once started';

