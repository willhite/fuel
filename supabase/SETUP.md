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

### Fresh installation

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New query**
3. Copy and paste the entire contents of `schema.sql` (in this folder)
4. Click **Run**

### Applying migrations to an existing database

Each file in `migrations/` represents an incremental change to the schema. Run them in order, skipping any you've already applied:

| File | Phase | Description |
|------|-------|-------------|
| `migrations/001_initial_schema.sql` | 1 | profiles, meals, trigger, RLS |
| `migrations/002_add_macros.sql` | 2 | macro columns on profiles and meals |
| `migrations/003_add_recipes.sql` | 3 | recipes and recipe_ingredients tables |

To apply a migration:
1. Go to **SQL Editor → New query**
2. Paste the contents of the migration file
3. Click **Run**

### Adding a new migration

When making a schema change:
1. Create a new file in `migrations/` with the next number (e.g. `004_your_change.sql`)
2. Write the change as `ALTER TABLE` or `CREATE TABLE` statements — never modify existing migration files
3. Update `schema.sql` to reflect the new full schema state

## 4. Enable Email Auth

1. Go to **Authentication → Providers**
2. Ensure **Email** is enabled (it is by default)
3. Optionally disable email confirmation for easier local dev:
   - Go to **Authentication → Settings**
   - Turn off **Enable email confirmations**

## Done!

You're ready to add your credentials to the `.env` files in `frontend/` and `backend/` and start the app.
