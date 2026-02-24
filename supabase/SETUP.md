# Supabase Setup Guide

Follow these steps before running the app for the first time.

## 1. Create a Supabase Project

1. Go to https://supabase.com and sign in (or create a free account)
2. Click **New project**
3. Give it a name (e.g. `fuel`), choose a region close to you, set a strong database password
4. Wait ~2 minutes for the project to provision

## 2. Get Your Project Credentials

In your Supabase project dashboard:

1. Go to **Settings → API**
2. Copy the following values — you'll need them for both `.env` files:
   - **Project URL** → `SUPABASE_URL`
#   - **anon / public key** → `SUPABASE_ANON_KEY`
#   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret — backend only)

## 3. Run the Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New query**
3. Copy and paste the entire contents of `schema.sql` (in this folder)
4. Click **Run**

## 4. Enable Email Auth

1. Go to **Authentication → Providers**
2. Ensure **Email** is enabled (it is by default)
3. Optionally disable email confirmation for easier local dev:
   - Go to **Authentication → Settings**
   - Turn off **Enable email confirmations**

## Done!

You're ready to add your credentials to the `.env` files in `frontend/` and `backend/` and start the app.
