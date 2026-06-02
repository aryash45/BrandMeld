# BrandMeld — Information Architecture Redesign
### "Understandable in under 30 seconds"

**Audit date:** 2026-06-02  
**Auditor:** Antigravity  
**Status:** Design only — no implementation

---

## 1. Current-State Audit

### 1.1 Full Route & Screen Inventory

| Route | File | Status | Notes |
|---|---|---|---|
| `/` | `LandingPage.tsx` | ✅ Live | Public marketing page |
| `/onboarding` | `OnboardingWizard.tsx` | ✅ Live | 3-step brand scan wizard |
| `/dashboard` | `Dashboard.tsx` | ✅ Live | AI brief + metrics + priorities |
| `/content` | `Content.tsx` | ✅ Live | Simple generate+publish flow |
| `/campaigns` | `StubPages.tsx` → `CampaignsPage` | 💀 Dead stub | "Coming Soon" — links to `/content` |
| `/seo` | `StubPages.tsx` → `SEOPage` | 💀 Dead stub | "Coming Soon" — links to `/analytics` |
| `/analytics` | `Analytics.tsx` | ✅ Live | Charts + SEO keywords + content table |
| `/competitors` | `StubPages.tsx` → `CompetitorsPage` | 💀 Dead stub | "Coming Soon" — links to `/analytics` |
| `/ai-studio` | `StubPages.tsx` → `AIStudioPage` | 💀 Dead stub | "Coming Soon" — links to `/content` |
| `/automations` | `StubPages.tsx` → `AutomationsPage` | 💀 Dead stub | "Coming Soon" — links to `/content` |
| `/settings` | `SettingsPage.tsx` | ✅ Live | Minimal shell |
| **Orphan** | `DashboardPage.tsx` | ⚠️ Orphan | 432-line campaign creator — **not routed in App.tsx** |
| **Orphan** | `dashboard/DashboardHome.tsx` | ⚠️ Orphan | V2 home with weekly prompt — **not routed** |
| **Orphan** | `dashboard/CampaignCreate.tsx` | ⚠️ Orphan | Full campaign wizard — **not routed** |
| **Orphan** | `dashboard/Analytics.tsx` | ⚠️ Orphan | Duplicate of `/analytics` — **not routed** |
| **Orphan** | `dashboard/PublishedContent.tsx` | ⚠️ Orphan | Post history — **not routed** |
| **Orphan** | `marketplace/VoiceMarketplace.tsx` | ⚠️ Orphan | Voice fork UI — **not routed** |
| **Orphan** | `settings/AuthSettings.tsx` | ⚠️ Orphan | LinkedIn OAuth settings — **not routed** |
| **Redirect** | `/dashboard/home` | → `/dashboard` | Legacy redirect |
| **Redirect** | `/dashboard/create` | → `/content` | Legacy redirect |
| **Redirect** | `/history` | → `/dashboard` | Legacy redirect |
| **Redirect** | `/marketplace/*` | → `/ai-studio` | Points to dead stub |

### 1.2 Sidebar Navigation (Current)

```
⬡  Dashboard          ← works
✦  Content            ← works  
◈  Campaigns          ← DEAD STUB
◎  SEO                ← DEAD STUB
▸  Analytics          ← works
◇  Competitors        ← DEAD STUB
∿  AI Studio          ← DEAD STUB (AI Actions in sidebar point here)
⟳  Automations        ← DEAD STUB
   ─────────────
⚙  Settings           ← footer
```

**5 of 8 nav items are dead stubs.** A new user clicks 62% of the sidebar and gets "Coming Soon."

### 1.3 Problems Found

#### 🔴 Critical: Duplicate Screens (same job, multiple files)

| Duplicate Pair | Impact |
|---|---|
| `Dashboard.tsx` vs `DashboardPage.tsx` vs `dashboard/DashboardHome.tsx` | 3 files, 1 concept. None clearly "wins." `DashboardPage.tsx` is the most complete but is **orphaned** (not in router). |
| `Analytics.tsx` vs `dashboard/Analytics.tsx` | Two analytics views; one is routed, one is orphaned |
| `Content.tsx` vs `dashboard/CampaignCreate.tsx` | Both generate content. `Content.tsx` is simpler; `CampaignCreate.tsx` (the better V2 wizard) is orphaned |

#### 🔴 Critical: Feature-First Navigation (tool names, not outcome names)

The sidebar labels are tool names: "AI Studio," "Campaigns," "SEO," "Automations," "Competitors." A non-marketing founder doesn't know which one to click to **post something on LinkedIn** or **understand what's working**.

User questions vs current nav:
- *"I want to post something"* → which of Content / Campaigns / AI Studio / Automations?
- *"How's my content doing?"* → Analytics? SEO? Both?
- *"What should I post about?"* → Dashboard? Campaigns? AI Studio?

#### 🟡 Moderate: Dead Sidebar AI Actions

The sidebar has an "⚡ AI Actions" panel with 4 clickable items ("Generate 30-day content plan", "Fix declining SEO keywords", etc.) — **all navigate to `/ai-studio`, which is a "Coming Soon" stub.**

#### 🟡 Moderate: Confusing Entry Points for Core Workflow

The actual core workflow (Plan → Generate → Edit → Publish) is split across:
1. `DashboardPage.tsx` (best implementation, orphaned)
2. `Content.tsx` (simpler version, routed at `/content`)
3. `dashboard/CampaignCreate.tsx` (V2 version, orphaned)

A user who signs in goes to `/dashboard` and sees `Dashboard.tsx` — an AI daily brief with mock data and no way to actually **do** the core workflow without manually navigating to `/content`.

#### 🟡 Moderate: Voice Marketplace is Hidden

`marketplace/VoiceMarketplace.tsx` — the feature that lets you fork a founder's brand voice — is orphaned. The sidebar redirects `/marketplace/*` to the AI Studio stub. This is a differentiating feature that no one can find.

#### 🟢 Minor: Onboarding Collects Data That Isn't Used

The OnboardingWizard collects platforms (Twitter, LinkedIn, Instagram, YouTube, TikTok) and brand intelligence (voice, ICP, pillars). None of this data surfaces again in the routed app. The result: onboarding feels like a dead end.

---

## 2. Proposed Navigation Architecture

### 2.1 Design Principles

1. **Verb-first labels** — name what the user does, not the tool they use.
2. **Maximum 5 nav items** — cognitive load scales with nav length.
3. **Zero dead links** — if it's in the nav, it works.
4. **One core workflow** — Discover → Plan → Create → Publish → Learn. Every screen lives in exactly one step.
5. **Progressive disclosure** — advanced features (Voice Marketplace, Auth settings) live inside the relevant section, not as top-level nav.

### 2.2 New Navigation: 5 Items

```
🔭  Discover      ← "What should I talk about?" (was: Dashboard)
📐  Plan          ← "What angle should I take?" (was: Campaigns, AI Studio)
✦   Create        ← "Write and edit my drafts" (was: Content)
📤  Publish       ← "Send it and track it" (was: Campaigns, Automations)
📊  Learn         ← "What worked?" (was: Analytics, SEO, Competitors)
    ──────────────
⚙   Settings      ← footer (account, brand, connections)
```

### 2.3 Screen-to-Section Mapping

| New Section | Maps From (Old) | Key Content |
|---|---|---|
| **Discover** | `Dashboard.tsx` + `dashboard/DashboardHome.tsx` | AI Daily Brief, Weekly Prompt, "What to talk about today" |
| **Plan** | `DashboardPage.tsx` + `dashboard/CampaignCreate.tsx` | Brief input → AI angle planning → draft approval |
| **Create** | `Content.tsx` | Edit drafts, adjust tone, preview per platform |
| **Publish** | `dashboard/PublishedContent.tsx` + scheduling stub | One-click publish, schedule, copy to clipboard |
| **Learn** | `Analytics.tsx` + `dashboard/Analytics.tsx` | Performance charts, top posts, SEO keywords |
| **Settings** | `SettingsPage.tsx` + `settings/AuthSettings.tsx` | Brand DNA, connected accounts, preferences |

---

## 3. Full Sitemap

```
/                           Landing (public)
/onboarding                 Brand setup wizard

/discover                   ← NEW home route (replaces /dashboard)
  [inline section]          AI Daily Brief
  [inline section]          Weekly Prompt ("What changed this week?")
  [inline section]          Suggested topics (based on brand DNA)
  [inline section]          Quick stats (last 7 days)

/plan                       ← Was: /campaigns + DashboardPage.tsx
  [inline step 1]           Capture the signal (what changed, why it matters)
  [inline step 2]           Approve the angle (AI plan review)
  [inline step 3]           Select platforms + Generate

/create                     ← Was: /content
  [inline]                  Draft editor (tabs per platform)
  [inline]                  Tone toolbar (shorter, bolder, hook, casual...)
  [inline]                  Character count per platform
  [inline]                  Copy / Save draft

/publish                    ← NEW (replaces /automations + campaigns)
  [inline]                  Publish now (LinkedIn, Twitter intent)
  [inline]                  Schedule post (stored in Supabase)
  [inline]                  Published history + engagement preview
  /publish/history          All published posts

/learn                      ← Was: /analytics (absorbs /seo, /competitors)
  [inline tab]              Performance — impressions, engagement, trend
  [inline tab]              Content — top posts, what's working
  [inline tab]              Keywords — SEO rankings, opportunities
  [inline tab]              Audience — follower growth

/settings                   ← Was: /settings
  [inline tab]              Brand — DNA, voice, URL scanner
  [inline tab]              Connections — LinkedIn OAuth, Twitter
  [inline tab]              Voice Marketplace — browse + fork voices ← was orphaned
  [inline tab]              Preferences — prompt frequency, notifications
  [inline tab]              Account — billing, sign out
```

**Eliminated routes (dead stubs → delete):**
- `/seo` → merged into `/learn` (Keywords tab)
- `/competitors` → merged into `/learn` (future Competitors tab)
- `/ai-studio` → functionality belongs in `/plan` and `/create`
- `/automations` → scheduling belongs in `/publish`
- `/campaigns` → merged into `/plan`

---

## 4. User Journeys

### Journey 1: New User (First Day)
```
Landing → Sign Up → Onboarding Wizard
  (scan URL → brand voice detected)
  → Discover
    ├── sees AI brief: "Here's what to talk about today"
    ├── sees Weekly Prompt: "What changed this week?"
    └── clicks "Answer & Generate" → Plan
          ├── fills in brief (pre-filled from prompt)
          ├── AI generates angle
          ├── approves angle
          └── clicks "Generate Drafts" → Create
                ├── reviews drafts per platform
                ├── edits tone
                └── clicks "Publish" → Publish
                      └── posts or schedules → done
```

**Time to first post: ~5 minutes (target)**

### Journey 2: Returning User (Weekly Habit)
```
Sign in → Discover
  ├── reads AI brief (30 seconds)
  ├── sees new Weekly Prompt
  └── clicks "Start Campaign" → Plan → Create → Publish
```

**Time to post: ~3 minutes (known user)**

### Journey 3: Performance Check
```
Sign in → Learn
  ├── sees impressions chart (last 30 days)
  ├── clicks "Content" tab → sees top posts
  ├── sees "How we cut CAC by 40%" is underperforming
  └── clicks "Repurpose" → pre-fills Plan with the post as brief
```

### Journey 4: Voice Discovery
```
Sign in → Settings → Voice Marketplace
  ├── browses founders by category
  ├── clicks a voice to preview
  ├── clicks "Fork this voice"
  └── voice merges into their Brand DNA → active in Plan and Create
```

---

## 5. Page Hierarchy

```
Level 0 (Public)
└── / (Landing)

Level 1 (Onboarding — no chrome)
└── /onboarding

Level 1 (App — with sidebar)
├── /discover          PRIMARY home (replaces dashboard)
├── /plan              Core workflow step 1–2
├── /create            Core workflow step 3
├── /publish           Core workflow step 4
│   └── /publish/history
├── /learn             Insights hub
│   ├── ?tab=performance
│   ├── ?tab=content
│   ├── ?tab=keywords
│   └── ?tab=audience
└── /settings
    ├── ?tab=brand
    ├── ?tab=connections
    ├── ?tab=marketplace
    ├── ?tab=preferences
    └── ?tab=account
```

**Depth:** Max 2 levels. No nested dashboards.

---

## 6. Screens to Merge

| Merge Action | From | Into | Rationale |
|---|---|---|---|
| **Merge** | `Dashboard.tsx` + `dashboard/DashboardHome.tsx` | `/discover` (new) | Both are the "home" — take the best elements of each: AI brief from `Dashboard.tsx`, Weekly Prompt from `DashboardHome.tsx` |
| **Merge** | `DashboardPage.tsx` + `dashboard/CampaignCreate.tsx` | `/plan` | Both are the campaign planning workflow. `DashboardPage.tsx` is more complete — use as base, absorb V2 UI from `CampaignCreate.tsx` |
| **Merge** | `Analytics.tsx` + `dashboard/Analytics.tsx` | `/learn` | Single analytics view with tabs |
| **Merge** | `Content.tsx` | `/create` | Rename route only; keep the component, fix tone buttons to actually work |
| **Promote** | `dashboard/PublishedContent.tsx` | `/publish/history` | Currently orphaned — add to router under Publish |
| **Promote** | `marketplace/VoiceMarketplace.tsx` | `/settings?tab=marketplace` | Discoverable without top-level nav slot |
| **Promote** | `settings/AuthSettings.tsx` | `/settings?tab=connections` | Merge into Settings |

---

## 7. Screens to Delete

| File | Reason |
|---|---|
| `pages/StubPages.tsx` | Entire file is dead stubs. Replace with real pages or remove routes |
| Route `/campaigns` | Stub. Functionality absorbed by `/plan` |
| Route `/seo` | Stub. Functionality absorbed by `/learn?tab=keywords` |
| Route `/competitors` | Stub. Functionality absorbed by `/learn?tab=audience` (future) |
| Route `/ai-studio` | Stub. Functionality belongs in `/plan` (angle suggestions) and `/create` (tone editing) |
| Route `/automations` | Stub. Functionality belongs in `/publish` (scheduling) |
| Sidebar "⚡ AI Actions" panel | All 4 items link to `/ai-studio` (dead stub). Remove until the feature ships. |

---

## 8. Sidebar AI Actions Panel — Decision

The current sidebar has an "⚡ AI Actions" collapsible with 4 buttons that **all navigate to the dead `/ai-studio` stub**. Two options:

**Option A (Recommended) — Remove the panel entirely** until the features ship. Replace with a single "New Campaign" CTA button at the top of the sidebar.

**Option B — Wire to real destinations:**
| Action | Real destination |
|---|---|
| "Generate 30-day content plan" | `/plan` |
| "Fix declining SEO keywords" | `/learn?tab=keywords` |
| "Repurpose top-performing post" | `/plan` (pre-filled) |
| "Analyze competitor gaps" | `/learn?tab=audience` |

---

## 9. New Sidebar (Final)

```
┌─────────────────────┐
│  ●  BrandMeld   AI  │
├─────────────────────┤
│  [ + New Campaign ] │  ← CTA button, goes to /plan
├─────────────────────┤
│  🔭  Discover       │  ← /discover (home)
│  📐  Plan           │  ← /plan
│  ✦   Create         │  ← /create
│  📤  Publish        │  ← /publish
│  📊  Learn          │  ← /learn
├─────────────────────┤
│  ⚙   Settings       │  (footer)
│  [avatar] Name      │
│  Free plan   [→]    │
└─────────────────────┘
```

**Before:** 8 nav items (5 dead) + 4 dead AI actions = 9 of 12 clickable things don't work  
**After:** 5 nav items (all live) + 1 CTA = 6 of 6 clickable things work

---

## 10. 30-Second Mental Model

> **BrandMeld = "What happened in your product → social posts, automatically."**

The nav tells the story in order:

1. **Discover** — "What should I talk about today?" (AI brief + weekly prompt)
2. **Plan** — "What angle? What proof? Approved by me, written by AI."
3. **Create** — "Edit the drafts, adjust tone, pick platforms."
4. **Publish** — "Send it now or schedule it."
5. **Learn** — "Did it work? What should I do differently?"

A user who has never seen the product can read these five words and understand the flow — without reading any explanatory text.

---

## 11. Implementation Priority Order

> This section is informational. Implementation is out of scope for this document.

| Priority | Action | Effort |
|---|---|---|
| 🔴 P0 | Delete 5 dead stub routes from sidebar and router | XS |
| 🔴 P0 | Route `/discover` → wire `DashboardHome.tsx` + `Dashboard.tsx` merged | S |
| 🔴 P0 | Route `/plan` → wire `DashboardPage.tsx` (it's already the best implementation) | XS |
| 🔴 P0 | Remove sidebar AI Actions panel (or wire to real routes) | XS |
| 🟡 P1 | Route `/publish` → wire `PublishedContent.tsx` + publishing router | S |
| 🟡 P1 | Route `/learn` with tabs → merge both Analytics pages | S |
| 🟡 P1 | Route `/settings?tab=connections` → wire `AuthSettings.tsx` | XS |
| 🟡 P1 | Route `/settings?tab=marketplace` → wire `VoiceMarketplace.tsx` | XS |
| 🟢 P2 | Merge `Content.tsx` into `/create` with working tone buttons | M |
| 🟢 P2 | Onboarding → surfaced brand DNA in Discover and Plan | M |
