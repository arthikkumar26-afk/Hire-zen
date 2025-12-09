# Screening Exam System - Comprehensive Design & Implementation Guide

## Executive Summary

This document outlines the design for a comprehensive **AI-powered, proctored screening exam system** with self-scheduling, time management, and video recording capabilities. The system ensures exam integrity while providing a smooth candidate experience.

---

## System Requirements

### Core Features
1. ✅ **Self-Scheduling**: Candidates choose their exam time slot
2. ✅ **Time Management**: Fixed time limits with countdown timer
3. ✅ **Video Proctoring**: Continuous recording during exam
4. ✅ **Job-Description Based**: AI-generated questions from job requirements
5. ✅ **Question Security**: Randomized order, anti-cheating measures
6. ✅ **Auto-Submit**: Automatic submission when time expires

### Additional Features
- Pre-exam identity verification
- Exam rules and guidelines
- Technical requirements check
- Multiple attempts management
- Real-time proctoring alerts
- Post-exam video storage and review

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    EXAM SCHEDULING SYSTEM                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Candidate → Email → Self-Schedule → Calendar Booking        │
│       ↓                                                       │
│  Exam Slot Confirmed → Reminder Email                        │
│       ↓                                                       │
│  Pre-Exam Check → Identity Verification                      │
│       ↓                                                       │
│  Exam Start → Video Recording Starts                         │
│       ↓                                                       │
│  Questions Generated (Job-Description Based)                 │
│       ↓                                                       │
│  Timer Countdown → Auto-Submit on Timeout                    │
│       ↓                                                       │
│  Video Saved → Answers Evaluated → Results                   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema Design

### 1. Exam Slots Table

```sql
CREATE TABLE exam_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
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

-- Indexes
CREATE INDEX idx_exam_slots_job_id ON exam_slots(job_id);
CREATE INDEX idx_exam_slots_date ON exam_slots(slot_date);
CREATE INDEX idx_exam_slots_available ON exam_slots(job_id, slot_date, is_active) 
  WHERE booked_count < max_candidates;
```

### 2. Exam Bookings Table

```sql
CREATE TABLE exam_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  exam_slot_id UUID NOT NULL REFERENCES exam_slots(id) ON DELETE CASCADE,
  exam_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'scheduled' 
    CHECK (status IN ('scheduled', 'checked_in', 'in_progress', 'completed', 'expired', 'cancelled')),
  
  -- Timing
  scheduled_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  actual_start_time TIMESTAMP WITH TIME ZONE,
  scheduled_end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  actual_end_time TIMESTAMP WITH TIME ZONE,
  time_zone TEXT,
  
  -- Exam settings
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  time_limit_seconds INTEGER NOT NULL DEFAULT 3600, -- Total time allowed
  
  -- Attempt tracking
  attempt_number INTEGER DEFAULT 1,
  max_attempts INTEGER DEFAULT 1,
  
  -- Proctoring
  video_url TEXT,
  video_recorded BOOLEAN DEFAULT false,
  proctoring_score DECIMAL(5,2), -- 0-100, measures exam integrity
  suspicious_activity_flags JSONB, -- Array of suspicious events
  
  -- Results
  score INTEGER, -- Overall exam score
  passed BOOLEAN,
  evaluation_data JSONB,
  
  -- Metadata
  browser_info JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Constraints
  CONSTRAINT unique_active_booking UNIQUE (candidate_id, job_id, status) 
    WHERE status IN ('scheduled', 'checked_in', 'in_progress')
);

-- Indexes
CREATE INDEX idx_exam_bookings_candidate ON exam_bookings(candidate_id);
CREATE INDEX idx_exam_bookings_job ON exam_bookings(job_id);
CREATE INDEX idx_exam_bookings_token ON exam_bookings(exam_token);
CREATE INDEX idx_exam_bookings_status ON exam_bookings(status);
CREATE INDEX idx_exam_bookings_start_time ON exam_bookings(scheduled_start_time);
```

### 3. Exam Sessions Table (Active Exam State)

```sql
CREATE TABLE exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES exam_bookings(id) ON DELETE CASCADE UNIQUE,
  exam_token UUID NOT NULL REFERENCES exam_bookings(exam_token),
  
  -- Current state
  current_question_index INTEGER DEFAULT 0,
  questions JSONB NOT NULL, -- Array of questions with randomized order
  answers JSONB DEFAULT '{}', -- Question index -> answer mapping
  question_order JSONB, -- Randomized question order
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE,
  time_remaining_seconds INTEGER,
  paused_at TIMESTAMP WITH TIME ZONE,
  pause_duration_seconds INTEGER DEFAULT 0,
  
  -- Recording
  recording_started BOOLEAN DEFAULT false,
  recording_paused BOOLEAN DEFAULT false,
  video_chunks JSONB, -- Array of video segment URLs
  
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

-- Indexes
CREATE INDEX idx_exam_sessions_booking ON exam_sessions(booking_id);
CREATE INDEX idx_exam_sessions_token ON exam_sessions(exam_token);
```

### 4. Exam Questions Cache (Job-Based)

```sql
CREATE TABLE exam_question_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  
  -- Question set
  questions JSONB NOT NULL, -- Full question set
  version INTEGER DEFAULT 1,
  
  -- Metadata
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  generated_by TEXT DEFAULT 'ai', -- 'ai' or 'manual'
  is_active BOOLEAN DEFAULT true,
  
  -- Settings
  total_questions INTEGER NOT NULL,
  mcq_count INTEGER NOT NULL,
  written_count INTEGER NOT NULL,
  estimated_duration_minutes INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for active question sets
CREATE INDEX idx_exam_question_sets_job_active ON exam_question_sets(job_id, is_active);
```

---

## Feature Implementation Details

### 1. Self-Scheduling System

#### Flow:
```
1. Candidate receives email with exam link
2. Clicks "Schedule Your Exam" button
3. Views available time slots (next 7-14 days)
4. Selects preferred date/time
5. Confirms booking
6. Receives confirmation email with calendar invite
7. Receives reminder 24 hours before exam
8. Receives reminder 1 hour before exam
```

#### Implementation:

**Backend: Create Exam Slots**
```typescript
// backend/supabase/functions/create-exam-slots/index.ts
const createExamSlots = async (
  jobId: string,
  startDate: Date,
  endDate: Date,
  slotDuration: number = 60, // minutes
  slotsPerDay: number[] = [9, 10, 11, 14, 15, 16] // Hour slots
) => {
  // Generate slots for date range
  // Check for conflicts
  // Insert available slots
};
```

**Frontend: Booking Interface**
```typescript
// frontend/src/pages/ExamScheduling.tsx
const ExamScheduling = () => {
  // Calendar view
  // Time slot selection
  // Booking confirmation
  // Timezone handling
};
```

#### Key Features:
- ✅ **Calendar View**: Visual calendar with available slots
- ✅ **Timezone Support**: Show slots in candidate's timezone
- ✅ **Auto-Expiry**: Slots expire if not booked within timeframe
- ✅ **Capacity Management**: Multiple candidates per slot (optional)
- ✅ **Rescheduling**: Allow reschedule with restrictions

---

### 2. Pre-Exam Setup & Verification

#### Identity Verification:
- Email verification (already in system)
- Optional: Photo ID upload/verification
- Optional: Biometric check (webcam photo match)

#### Technical Check:
- Browser compatibility check
- Camera/microphone permissions
- Internet speed test
- Screen resolution check
- Browser extensions detection

#### Exam Rules Agreement:
- Terms and conditions
- Exam rules (no external help, no tabs, etc.)
- Code of conduct
- Privacy policy

#### Implementation:
```typescript
// frontend/src/components/exam/PreExamCheck.tsx
const PreExamCheck = () => {
  // 1. Identity verification
  // 2. Technical requirements check
  // 3. Camera/mic test
  // 4. Rules agreement
  // 5. Environment setup
};
```

---

### 3. Job-Description Based Question Generation

#### Enhanced Question Generation:
```typescript
// backend/supabase/functions/generate-exam-questions/index.ts
const generateExamQuestions = async (
  jobId: string,
  jobDescription: string,
  position: string,
  examDuration: number = 60 // minutes
) => {
  const prompt = `Generate a comprehensive screening exam for ${position}.

Job Description:
${jobDescription}

Exam Requirements:
- Duration: ${examDuration} minutes
- Total Questions: ${calculateQuestionCount(examDuration)}
- MCQ Questions: ${calculateMCQCount(examDuration)} (60% of total)
- Written Questions: ${calculateWrittenCount(examDuration)} (40% of total)

Question Distribution:
1. Technical Skills (40%)
2. Problem-Solving (30%)
3. Behavioral/Soft Skills (20%)
4. Role-Specific (10%)

Difficulty Levels:
- Entry Level: 30% easy, 50% medium, 20% hard
- Mid Level: 20% easy, 50% medium, 30% hard
- Senior Level: 10% easy, 40% medium, 50% hard

Generate questions that:
- Test actual job-relevant skills
- Include practical scenarios
- Have clear, unambiguous answers
- Cover breadth of required skills
- Include time estimates per question

Return JSON array...`;
};
```

#### Question Randomization:
- Generate question pool (e.g., 50 questions)
- Select subset per exam (e.g., 20 questions)
- Randomize order for each candidate
- Shuffle MCQ options
- Prevent question repetition in retakes

---

### 4. Time Management System

#### Features:
- ✅ **Countdown Timer**: Visual countdown with warnings
- ✅ **Per-Question Timing**: Optional time limit per question
- ✅ **Pause Detection**: Track pauses (with penalties if needed)
- ✅ **Auto-Save**: Auto-save answers every 30 seconds
- ✅ **Time Warnings**: Alert at 25%, 10%, 5%, 1% remaining
- ✅ **Auto-Submit**: Automatic submission when time expires
- ✅ **Grace Period**: Optional 30-second grace period for submission

#### Implementation:
```typescript
// frontend/src/hooks/useExamTimer.ts
const useExamTimer = (
  totalSeconds: number,
  onTimeUp: () => void
) => {
  const [timeRemaining, setTimeRemaining] = useState(totalSeconds);
  const [isPaused, setIsPaused] = useState(false);
  const [warningsShown, setWarningsShown] = useState<number[]>([]);
  
  // Countdown logic
  // Warning system
  // Auto-submit trigger
  // Pause detection
};
```

#### UI Components:
```typescript
// frontend/src/components/exam/ExamTimer.tsx
const ExamTimer = ({ timeRemaining, totalTime }) => {
  const percentage = (timeRemaining / totalTime) * 100;
  const isWarning = percentage < 25;
  const isCritical = percentage < 10;
  
  return (
    <div className={`timer ${isCritical ? 'critical' : isWarning ? 'warning' : ''}`}>
      <CircularProgress value={percentage} />
      <div>{formatTime(timeRemaining)}</div>
      {isWarning && <Alert>Time running out!</Alert>}
    </div>
  );
};
```

---

### 5. Video Recording & Proctoring

#### Recording Strategy:

**Continuous Recording:**
- Start recording when exam begins
- Record throughout entire exam duration
- Include: Screen + Webcam + Audio
- Stop recording when exam ends or is submitted

**Chunked Recording:**
- Record in 5-minute chunks
- Upload chunks progressively (backup in case of crash)
- Merge chunks after exam completion
- Store in cloud storage (Supabase Storage/S3)

#### Implementation:
```typescript
// frontend/src/hooks/useExamRecording.ts
const useExamRecording = (examSessionId: string) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingState, setRecordingState] = useState('idle');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunkUploadQueue = useRef<string[]>([]);
  
  const startRecording = async () => {
    // 1. Request permissions (screen + camera + mic)
    // 2. Create combined stream
    // 3. Initialize MediaRecorder
    // 4. Set up chunk upload
    // 5. Start recording
  };
  
  const uploadChunk = async (chunk: Blob, chunkIndex: number) => {
    // Upload to Supabase Storage
    // Store chunk metadata in database
    // Queue for merging later
  };
  
  const stopRecording = async () => {
    // Stop recording
    // Upload final chunk
    // Merge all chunks
    // Generate final video URL
  };
};
```

#### Proctoring Detection:

**Suspicious Activities:**
- Tab switching (detect window blur)
- Copy/paste attempts
- Multiple faces detected (cheating)
- Phone/device usage detection
- Screen sharing detection
- Unusual eye movement patterns

**Implementation:**
```typescript
// frontend/src/hooks/useProctoring.ts
const useProctoring = () => {
  // Tab switch detection
  useEffect(() => {
    const handleBlur = () => {
      logSuspiciousEvent('tab_switch', Date.now());
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, []);
  
  // Copy/paste detection
  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      logSuspiciousEvent('copy_attempt', Date.now());
    };
    document.addEventListener('copy', handleCopy);
    return () => document.removeEventListener('copy', handleCopy);
  }, []);
  
  // Face detection (optional, using face-api.js or similar)
  // Multiple face detection
  // Eye tracking
};
```

#### Video Storage:
```typescript
// backend/supabase/functions/upload-exam-video/index.ts
const uploadExamVideo = async (
  examBookingId: string,
  videoBlob: Blob,
  chunks: string[]
) => {
  // 1. Merge video chunks if needed
  // 2. Upload to Supabase Storage
  // 3. Generate public/signed URL
  // 4. Update exam_bookings.video_url
  // 5. Trigger video analysis (optional)
};
```

---

### 6. Exam Interface

#### Layout:
```
┌─────────────────────────────────────────────────┐
│ Header: Timer | Progress | Questions (1/20)    │
├─────────────────────────────────────────────────┤
│                                                  │
│  Question Area (Main Content)                    │
│  ┌──────────────────────────────────────────┐  │
│  │ Question 1 of 20                          │  │
│  │ [Question Text]                           │  │
│  │                                            │  │
│  │ [Answer Input]                             │  │
│  │                                            │  │
│  └──────────────────────────────────────────┘  │
│                                                  │
│  [Previous] [Next] [Save] [Submit Exam]         │
│                                                  │
│  Sidebar:                                       │
│  - Question Navigation                          │
│  - Answer Status (Answered/Unanswered)          │
│  - Time Remaining                               │
│                                                  │
└─────────────────────────────────────────────────┘
```

#### Features:
- ✅ **Question Navigation**: Jump to any question
- ✅ **Answer Status**: Visual indicators (answered/unanswered)
- ✅ **Auto-Save**: Save answers automatically
- ✅ **Question Review**: Mark for review
- ✅ **Progress Bar**: Visual progress indicator
- ✅ **Fullscreen Mode**: Distraction-free mode
- ✅ **No Back Button**: Prevent going back to previous questions (optional)

---

### 7. Auto-Submit & Completion

#### Auto-Submit Logic:
```typescript
const handleAutoSubmit = async () => {
  // 1. Stop recording
  // 2. Save all current answers
  // 3. Mark exam as auto-submitted
  // 4. Show warning message
  // 5. Submit exam
  // 6. Upload final video
  // 7. Redirect to results page
};
```

#### Warning System:
- 25% time remaining: "You have 25% time remaining"
- 10% time remaining: "Please review and submit soon"
- 5% time remaining: "Final warning - submit now"
- 1 minute remaining: Countdown with red alert
- Time expired: "Time's up! Submitting your exam..."

---

## Email Templates

### 1. Exam Scheduling Invitation
```html
Subject: Schedule Your Screening Exam - [Position]

Dear [Candidate Name],

Congratulations on progressing to the screening stage for [Position]!

Next Step: Schedule Your Exam

Please select a convenient time slot for your online screening exam:
[Schedule Button]

Exam Details:
- Duration: 60 minutes
- Format: Online (MCQ + Written Questions)
- Proctoring: Video recording required
- Browser: Chrome/Edge recommended

What to Prepare:
- Valid ID for verification
- Quiet, well-lit environment
- Stable internet connection
- Working camera and microphone

[View Available Slots]
```

### 2. Exam Confirmation
```html
Subject: Exam Scheduled - [Date] at [Time]

Dear [Candidate Name],

Your screening exam has been scheduled!

Date: [Date]
Time: [Time] ([Timezone])
Duration: 60 minutes
Exam Link: [Link] (Available 15 minutes before exam)

[Add to Calendar Button]

Reminders:
- You'll receive a reminder 24 hours before
- Please join 10 minutes early for verification
- Have your ID ready

Good luck!
```

### 3. Exam Reminder (24 hours)
```html
Subject: Reminder: Your Exam Tomorrow at [Time]

Your screening exam is scheduled for tomorrow!

Date: [Date]
Time: [Time]
Duration: 60 minutes

Please ensure:
✅ Camera and microphone are working
✅ Internet connection is stable
✅ Quiet environment is ready
✅ ID is available

[View Exam Details]
```

### 4. Exam Reminder (1 hour)
```html
Subject: Your Exam Starts in 1 Hour

Your screening exam starts in 1 hour!

[Start Exam Button]

Technical Check:
- Click the button above to verify your setup
- Complete pre-exam checks
- Exam will be available at [Time]
```

---

## Security & Anti-Cheating Measures

### 1. Technical Measures:
- ✅ Browser lock (disable right-click, copy, print)
- ✅ Fullscreen enforcement
- ✅ Tab switch detection
- ✅ Copy/paste blocking
- ✅ Multiple device detection
- ✅ Screen sharing detection

### 2. Behavioral Measures:
- ✅ Video proctoring analysis
- ✅ Face detection (multiple faces = cheating)
- ✅ Eye movement tracking
- ✅ Unusual activity flags
- ✅ Answer pattern analysis

### 3. Data Measures:
- ✅ Question randomization
- ✅ Option shuffling
- ✅ Unique exam per candidate
- ✅ Time-based question access
- ✅ No question pool reuse for retakes

---

## Implementation Plan

### Phase 1: Core Scheduling (Week 1-2)
1. ✅ Database schema creation
2. ✅ Exam slots creation interface (admin)
3. ✅ Self-scheduling interface (candidate)
4. ✅ Booking confirmation system
5. ✅ Email notifications

### Phase 2: Pre-Exam System (Week 2-3)
1. ✅ Pre-exam check interface
2. ✅ Identity verification
3. ✅ Technical requirements check
4. ✅ Rules agreement

### Phase 3: Exam Engine (Week 3-4)
1. ✅ Question generation enhancement
2. ✅ Exam interface development
3. ✅ Timer system
4. ✅ Answer saving
5. ✅ Auto-submit logic

### Phase 4: Video Recording (Week 4-5)
1. ✅ Recording implementation
2. ✅ Chunk upload system
3. ✅ Video storage
4. ✅ Proctoring detection
5. ✅ Video review interface

### Phase 5: Evaluation & Results (Week 5-6)
1. ✅ Auto-evaluation
2. ✅ Results dashboard
3. ✅ Video review tools
4. ✅ Candidate feedback

---

## UI/UX Recommendations

### Candidate Experience:
- **Clear Instructions**: Step-by-step guidance
- **Progress Indicators**: Always show progress
- **Time Visibility**: Prominent timer
- **Save Confirmations**: Show when answers are saved
- **Help Section**: FAQ and support during exam
- **Mobile Responsive**: Works on tablets (if allowed)

### Admin Experience:
- **Slot Management**: Easy slot creation/deletion
- **Booking Overview**: Calendar view of all bookings
- **Exam Monitoring**: Real-time exam status
- **Video Review**: Easy video playback interface
- **Proctoring Dashboard**: Suspicious activity alerts

---

## Cost Considerations

### Storage:
- Video storage: ~500MB per exam (60 min)
- 1000 exams/month = 500GB storage
- Cost: ~$10-20/month (Supabase Storage)

### API Costs:
- Question generation: ~$0.001 per exam
- Answer evaluation: ~$0.005 per exam
- Total: Negligible

### Infrastructure:
- Edge functions: Minimal cost
- Database: Included in Supabase plan

---

## Success Metrics

### Candidate Metrics:
- Scheduling completion rate
- On-time arrival rate
- Exam completion rate
- Average exam time
- Candidate satisfaction score

### System Metrics:
- Video recording success rate
- Auto-submit accuracy
- Proctoring detection accuracy
- Question quality score
- System uptime

---

## Conclusion

This comprehensive exam system provides:
1. ✅ **Flexible Scheduling**: Candidates choose their time
2. ✅ **Fair Assessment**: Job-relevant questions
3. ✅ **Exam Integrity**: Video proctoring and detection
4. ✅ **Smooth Experience**: Clear UI and guidance
5. ✅ **Scalability**: Handles multiple concurrent exams

**Next Steps**: 
1. Review and approve design
2. Start with Phase 1 (Scheduling)
3. Iterate based on feedback
4. Roll out to production

