# 📋 Supabase Configuration for Lovable Cloud - Quick Summary

## 🎯 What Lovable Needs to Do

Lovable cloud should automatically detect and deploy these from the repository:

---

## 1. Database Migrations (Auto-run)

**Location**: `backend/supabase/migrations/`

**Files** (run in order):
1. ✅ `20250115000000_create_exam_system.sql`
2. ✅ `20250115000001_create_exam_videos_storage.sql`
3. ✅ `20250115000002_on_demand_exam_system.sql`

**What they do**:
- Create `exam_bookings`, `exam_sessions`, `exam_slots`, `exam_question_sets` tables
- Create `exam-videos` storage bucket
- Add on-demand exam fields to `jobs` and `exam_bookings`
- Set up RLS policies, indexes, triggers

---

## 2. Edge Functions (Auto-deploy)

**Location**: `backend/supabase/functions/`

**Functions to deploy**:
1. ✅ `create-exam-invitation/index.ts`
2. ✅ `generate-exam-questions/index.ts`
3. ✅ `evaluate-exam-answers/index.ts`
4. ✅ `send-candidate-email/index.ts` (update existing)

---

## 3. Storage Bucket (Auto-create)

**Bucket**: `exam-videos`
- Created by migration `20250115000001_create_exam_videos_storage.sql`
- Private bucket
- 500MB file limit
- Video formats: webm, mp4, quicktime

---

## 4. Environment Variables (User to Provide)

**Required**:
```
RESEND_API_KEY=your_resend_api_key_here
VITE_FRONTEND_URL=https://your-domain.com
```

**Optional**:
```
EMAIL_FROM=HireZen HR <hr@hire-zen.com>
EMAIL_REPLY_TO=hr@hire-zen.com
```

**Auto-managed by Lovable**:
- `LOVABLE_API_KEY` ✅
- `SUPABASE_URL` ✅
- `SUPABASE_SERVICE_ROLE_KEY` ✅

---

## 📊 Database Changes Summary

### New Tables:
- `exam_bookings` - Exam invitations/bookings
- `exam_sessions` - Active exam state
- `exam_slots` - Optional slots (not used for on-demand)
- `exam_question_sets` - Question caching

### Modified Tables:
- `jobs` - Added: `exam_deadline_days`, `exam_duration_minutes`, `requires_exam`

---

## ✅ Post-Deployment Verification

After Lovable completes deployment, verify:

1. **Tables exist**: Check `exam_bookings` and `exam_sessions` exist
2. **Functions work**: Test `/functions/v1/create-exam-invitation`
3. **Storage exists**: Check `exam-videos` bucket exists
4. **Env vars set**: Verify `RESEND_API_KEY` and `VITE_FRONTEND_URL` are set

---

## 🚀 That's It!

Lovable should automatically:
- ✅ Detect migration files
- ✅ Run migrations in order
- ✅ Deploy edge functions
- ✅ Create storage bucket

**User just needs to provide**:
- `RESEND_API_KEY`
- `VITE_FRONTEND_URL`

---

## 📄 Files Are In Repository

All required files are already in:
- `backend/supabase/migrations/` - SQL migrations
- `backend/supabase/functions/` - Edge function code

**No additional configuration needed - just push to GitHub!** 🎉

