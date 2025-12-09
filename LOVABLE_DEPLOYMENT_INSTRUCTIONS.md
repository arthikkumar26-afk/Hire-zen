# Instructions for Lovable Cloud - Supabase Configuration

## Summary
This project requires Supabase database migrations, edge functions, and storage configuration for an on-demand exam system. All files are in the repository and ready for deployment.

---

## 📦 What Needs to Be Deployed

### 1. Database Migrations (3 files)
Location: `backend/supabase/migrations/`

**Run in this order:**
1. `20250115000000_create_exam_system.sql`
   - Creates base tables: `exam_slots`, `exam_bookings`, `exam_sessions`, `exam_question_sets`
   - Sets up RLS policies, indexes, triggers

2. `20250115000001_create_exam_videos_storage.sql`
   - Creates `exam-videos` storage bucket
   - Configures storage policies

3. `20250115000002_on_demand_exam_system.sql`
   - Adds on-demand fields to `exam_bookings` and `jobs` tables
   - Makes `exam_slot_id` nullable
   - Adds deadline management

### 2. Edge Functions (4 functions)
Location: `backend/supabase/functions/`

**Deploy these functions:**
1. `create-exam-invitation/` - Creates exam invitations automatically
2. `generate-exam-questions/` - Generates AI exam questions
3. `evaluate-exam-answers/` - Evaluates candidate answers with AI
4. `send-candidate-email/` - Send emails (already exists, needs update)

### 3. Storage Bucket
**Bucket Name:** `exam-videos`
- Private bucket (not public)
- File size limit: 500MB
- Allowed types: video/webm, video/mp4, video/quicktime

### 4. Environment Variables
**Required:**
- `RESEND_API_KEY` - For sending emails (user needs to provide)
- `VITE_FRONTEND_URL` - Frontend URL for email links (e.g., `https://your-app.com`)
- `LOVABLE_API_KEY` - Already managed by Lovable

**Optional but recommended:**
- `EMAIL_FROM` - Default: "HireZen HR <hr@hire-zen.com>"
- `EMAIL_REPLY_TO` - Default: "hr@hire-zen.com"

---

## 🔧 Database Schema Changes

### New Tables:
1. **`exam_bookings`** - Stores exam invitations/bookings
   - Key columns: `candidate_id`, `job_id`, `exam_token`, `deadline_at`, `status`
   - `exam_slot_id` is **nullable** (for on-demand exams)

2. **`exam_sessions`** - Active exam state
   - Key columns: `booking_id`, `questions`, `answers`, `time_remaining_seconds`

3. **`exam_slots`** - Optional slot-based scheduling (not used for on-demand)
4. **`exam_question_sets`** - Caches questions (optional optimization)

### Modified Tables:
1. **`jobs`** - Add columns:
   - `exam_deadline_days` (INTEGER, default 7)
   - `exam_duration_minutes` (INTEGER, default 60)
   - `requires_exam` (BOOLEAN, default true)

---

## 🔐 Security Configuration

### Row Level Security (RLS):
- **`exam_bookings`**: Public can create/update by token (for exam taking)
- **`exam_sessions`**: Public can access by token (for exam taking)
- **Storage**: Authenticated users can upload/view exam videos

### API Access:
- All edge functions accept public requests (validate via tokens)
- No authentication required for exam taking flow

---

## ✅ Verification Steps

After Lovable deploys, verify:

1. **Database**:
   ```sql
   -- Check tables exist
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('exam_bookings', 'exam_sessions');
   
   -- Check jobs columns
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'jobs' 
   AND column_name IN ('exam_deadline_days', 'exam_duration_minutes', 'requires_exam');
   ```

2. **Edge Functions**:
   - Check all 4 functions are deployed and accessible
   - Test with a simple request

3. **Storage**:
   ```sql
   -- Check bucket exists
   SELECT name FROM storage.buckets WHERE name = 'exam-videos';
   ```

---

## 📝 Quick Reference

**Migration Files:** `backend/supabase/migrations/*.sql`
**Edge Functions:** `backend/supabase/functions/*/index.ts`
**Storage Bucket:** Created by migration `20250115000001_create_exam_videos_storage.sql`

**Default Values:**
- Exam deadline: 7 days after resume upload
- Exam duration: 60 minutes
- Exams required: Yes

---

## 🚀 Deployment Command (if using CLI)

```bash
# Migrations (if not auto-applied)
supabase db push

# Functions
supabase functions deploy create-exam-invitation
supabase functions deploy generate-exam-questions
supabase functions deploy evaluate-exam-answers
```

---

## 📋 Checklist for User

**Before asking Lovable to deploy, ensure:**
- [ ] `RESEND_API_KEY` is available (get from Resend dashboard)
- [ ] `VITE_FRONTEND_URL` is set to your frontend domain
- [ ] All files are pushed to GitHub
- [ ] Lovable has access to the repository

---

**All files are ready in the repository. Just provide Lovable with:**
1. This document
2. `RESEND_API_KEY` value
3. `VITE_FRONTEND_URL` value
4. Confirmation that migrations and functions should be auto-deployed

