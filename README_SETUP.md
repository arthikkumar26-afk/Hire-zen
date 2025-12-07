# 🚀 Quick Start - HireZen Setup

**Welcome!** This is your quick reference for setting up the HireZen project.

---

## 📖 Main Documentation

**👉 START HERE:** `doc/COMPLETE_SETUP_GUIDE.md`

This comprehensive guide walks you through:
- ✅ Getting all API keys (Supabase, Lovable, Resend)
- ✅ Configuring Supabase Edge Functions Secrets
- ✅ Setting up frontend environment
- ✅ Setting up backend environment
- ✅ Testing and verification

---

## ✅ Quick Checklist

Use this checklist: **`SETUP_CHECKLIST.md`**

---

## 📁 Files Created

### Environment Files:
- ✅ `frontend/.env.local` - Frontend environment variables
- ✅ `backend/.env` - Backend environment variables

### Template Files:
- ✅ `frontend/.env.local.example` - Template for frontend
- ✅ `backend/.env.example` - Template for backend

### Documentation:
- ✅ `doc/COMPLETE_SETUP_GUIDE.md` - **Main setup guide** ⭐
- ✅ `SETUP_CHECKLIST.md` - Quick checklist
- ✅ `doc/QUICK_REFERENCE_ENV_VARS.md` - Quick reference
- ✅ `doc/SUPABASE_EDGE_FUNCTIONS_SECRETS.md` - Edge Functions details
- ✅ `doc/HOW_TO_GET_LOVABLE_API_KEY.md` - Lovable API key guide

---

## 🎯 What You Need to Do

### 1. Get API Keys (Required)

| Key | Where to Get | Used For |
|-----|--------------|----------|
| **Supabase Anon Key** | [Supabase Dashboard](https://supabase.com/dashboard/project/rfzokhwbmkhifnjljeyc/settings/api) → Settings → API | Frontend |
| **Supabase Service Role Key** | Same as above | Backend |
| **Lovable API Key** | [lovable.dev](https://lovable.dev) → Settings → API Keys | AI Features |
| **Resend API Key** | [resend.com/api-keys](https://resend.com/api-keys) | Email Notifications |

### 2. Configure Supabase Edge Functions

Go to: [Supabase Edge Functions Secrets](https://supabase.com/dashboard/project/rfzokhwbmkhifnjljeyc/settings/functions/secrets)

Add these secrets:
- `RESEND_API_KEY` = [Your Resend key]
- `LOVABLE_API_KEY` = [Your Lovable key]

### 3. Update Environment Files

**Frontend:** Edit `frontend/.env.local`
- Replace `[PASTE_YOUR_ANON_PUBLIC_KEY_HERE]` with your Supabase anon key
- Replace `[PASTE_YOUR_LOVABLE_API_KEY_HERE]` with your Lovable key

**Backend:** Edit `backend/.env`
- Replace `[PASTE_YOUR_SERVICE_ROLE_KEY_HERE]` with your Supabase service_role key
- Replace `[PASTE_YOUR_RESEND_API_KEY_HERE]` with your Resend key
- Add MongoDB URI if using MongoDB

---

## 🧪 Test Your Setup

### Frontend:
```bash
cd frontend
npm install
npm run dev
```

### Backend:
```bash
cd backend
npm install
npm run dev
```

---

## 📚 All Documentation

1. **`doc/COMPLETE_SETUP_GUIDE.md`** ⭐ - **Start here!**
2. `SETUP_CHECKLIST.md` - Quick checklist
3. `doc/QUICK_REFERENCE_ENV_VARS.md` - Quick reference
4. `doc/SUPABASE_SETUP_GUIDE.md` - Database setup
5. `doc/SUPABASE_EDGE_FUNCTIONS_SECRETS.md` - Edge Functions details
6. `doc/HOW_TO_GET_LOVABLE_API_KEY.md` - Lovable API key

---

## 🆘 Need Help?

1. Check `doc/COMPLETE_SETUP_GUIDE.md` - It has troubleshooting section
2. Verify all API keys are correct
3. Make sure environment files are in the right locations
4. Restart dev servers after changing .env files

---

**Last Updated:** January 2025  
**Project:** HireZen (hiregen)  
**Project ID:** `rfzokhwbmkhifnjljeyc`

