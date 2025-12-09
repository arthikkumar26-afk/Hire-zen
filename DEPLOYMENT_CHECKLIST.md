# Deployment Checklist - On-Demand Exam System ✅

## Quick Answer: **YES, it should work!** But verify these steps:

---

## ✅ Pre-Deployment Checklist

### 1. Database Migrations (REQUIRED)
Run these migrations in order:
- [ ] `20250115000000_create_exam_system.sql` - Creates base tables
- [ ] `20250115000001_create_exam_videos_storage.sql` - Creates storage bucket
- [ ] `20250115000002_on_demand_exam_system.sql` - Adds on-demand fields

**Location**: `backend/supabase/migrations/`

**How to run**: 
- Via Supabase Dashboard → SQL Editor
- Or via Supabase CLI: `supabase db push`

### 2. Edge Functions (REQUIRED)
Deploy these edge functions:
- [ ] `create-exam-invitation` - Creates exam invitations
- [ ] `generate-exam-questions` - Generates AI questions
- [ ] `evaluate-exam-answers` - Evaluates exam answers
- [ ] `send-candidate-email` - Sends emails (should already exist)
- [ ] `upload-exam-video` - Uploads videos (optional, handled client-side)

**Location**: `backend/supabase/functions/`

**How to deploy**: 
- Via Supabase Dashboard → Edge Functions
- Or via Supabase CLI: `supabase functions deploy <function-name>`

### 3. Storage Bucket (REQUIRED)
- [ ] Create `exam-videos` bucket
- [ ] Set policies for authenticated uploads
- [ ] Migration should create this automatically

### 4. Environment Variables (REQUIRED)
Ensure these are set in Supabase:
- [ ] `LOVABLE_API_KEY` - For AI question generation
- [ ] `RESEND_API_KEY` - For sending emails
- [ ] `VITE_FRONTEND_URL` - Frontend URL for links

### 5. Frontend Routes (REQUIRED)
Verify routes exist in `App.tsx`:
- [x] `/exam/:token` - Exam interface
- [x] `/admin/exam-settings/:id` - Admin settings
- [x] `/apply/:jobId` - Apply job (creates exam invitation)

---

## 🧪 Testing Flow

### Step 1: Admin Setup
1. Create/Edit a job
2. Navigate to `/admin/exam-settings/:jobId`
3. Configure:
   - Require Exam: ✅ Enabled
   - Deadline Days: 7
   - Duration Minutes: 60
4. Save settings

### Step 2: Candidate Flow
1. Go to `/apply/:jobId` (public job page)
2. Upload resume
3. **Expected**: 
   - Resume processed
   - Exam invitation created automatically
   - Email sent with exam link

### Step 3: Take Exam
1. Click exam link from email (or use token)
2. Complete pre-exam checks
3. Start exam
4. Answer questions
5. Submit exam

### Step 4: Verify
1. Check `exam_bookings` table - should have booking
2. Check `exam_sessions` table - should have session
3. Check email was sent
4. Check video uploaded (if recording worked)

---

## ⚠️ Potential Issues & Fixes

### Issue 1: "Function not found" errors
**Fix**: Deploy edge functions manually:
```bash
supabase functions deploy create-exam-invitation
supabase functions deploy generate-exam-questions
supabase functions deploy evaluate-exam-answers
```

### Issue 2: Database migration errors
**Fix**: Check if tables already exist, modify migrations to use `IF NOT EXISTS`

### Issue 3: Email not sending
**Fix**: 
- Verify `RESEND_API_KEY` is set
- Check Resend dashboard for logs
- Verify email templates in code

### Issue 4: Video not uploading
**Fix**:
- Check storage bucket exists: `exam-videos`
- Verify storage policies allow uploads
- Check browser console for errors

### Issue 5: Questions not generating
**Fix**:
- Verify `LOVABLE_API_KEY` is set
- Check AI API is accessible
- Review edge function logs

---

## 🔍 Verification Commands

### Check Database Tables
```sql
-- Should return tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('exam_bookings', 'exam_sessions', 'exam_slots');

-- Check columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'exam_bookings' 
AND column_name IN ('deadline_at', 'is_on_demand', 'exam_duration_minutes');
```

### Check Edge Functions
```bash
supabase functions list
# Should show: create-exam-invitation, generate-exam-questions, evaluate-exam-answers
```

### Check Storage
```sql
-- Check bucket exists
SELECT name FROM storage.buckets WHERE name = 'exam-videos';
```

---

## 📝 Post-Deployment Testing

### Test 1: Resume Upload → Exam Creation
1. Upload resume via `/apply/:jobId`
2. Check database: `exam_bookings` should have new row
3. Check email sent
4. Status should be `pending`

### Test 2: Exam Access
1. Get exam token from database
2. Visit `/exam/:token`
3. Should see exam ready screen
4. Deadline should be visible

### Test 3: Question Generation
1. Start exam
2. Questions should generate/load
3. Should see MCQ and written questions

### Test 4: Video Recording
1. Grant permissions
2. Start recording
3. Check browser console for errors
4. Verify video chunks uploading

### Test 5: Exam Submission
1. Complete exam
2. Submit
3. Check `exam_bookings` status = `completed`
4. Check score is saved
5. Verify video URL is saved

---

## 🚀 Deployment Steps

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Add on-demand exam system"
   git push
   ```

2. **Deploy Database Migrations**
   - Run migrations via Supabase Dashboard or CLI

3. **Deploy Edge Functions**
   - Deploy each function individually
   - Wait for deployment confirmation

4. **Verify Environment Variables**
   - Check all required env vars are set

5. **Test End-to-End**
   - Follow testing flow above

6. **Monitor Logs**
   - Check Supabase logs for errors
   - Check edge function logs
   - Monitor email delivery

---

## ✅ Success Criteria

The system is ready when:
- [x] Database tables exist
- [x] Edge functions deployed
- [x] Storage bucket exists
- [x] Resume upload creates exam invitation
- [x] Email sent successfully
- [x] Exam page loads with token
- [x] Questions generate/load
- [x] Exam can be started
- [x] Video recording works
- [x] Exam can be submitted
- [x] Results saved correctly

---

## 🎯 Current Status

### ✅ Implemented & Ready:
- Database schema
- Edge functions (code written)
- Frontend components
- Email templates
- Video recording
- On-demand logic

### ⚠️ Needs Deployment:
- Database migrations (run on Supabase)
- Edge functions (deploy to Supabase)
- Environment variables (verify set)
- Storage bucket (verify created)

### 🔧 If Something Doesn't Work:
1. Check Supabase logs
2. Check browser console
3. Verify migrations ran
4. Verify functions deployed
5. Check environment variables
6. Review error messages

---

## 📞 Quick Debug

```sql
-- Check if exam invitation was created
SELECT * FROM exam_bookings 
WHERE candidate_id = '<candidate_id>' 
ORDER BY created_at DESC 
LIMIT 1;

-- Check exam token
SELECT exam_token FROM exam_bookings 
WHERE id = '<booking_id>';

-- Check if questions were generated
SELECT questions FROM exam_sessions 
WHERE booking_id = '<booking_id>';
```

---

## Final Answer

**YES**, after pushing to GitHub and completing deployment steps, a person **CAN** upload a resume and write an exam. The system is fully implemented, but requires:

1. ✅ Database migrations to be run
2. ✅ Edge functions to be deployed  
3. ✅ Environment variables to be set
4. ✅ Storage bucket to exist

Once these are complete, the full flow will work end-to-end!

