-- ============================================================
-- BrandMeld V2 — Database Schema Migration
-- Run against: Supabase Postgres project
-- Version: 2.0.0
-- ============================================================

-- ── Enable UUID extension (already enabled in Supabase) ──────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- EXISTING TABLES (V1) — Ensure they exist with correct schema
-- ============================================================

CREATE TABLE IF NOT EXISTS brand_dna (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  primary_hex TEXT DEFAULT '#EAFF00',
  typography TEXT[] DEFAULT '{}',
  voice_personality TEXT NOT NULL,
  banned_concepts TEXT[] DEFAULT '{}',
  source_url TEXT,
  forked_from_voice_id UUID,   -- marketplace voice this was forked from
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brief_what_changed TEXT NOT NULL,
  brief_why_it_matters TEXT,
  brief_target_audience TEXT,
  brief_call_to_action TEXT,
  proof_points TEXT[] DEFAULT '{}',
  selected_platforms TEXT[] DEFAULT '{twitter,linkedin,newsletter}',
  generated_drafts JSONB,
  authenticity_scores JSONB,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_request TEXT,
  brand_voice TEXT,
  results JSONB,
  platforms TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NEW TABLES (V2)
-- ============================================================

-- Published posts
CREATE TABLE IF NOT EXISTS published_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id),
  content TEXT NOT NULL,
  platform TEXT NOT NULL,          -- 'twitter' | 'linkedin' | 'email'
  platform_post_id TEXT,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  status TEXT DEFAULT 'published', -- draft | scheduled | published | failed | user_intent
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE NULLS NOT DISTINCT (platform, platform_post_id)
);

-- Engagement metrics (synced from platform APIs)
CREATE TABLE IF NOT EXISTS engagement_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES published_posts(id) ON DELETE CASCADE,
  likes_count INT DEFAULT 0,
  retweets_count INT DEFAULT 0,
  replies_count INT DEFAULT 0,
  shares_count INT DEFAULT 0,
  clicks_count INT DEFAULT 0,
  opens_count INT DEFAULT 0,
  impressions_count INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (post_id)
);

-- Analytics events (user action tracking)
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prompt templates (seed data, managed by admin)
CREATE TABLE IF NOT EXISTS prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  week_number INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weekly prompts per user
CREATE TABLE IF NOT EXISTS weekly_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_template_id UUID REFERENCES prompt_templates(id),
  custom_prompt_text TEXT,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  answered BOOLEAN DEFAULT FALSE,
  answer_text TEXT,
  created_campaign_id UUID REFERENCES campaigns(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User preferences (prompt timing, notification settings)
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  timezone TEXT DEFAULT 'UTC',
  weekly_prompts_enabled BOOLEAN DEFAULT TRUE,
  prompt_send_time TEXT DEFAULT '09:00',
  prompt_delivery_channels TEXT[] DEFAULT '{email,in_app}',
  notifications_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Connected social accounts (OAuth tokens, encrypted)
CREATE TABLE IF NOT EXISTS connected_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  platform_user_id TEXT,
  account_identifier TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (user_id, platform)
);

-- Voice Marketplace entries (admin-curated founders/creators)
CREATE TABLE IF NOT EXISTS voice_marketplace_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_name TEXT NOT NULL,
  creator_bio TEXT,
  creator_avatar_url TEXT,
  voice_personality TEXT NOT NULL,
  banned_concepts TEXT[] DEFAULT '{}',
  primary_hex TEXT DEFAULT '#EAFF00',
  typography TEXT[] DEFAULT '{}',
  category TEXT NOT NULL,          -- 'founder' | 'creator' | 'executive' | 'indie_hacker'
  sample_posts TEXT[] DEFAULT '{}',
  fork_count INT DEFAULT 0,
  rating FLOAT DEFAULT 0.0,
  rating_count INT DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tracks user forks from marketplace
CREATE TABLE IF NOT EXISTS voice_marketplace_forks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  voice_entry_id UUID NOT NULL REFERENCES voice_marketplace_entries(id),
  customizations JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Voice ratings / comments
CREATE TABLE IF NOT EXISTS voice_marketplace_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_entry_id UUID NOT NULL REFERENCES voice_marketplace_entries(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  comment_text TEXT NOT NULL,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign angle templates (also seeded in marketplace_service.py)
CREATE TABLE IF NOT EXISTS campaign_angle_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  angle_name TEXT NOT NULL,
  hero_description TEXT,
  proof_description TEXT,
  cta_description TEXT,
  example_proof_points TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User custom voice templates (Pro tier)
CREATE TABLE IF NOT EXISTS user_custom_voices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  category TEXT,
  template_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Billing (Stripe integration — Phase 3)
CREATE TABLE IF NOT EXISTS billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT DEFAULT 'free',
  billing_cycle TEXT DEFAULT 'monthly',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_brand_dna_user_id ON brand_dna(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_published_posts_user_id ON published_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_published_posts_platform ON published_posts(platform);
CREATE INDEX IF NOT EXISTS idx_published_posts_published_at ON published_posts(user_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_post_id ON engagement_metrics(post_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_connected_accounts_user_id ON connected_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_prompts_user_id ON weekly_prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_prompts_answered ON weekly_prompts(user_id, answered);
CREATE INDEX IF NOT EXISTS idx_voice_marketplace_category ON voice_marketplace_entries(category);
CREATE INDEX IF NOT EXISTS idx_voice_marketplace_featured ON voice_marketplace_entries(is_featured, fork_count DESC);

-- ============================================================
-- ROW-LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE brand_dna ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE published_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE connected_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_custom_voices ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing ENABLE ROW LEVEL SECURITY;

-- brand_dna policies
DROP POLICY IF EXISTS "Users can view their brand_dna" ON brand_dna;
CREATE POLICY "Users can view their brand_dna"
  ON brand_dna FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their brand_dna" ON brand_dna;
CREATE POLICY "Users can insert their brand_dna"
  ON brand_dna FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their brand_dna" ON brand_dna;
CREATE POLICY "Users can update their brand_dna"
  ON brand_dna FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- campaigns policies
DROP POLICY IF EXISTS "Users can view their campaigns" ON campaigns;
CREATE POLICY "Users can view their campaigns"
  ON campaigns FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their campaigns" ON campaigns;
CREATE POLICY "Users can insert their campaigns"
  ON campaigns FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their campaigns" ON campaigns;
CREATE POLICY "Users can update their campaigns"
  ON campaigns FOR UPDATE USING (auth.uid() = user_id);

-- published_posts policies
DROP POLICY IF EXISTS "Users can view their published_posts" ON published_posts;
CREATE POLICY "Users can view their published_posts"
  ON published_posts FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their published_posts" ON published_posts;
CREATE POLICY "Users can insert their published_posts"
  ON published_posts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- connected_accounts: STRICT — users only see their own tokens
DROP POLICY IF EXISTS "Users can manage their connected_accounts" ON connected_accounts;
CREATE POLICY "Users can manage their connected_accounts"
  ON connected_accounts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- user_preferences
DROP POLICY IF EXISTS "Users can manage their preferences" ON user_preferences;
CREATE POLICY "Users can manage their preferences"
  ON user_preferences FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- voice_marketplace: public read
ALTER TABLE voice_marketplace_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view public marketplace voices" ON voice_marketplace_entries;
CREATE POLICY "Anyone can view public marketplace voices"
  ON voice_marketplace_entries FOR SELECT USING (is_public = TRUE);


-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Atomic fork count increment (called by marketplace_service.py)
CREATE OR REPLACE FUNCTION increment_fork_count(voice_id UUID)
RETURNS void AS $$
  UPDATE voice_marketplace_entries
  SET fork_count = fork_count + 1
  WHERE id = voice_id;
$$ LANGUAGE SQL SECURITY DEFINER;

-- ============================================================
-- SEED DATA: Voice Marketplace (10 starter voices)
-- ============================================================

INSERT INTO voice_marketplace_entries
  (creator_name, creator_bio, category, voice_personality, banned_concepts, primary_hex, is_featured)
VALUES
  (
    'Pieter Levels',
    'Solo founder, ships fast, lives nomadically. @levelsio',
    'indie_hacker',
    'Direct, no fluff. Single-sentence paragraphs. Numbers over adjectives. Anti-VC, pro-bootstrapped. Tweets technical progress in real time. No hustle culture language.',
    ARRAY['disruption','synergy','game-changer','pivot','scale','leverage'],
    '#1DA1F2',
    TRUE
  ),
  (
    'Alex Hormozi',
    'Gym launches → acquisition company. Author of $100M Offers.',
    'founder',
    'High-conviction. Uses frameworks and numbered lists. Long-form LinkedIn. Aggressive about value delivery. Contrarian on conventional business advice. Never hedges.',
    ARRAY['passive income','get rich quick','overnight success'],
    '#F97316',
    TRUE
  ),
  (
    'Shaan Puri',
    'Co-host My First Million. Serial entrepreneur.',
    'creator',
    'Storytelling-first. Hooks with a counterintuitive opening. Uses "here is the thing nobody is saying" pattern. Casual, witty, Twitter-native.',
    ARRAY['in conclusion','to summarize','in summary'],
    '#8B5CF6',
    TRUE
  ),
  (
    'Lenny Rachitsky',
    'Product growth expert. Newsletter with 600K+ subscribers.',
    'executive',
    'Data-backed. References specific companies and metrics. Structured: intro, 3 frameworks, key takeaway. Founder-friendly but enterprise-aware.',
    ARRAY['viral','explosive growth','hockey stick'],
    '#06B6D4',
    TRUE
  ),
  (
    'Justin Welsh',
    'Ex-SVP Sales → solopreneur. 500K LinkedIn followers.',
    'creator',
    'One big idea per post. LinkedIn-optimized formatting. Short punchy sentences. Opens with a pattern interrupt. Ends with a lesson, not a pitch.',
    ARRAY['hustle','grind','work-life balance'],
    '#EAFF00',
    TRUE
  ),
  (
    'Codie Sanchez',
    'Acquires boring businesses. Contrarian Cash newsletter.',
    'founder',
    'Financial precision. "Most people do X, smart people do Y." Repeats the same framework in new contexts. Uses data and dollar amounts. Pro main street, anti big tech.',
    ARRAY['passion','follow your dreams','do what you love'],
    '#EF4444',
    FALSE
  ),
  (
    'Naval Ravikant',
    'AngelList, investor, philosopher.',
    'executive',
    'Aphorism-first. Compressed wisdom. Never names competitors. Timeless over trendy. Uses "if you want X, do Y" structure. Minimum words, maximum insight.',
    ARRAY['ASAP','urgent','limited time'],
    '#6366F1',
    FALSE
  ),
  (
    'Amanda Natividad',
    'VP Marketing @SparkToro. Marketing scientist.',
    'creator',
    'Research-backed takes. Practical examples over theory. LinkedIn and Twitter native. Calls out bad marketing in the wild. Uses data to challenge intuition.',
    ARRAY['funnel','leads','conversion rate optimization'],
    '#EC4899',
    FALSE
  ),
  (
    'Wes Kao',
    'Maven co-founder. Expert on learning design and positioning.',
    'executive',
    'Frameworks for everything. Uses headers in LinkedIn posts. Educational without being condescending. Thread-friendly. Ends every post with a memorable one-liner.',
    ARRAY['best practices','industry standards','generally speaking'],
    '#14B8A6',
    FALSE
  ),
  (
    'Greg Isenberg',
    'Community-led growth investor. Late Checkout.',
    'founder',
    'Community-first mindset. Startup ideas in public. Enthusiastic, optimistic. Tweets trends and opportunities. High volume, fast take style.',
    ARRAY['moat','defensibility','barriers to entry'],
    '#F59E0B',
    FALSE
  )
ON CONFLICT DO NOTHING;
