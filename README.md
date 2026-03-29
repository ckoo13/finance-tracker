# Calvin's Finance Tracker

Personal finance dashboard built with React + Vite, backed by Supabase.

## Setup

### 1. Create a Supabase project
1. Go to https://supabase.com and create a free project
2. Go to Project Settings > API and copy your:
   - Project URL (VITE_SUPABASE_URL)
   - anon/public key (VITE_SUPABASE_ANON_KEY)

### 2. Run the database migration
1. Go to Supabase Dashboard > SQL Editor
2. Paste the contents of `supabase/migration.sql` and run it
3. (Optional) Paste `supabase/seed.sql` to load your existing transaction data

### 3. Configure environment
```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

### 4. Install & run
```bash
npm install
npm run dev
```

### 5. Deploy to Vercel
```bash
npm i -g vercel
vercel
# Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY as env vars in Vercel dashboard
```

## Stack
- **Frontend**: React + Vite
- **Database**: Supabase (Postgres)
- **Auth**: Supabase Auth (email/password)
- **Hosting**: Vercel
- **Styling**: Inline styles (migrated from artifact)
