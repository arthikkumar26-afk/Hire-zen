# Setup Checklist - HireZen Project

**Quick checklist to complete all setup steps**

---

## ✅ Step-by-Step Checklist

### 🔑 Part 1: Get All API Keys

- [x] **Supabase Anon/Public Key** ✅ DONE
  - [x] Retrieved from Supabase Dashboard
  - [x] Added to `frontend/.env.local`

- [x] **Supabase Service Role Key** ✅ DONE
  - [x] Retrieved from Supabase Dashboard
  - [x] Added to `backend/.env`

- [ ] **Lovable API Key**
  - [ ] Go to: https://lovable.dev
  - [ ] Sign in → Settings → API Keys
  - [ ] Copy or create API key
  - [ ] Save securely

- [x] **Resend API Key** ✅ DONE
  - [x] Retrieved from Resend
  - [x] Added to `backend/.env`

---

### 🔧 Part 2: Supabase Edge Functions Secrets

- [x] **Add RESEND_API_KEY** ✅ DONE
  - [x] Added to Supabase Edge Functions Secrets

- [ ] **Add LOVABLE_API_KEY**
  - [ ] Same page as above
  - [ ] Click "Add new secret"
  - [ ] Name: `LOVABLE_API_KEY`
  - [ ] Value: [Paste Lovable key]
  - [ ] Save

- [ ] **(Optional) Email Config Secrets**
  - [ ] `EMAIL_FROM` = `HireZen HR <hr@hire-zen.com>`
  - [ ] `EMAIL_REPLY_TO` = `hr@hire-zen.com`
  - [ ] `EMAIL_NOREPLY` = `noreply@hire-zen.com`
  - [ ] `EMAIL_NOREPLY_NAME` = `HireZen`

---

### 📄 Part 3: Frontend Environment

- [x] **Create frontend/.env.local** ✅ DONE
  - [x] File created
  - [x] Supabase keys added

- [x] **Fill in values:**
  - [x] `VITE_SUPABASE_URL` = `https://rfzokhwbmkhifnjljeyc.supabase.co` ✅
  - [x] `VITE_SUPABASE_PUBLISHABLE_KEY` = [Added] ✅
  - [ ] `VITE_LOVABLE_API_KEY` = [Still needed - paste Lovable key]
  - [x] `VITE_API_BASE_URL` = `http://localhost:3002` ✅
  - [x] `VITE_FRONTEND_URL` = `http://localhost:5173` ✅

---

### 🖥️ Part 4: Backend Environment

- [x] **Create/Update backend/.env** ✅ DONE
  - [x] File created/updated
  - [x] Supabase keys added

- [x] **Fill in values:**
  - [x] `SUPABASE_URL` = `https://rfzokhwbmkhifnjljeyc.supabase.co` ✅
  - [x] `SUPABASE_SERVICE_ROLE_KEY` = [Added] ✅
  - [x] `RESEND_API_KEY` = [Added] ✅
  - [ ] `MONGODB_URI` = [Your MongoDB URI if using - optional]
  - [x] `DB_NAME` = `hirezen` ✅
  - [x] `PORT` = `3002` ✅
  - [x] `NODE_ENV` = `development` ✅

---

### ✅ Part 5: Verification

- [ ] **Test Frontend:**
  - [ ] `cd frontend`
  - [ ] `npm install` (if needed)
  - [ ] `npm run dev`
  - [ ] Check for errors in console
  - [ ] Verify Supabase connection works

- [ ] **Test Backend:**
  - [ ] `cd backend`
  - [ ] `npm install` (if needed)
  - [ ] `npm run dev`
  - [ ] Check for errors
  - [ ] Verify Supabase connection works

- [ ] **Test Edge Functions:**
  - [ ] Upload a resume (test AI parsing)
  - [ ] Trigger email (test email sending)
  - [ ] Check Edge Functions logs for errors

---

## 🎉 All Done!

Once all items are checked, your setup is complete!

---

## 📚 Need Help?

- **Complete Setup Guide:** `doc/COMPLETE_SETUP_GUIDE.md`
- **Quick Reference:** `doc/QUICK_REFERENCE_ENV_VARS.md`
- **Edge Functions Secrets:** `doc/SUPABASE_EDGE_FUNCTIONS_SECRETS.md`

---

**Last Updated:** January 2025

