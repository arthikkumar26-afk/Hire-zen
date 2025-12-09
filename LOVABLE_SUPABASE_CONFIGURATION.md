# Supabase Configuration for Lovable Cloud

This document contains all the Supabase-related changes needed for the on-demand exam system. Provide this information to Lovable cloud for automatic deployment.

---

## 📋 Database Migrations

### Migration 1: Create Exam System Base Tables
**File**: `backend/supabase/migrations/20250115000000_create_exam_system.sql`

This migration creates:
- `exam_slots` table (for optional slot-based scheduling)
- `exam_bookings` table (candidate exam bookings)
- `exam_sessions` table (active exam state tracking)
- `exam_question_sets` table (cached questions)
- All indexes, triggers, and RLS policies

**Key Points**:
- `exam_slot_id` is nullable (allows on-demand exams)
- `status` defaults to `'pending'` for on-demand exams
- Timing fields (`scheduled_start_time`, etc.) are nullable

### Migration 2: Create Video Storage Bucket
**File**: `backend/supabase/migrations/20250115000001_create_exam_videos_storage.sql`

This migration:
- Creates `exam-videos` storage bucket
- Sets bucket as private (not public)
- Sets 500MB file size limit
- Allows video/webm, video/mp4, video/quicktime MIME types
- Creates storage policies for authenticated users

### Migration 3: Add On-Demand Exam Fields
**File**: `backend/supabase/migrations/20250115000002_on_demand_exam_system.sql`

This migration adds:
- `deadline_at` column to `exam_bookings`
- `exam_duration_minutes` column to `exam_bookings`
- `is_on_demand` column to `exam_bookings`
- `exam_deadline_days` column to `jobs` table
- `exam_duration_minutes` column to `jobs` table
- `requires_exam` column to `jobs` table
- Makes `exam_slot_id` nullable (if not already)
- Creates deadline check trigger function
- Creates indexes for deadline queries

---

## 🔧 Edge Functions to Deploy

### 1. `create-exam-invitation`
**File**: `backend/supabase/functions/create-exam-invitation/index.ts`

**Purpose**: Creates exam invitation when candidate uploads resume

**Endpoint**: `/functions/v1/create-exam-invitation`

**Request Body**:
```json
{
  "candidateId": "uuid",
  "jobId": "uuid",
  "deadlineDays": 7,  // optional
  "examDurationMinutes": 60  // optional
}
```

**Returns**:
```json
{
  "success": true,
  "bookingId": "uuid",
  "examToken": "uuid",
  "deadlineAt": "iso-timestamp",
  "examDurationMinutes": 60
}
```

### 2. `generate-exam-questions`
**File**: `backend/supabase/functions/generate-exam-questions/index.ts`

**Purpose**: Generates AI-powered exam questions based on job description

**Endpoint**: `/functions/v1/generate-exam-questions`

**Request Body**:
```json
{
  "jobId": "uuid",
  "jobDescription": "string",  // optional
  "position": "string",  // optional
  "examDurationMinutes": 60  // optional
}
```

**Returns**:
```json
{
  "questions": [
    {
      "question": "string",
      "category": "technical|behavioral|...",
      "type": "mcq|written",
      "difficulty": "entry|mid|senior",
      "options": ["A", "B", "C", "D"],  // only for MCQ
      "expectedAnswer": "string"
    }
  ]
}
```

### 3. `evaluate-exam-answers`
**File**: `backend/supabase/functions/evaluate-exam-answers/index.ts`

**Purpose**: Evaluates candidate answers using AI

**Endpoint**: `/functions/v1/evaluate-exam-answers`

**Request Body**:
```json
{
  "examToken": "uuid",
  "questions": [...],
  "answers": [
    {
      "question": "string",
      "answer": "string"
    }
  ]
}
```

**Returns**:
```json
{
  "evaluation": {
    "answerEvaluations": [...],
    "overallScore": 85,
    "strengths": [...],
    "weaknesses": [...],
    "summary": "string",
    "recommendation": "string"
  }
}
```

### 4. `send-candidate-email` (Update Existing)
**File**: `backend/supabase/functions/send-candidate-email/index.ts`

**Purpose**: Sends various candidate emails (updated to include exam_invitation type)

**New Email Type**: `exam_invitation`

**Request Body** (for exam_invitation):
```json
{
  "candidateId": "uuid",
  "type": "exam_invitation",
  "examToken": "uuid",
  "deadlineDays": 7
}
```

---

## 🔐 Environment Variables Required

Set these in Lovable/Supabase environment variables:

1. **`LOVABLE_API_KEY`**
   - Purpose: For AI question generation and evaluation
   - Required by: `generate-exam-questions`, `evaluate-exam-answers`
   - Already managed by Lovable (auto-configured)

2. **`RESEND_API_KEY`**
   - Purpose: For sending email notifications
   - Required by: `send-candidate-email`
   - Location: Resend dashboard

3. **`VITE_FRONTEND_URL`**
   - Purpose: Generate exam links in emails
   - Format: `https://your-domain.com`
   - Required by: `send-candidate-email`

4. **`SUPABASE_URL`**
   - Purpose: Supabase project URL
   - Auto-configured by Lovable

5. **`SUPABASE_SERVICE_ROLE_KEY`**
   - Purpose: Service role access for functions
   - Auto-configured by Lovable

---

## 📦 Storage Bucket Configuration

### Bucket: `exam-videos`

**Configuration**:
- **Name**: `exam-videos`
- **Public**: `false` (private bucket)
- **File Size Limit**: `524288000` bytes (500 MB)
- **Allowed MIME Types**:
  - `video/webm`
  - `video/mp4`
  - `video/quicktime`

**Storage Policies**:
1. **Authenticated users can upload**:
   ```sql
   CREATE POLICY "Allow authenticated users to upload exam videos"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'exam-videos');
   ```

2. **Authenticated users can view**:
   ```sql
   CREATE POLICY "Allow authenticated users to view exam videos"
   ON storage.objects FOR SELECT
   TO authenticated
   USING (bucket_id = 'exam-videos');
   ```

3. **Service role full access**:
   ```sql
   CREATE POLICY "Service role can manage exam videos"
   ON storage.objects FOR ALL
   TO service_role
   USING (bucket_id = 'exam-videos');
   ```

---

## 📊 Database Schema Summary

### Tables to Create/Modify:

1. **`exam_slots`** (CREATE)
   - Optional table for slot-based scheduling
   - Not required for on-demand system

2. **`exam_bookings`** (CREATE)
   - Main exam booking table
   - Links candidates to jobs
   - Stores deadline, duration, status
   - `exam_slot_id` is **nullable**

3. **`exam_sessions`** (CREATE)
   - Active exam state
   - Stores questions, answers, timing
   - Links to booking via `booking_id`

4. **`exam_question_sets`** (CREATE)
   - Caches generated questions
   - Optional optimization

5. **`jobs`** (MODIFY)
   - Add: `exam_deadline_days` (INTEGER, default 7)
   - Add: `exam_duration_minutes` (INTEGER, default 60)
   - Add: `requires_exam` (BOOLEAN, default true)

---

## 🔄 Row Level Security (RLS) Policies

### `exam_bookings` Policies:
- Candidates can view their own bookings
- Anyone can create bookings (for public access)
- Anyone can update booking by exam token (for exam taking)

### `exam_sessions` Policies:
- Anyone can view session by token (for exam taking)
- Anyone can update session by token (for saving answers)
- Anyone can create session

### `exam_question_sets` Policies:
- Authenticated users can manage question sets
- Public read access

---

## ⚙️ Database Functions & Triggers

### Function: `check_exam_deadline()`
- Automatically marks exams as expired when deadline passes
- Trigger runs on INSERT/UPDATE of `exam_bookings`

### Triggers:
- `update_exam_bookings_updated_at` - Auto-update timestamp
- `update_exam_sessions_updated_at` - Auto-update timestamp
- `trigger_check_exam_deadline` - Auto-expire exams

---

## 📝 Default Values

### Job Defaults:
- `exam_deadline_days`: `7` (7 days after resume upload)
- `exam_duration_minutes`: `60` (60 minutes to complete)
- `requires_exam`: `true` (exam required by default)

### Exam Booking Defaults:
- `status`: `'pending'` (for on-demand exams)
- `exam_duration_minutes`: `60`
- `time_limit_seconds`: `3600` (60 minutes)
- `is_on_demand`: `true`
- `max_attempts`: `1`

---

## 🔗 API Endpoints Summary

### Public Endpoints (No Auth Required):
- `POST /functions/v1/create-exam-invitation`
- `POST /functions/v1/generate-exam-questions`
- `POST /functions/v1/evaluate-exam-answers`
- `POST /functions/v1/send-candidate-email`

### Database Access:
- Candidates can access via exam tokens (no auth needed)
- Admins use authenticated access

---

## ✅ Verification Checklist for Lovable

After deployment, verify:

1. **Database**:
   - [ ] `exam_bookings` table exists with nullable `exam_slot_id`
   - [ ] `exam_sessions` table exists
   - [ ] `jobs` table has new columns (`exam_deadline_days`, etc.)
   - [ ] `exam-videos` storage bucket exists

2. **Edge Functions**:
   - [ ] `create-exam-invitation` deployed
   - [ ] `generate-exam-questions` deployed
   - [ ] `evaluate-exam-answers` deployed
   - [ ] `send-candidate-email` updated

3. **Environment Variables**:
   - [ ] `LOVABLE_API_KEY` set (auto-managed)
   - [ ] `RESEND_API_KEY` set
   - [ ] `VITE_FRONTEND_URL` set

4. **Storage**:
   - [ ] `exam-videos` bucket created
   - [ ] Storage policies configured
   - [ ] File size limit set (500MB)

---

## 🚀 Deployment Instructions for Lovable

### Option 1: Automatic (If Supported)
Lovable should automatically:
1. Run migrations from `backend/supabase/migrations/`
2. Deploy edge functions from `backend/supabase/functions/`
3. Set environment variables from config
4. Create storage buckets from migrations

### Option 2: Manual Steps
If Lovable requires manual input, provide:

1. **Run Migrations** (in order):
   - `20250115000000_create_exam_system.sql`
   - `20250115000001_create_exam_videos_storage.sql`
   - `20250115000002_on_demand_exam_system.sql`

2. **Deploy Functions**:
   - Deploy all functions in `backend/supabase/functions/`

3. **Set Environment Variables**:
   - `RESEND_API_KEY` (get from Resend)
   - `VITE_FRONTEND_URL` (your frontend URL)

---

## 📋 Migration File Locations

All migration files are in:
```
backend/supabase/migrations/
├── 20250115000000_create_exam_system.sql
├── 20250115000001_create_exam_videos_storage.sql
└── 20250115000002_on_demand_exam_system.sql
```

All edge function files are in:
```
backend/supabase/functions/
├── create-exam-invitation/index.ts
├── generate-exam-questions/index.ts
├── evaluate-exam-answers/index.ts
└── send-candidate-email/index.ts (updated)
```

---

## 🎯 What Lovable Needs to Do

1. ✅ **Read migration files** and apply to Supabase database
2. ✅ **Deploy edge functions** to Supabase Edge Functions
3. ✅ **Create storage bucket** with specified configuration
4. ✅ **Set environment variables** (if not auto-managed)
5. ✅ **Configure RLS policies** (from migrations)

---

## 📞 Testing After Deployment

Once Lovable completes deployment, test:

1. Create a job with exam settings
2. Upload a candidate resume
3. Verify exam invitation created in database
4. Check email sent (if Resend configured)
5. Access exam via token URL
6. Verify questions generate
7. Complete exam and verify submission

---

## 📄 Files Reference

All required files are already in the repository:
- ✅ Migration SQL files
- ✅ Edge function TypeScript files
- ✅ Frontend components
- ✅ Configuration documented

**Just push to GitHub and let Lovable handle deployment!** 🚀

