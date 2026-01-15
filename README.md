# FuelRx

**"Your week of food, figured out."**

FuelRx is a planning-first convenience app that takes the mental load out of eating well. We help CrossFit athletes answer one question each week: *"What should I buy and cook to fuel my training?"* — with AI-generated plans refined by a community of real athletes sharing what actually works.

Then, if you want to track, we make it stupidly easy. No manual entry, no searching databases — just confirm what you already planned to eat.

---

# 📑 Table of Contents

<!-- TOC_START -->
- [FuelRx](#fuelrx)
- [📑 Table of Contents](#-table-of-contents)
- [Core Philosophy](#core-philosophy)
- [The Core Loop](#the-core-loop)
- [The Pitch](#the-pitch)
- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
  - [Frontend](#frontend)
  - [Backend](#backend)
  - [AI/ML](#aiml)
  - [Hosting \& Deployment](#hosting--deployment)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Installation](#installation)
  - [Database Setup](#database-setup)
  - [Inngest Production Setup](#inngest-production-setup)
  - [Ingest Developer Setup](#ingest-developer-setup)
  - [Email Notification System](#email-notification-system)
    - [Setup](#setup)
    - [How It Works](#how-it-works)
    - [Testing Locally](#testing-locally)
- [Developer Tips](#developer-tips)
- [Native App](#native-app)
  - [Developer Notes](#developer-notes)
  - [App Icons](#app-icons)
  - [App Store Preparation](#app-store-preparation)
  - [Legal Pages](#legal-pages)
  - [Before App Store Submission](#before-app-store-submission)
- [Project Structure](#project-structure)
- [Deployment](#deployment)
  - [Deploy to Vercel](#deploy-to-vercel)
- [Features](#features-1)
  - [Weekly Meal Plan Generation](#weekly-meal-plan-generation)
  - [Quick Meals](#quick-meals)
  - [Logging](#logging)
    - [Barcode Scanning](#barcode-scanning)
    - [Snap a Picture](#snap-a-picture)
- [Feature Roadmap](#feature-roadmap)
  - [🔧 Meal Plan Quality Improvements](#-meal-plan-quality-improvements)
  - [⚡ Convenience Features](#-convenience-features)
  - [📸 Photo Capture ("Snap a Meal")](#-photo-capture-snap-a-meal)
  - [✅ Frictionless Tracking (Optional)](#-frictionless-tracking-optional)
  - [👥 Community Features](#-community-features)
  - [Priority Order (Suggested)](#priority-order-suggested)
- [What We're NOT Building](#what-were-not-building)
- [Success Metrics](#success-metrics)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)
<!-- TOC_END -->

---

# Core Philosophy

- **Plan first, track second** — Weekly planning is the foundation; tracking is optional convenience
- **Convenience over compliance** — Make healthy eating the path of least resistance
- **No manual entry hell** — FuelRx already knows what you planned; one tap to confirm you ate it
- **Community as cookbook** — Other athletes' real meals make your planning easier
- **Guilt-free defaults** — Generate, shop, eat. Track only if it helps you.

---

# The Core Loop

```
Generate Plan → Shop → Prep → Eat → [Optional: One-Tap Track] → Repeat
```

Every feature should make this loop faster, easier, or more enjoyable.

---

# The Pitch

> FuelRx gives CrossFit athletes a meal plan, a grocery list, and a prep game plan — powered by AI and refined by a community of athletes who eat like you.
>
> If you want to track your macros, we already know what you planned to eat. One tap confirms it. No manual entry, no friction, no guilt.

---

# Overview

FuelRx helps CrossFit athletes take the guesswork out of nutrition. Answer a few questions about your macro targets and preferences, and get a full week of meal plans designed to fuel your training—complete with recipes, macro breakdowns, and grocery lists.

Built for athletes who know nutrition matters but struggle with meal planning and prep due to time constraints or decision fatigue.

# Features

- **Personalized Macro Targeting**: Input your specific protein, carb, fat, and calorie goals
- **AI-Generated Meal Plans**: Weekly meal plans created using Claude AI based on your preferences
- **Dietary Flexibility**: Support for various dietary preferences ("No restrictions", "Paleo", "Vegetarian", "Gluten-free" and "Dairy-free")
- **Only Healthy Meals**: Only recommends/generates healthy and non-processed or minimally processed foods for users
- **Prep Time Optimization**: Meals tailored to your available prep time (options: 5min, 15min, 30min, 45min, 60min)
- **Auto-Generated Grocery Lists**: Shop efficiently with categorized ingredient lists
- **WOD-Aware Nutrition** (planned): Adjust meals based on workout intensity

# Tech Stack

## Frontend
- **Next.js** - React framework with server-side rendering, routing, and optimized deployment
- **React** - Component-based UI library
- **Tailwind CSS** - Utility-first CSS framework for styling
- **TypeScript** - Type-safe JavaScript for better developer experience

## Backend
- **Supabase** (Free Tier)
  - PostgreSQL database (500MB storage)
  - Built-in authentication
  - Row Level Security (RLS) for data protection
  - Real-time subscriptions
  - 1GB file storage, 2GB bandwidth/month

## AI/ML
- **Claude API** (Anthropic)
  - Generates personalized meal plans
  - Pay-as-you-go pricing (~$3 per million input tokens)
  - Powered by Claude Sonnet for optimal cost/performance

## Hosting & Deployment
- **Vercel** (Free Tier)
  - Automatic deployments from Git
  - Edge network for fast global delivery
  - 100GB bandwidth/month
  - Built-in CI/CD

# Getting Started

## Prerequisites
- Node.js 18+ and npm/yarn
- Supabase account
- Anthropic API key for Claude
- Vercel account (for deployment)

## Environment Variables

Create a `.env` file in the root directory and add the following environment variables (except the `INNGEST` ones).

Add these environment variables in Vercel Project Settings > Environment Variables:

| Variable | Description | Where to Get It |
|----------|-------------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase Dashboard > Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key | Supabase Dashboard > Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) | Supabase Dashboard > Settings > API |
| `ANTHROPIC_API_KEY` | Claude API key | https://console.anthropic.com |
| `INNGEST_EVENT_KEY` | Inngest event key | Inngest Dashboard > App Settings |
| `INNGEST_SIGNING_KEY` | Inngest signing key | Inngest Dashboard > App Settings |

## Installation

```bash
# Clone the repository
git clone https://github.com/sarahdorich/fuel-rx.git
cd fuel-rx

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Database Setup

Run the SQL migrations in your Supabase project (see `/supabase/migrations` folder).

For local development, we use the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started?queryGroups=platform&platform=macos).

Install the supabase cli:
```bash
brew install supabase/tap/supabase
brew upgrade supabase
```

Initialize supabase:
```bash
supabase init
```

Login to supabase:
```bash
supabase login
```

Link your project:
```bash
supabase link --project-ref <supabase_project_id>
```

Install [Docker Desktop](https://docs.docker.com/desktop/).

Check migration status with:
```bash
supabase migration list --linked
```

Pull existing schema from supabase:
```bash
supabase db pull
```

If you get errors from above, it's because you ran some migrations manually. To tell supabase these migrations have already been applied, just run the following for each migration file:
```bash
supabase migration repair --status applied 0001
```

List migrations that have been applied:
```bash
supabase migration list
```

Start you local supabase:
```bash
supabase start
```

You can always run the following to retrieve local supabase credentials:
```bash
supabase status
```

Use the keys that get outputted to update .env.development.local as well as .env.

Go to this URL to access your local supabase: http://127.0.0.1:54323

Run this to start the application using your local setup: `npm run dev`

You can view your local supabase instance here: http://127.0.0.1:54333/

To add a new migration file:
```bash
supabase migration new <description>
```

To run new migrations locally:
```bash
supabase migration up
```

To totally reset (recreate) your local database, run this:
```bash
supabase db reset
```

## Inngest Production Setup

Inngest handles background jobs (meal plan generation) in production:

1. **Create Inngest Account**: Sign up at https://app.inngest.com
2. **Connect to Vercel**:
   - In Inngest dashboard, go to Settings > Integrations
   - Click "Connect to Vercel" and authorize
   - Select your FuelRx project
3. **Sync Your App**:
   - After deploying to Vercel, Inngest automatically discovers your `/api/inngest` endpoint
   - Your functions appear in the Inngest dashboard
4. **Get API Keys**:
   - Go to Inngest Dashboard > Your App > Settings
   - Copy `Event Key` and `Signing Key`
   - Add them to Vercel environment variables (see table above)
5. **Redeploy**: Trigger a new Vercel deployment to pick up the new env vars

## Ingest Developer Setup

You should just be able to start Next.js then in another terminal, start Inngest locally.

1. `npm run dev`

2. `npx inngest-cli@latest dev -u http://localhost:3000/api/inngest --no-discovery`

## Email Notification System

FuelRx sends email notifications when meal plan generation completes, so users can close the browser and come back later. We use [Resend](https://resend.com) for email delivery.

### Setup

1. **Create Resend Account**: Sign up at https://resend.com (free tier: 3,000 emails/month)

2. **Get API Key**:
   - Go to Resend Dashboard > API Keys
   - Create a new API key
   - Copy the key (starts with `re_`)

3. **Verify Sending Domain** (for production):
   - Go to Resend Dashboard > Domains
   - Add your domain and follow DNS verification steps
   - For development, you can use Resend's test domain (`onboarding@resend.dev`)

4. **Add Environment Variables**:
   ```bash
   # .env or .env.local
   RESEND_API_KEY=re_xxxxx
   RESEND_FROM_EMAIL=notifications@yourdomain.com
   NEXT_PUBLIC_APP_URL=https://your-app-url.com
   ```

5. **Add to Vercel** (for production):
   - Go to Vercel Project Settings > Environment Variables
   - Add the same variables above

### How It Works

- When a meal plan finishes generating, the Inngest function sends an email via `src/lib/email/resend.ts`
- If `RESEND_API_KEY` is not configured, emails are silently skipped (no errors)
- Email includes a direct link to view the completed meal plan

### Testing Locally

Without Resend configured, you'll see this in the console:
```
[Email] Skipping email - RESEND_API_KEY not configured
```

To test actual email delivery locally, add your Resend API key to `.env.local`.

# Developer Tips

Sometimes Next.js dev server experiences cache issues. If you all of a sudden start encountering many errors, follow these steps:
1. Stop the dev server
2. Run rm -rf .next
3. Run npm run dev again

# Native App

## Developer Notes

Make sure you install xcode from the Apple App Store.

Testing Guide: docs/MOBILE_TESTING.md

```bash
# 1. Build for mobile
npm run build:mobile

# 2. Open Xcode
npm run cap:open:ios
# OR npx cap open ios

# 3. In Xcode:
#    - Select "iPhone 15 Pro" simulator
#    - Press ⌘R to build and run
```

**Running with local development server**

Get your local ip address:
```bash
ipconfig getifaddr en0
```

Then set the environment variable and sync:
```bash
CAPACITOR_SERVER_URL=http://<ip_address>:3000 npx cap sync ios
```

Now, start your Next.js dev server and point Capacitor to it.

Build the Next.js app (creates the 'out' directory):
```bash
npm run build
```

Start the dev server:
```bash
npm run dev
```

Sync to ios:
```bash
npx cap sync ios
```

Then in Xcode:
1. Clean the build (Product → Clean Build Folder, or ⌘+Shift+K)
2. Rebuild and run the app (⌘+R)

## App Icons

We have a couple scripts to help generate app icons:

1. scripts/generate-app-icons.sh: Generates all required icon sizes from a source image
2. scripts/create-placeholder-icon.sh: Creates a simple placeholder icon for testing

To use:

Make sure you install ImageMagick: `brew install imagemagick`

```bash
# Option 1: Create a placeholder icon for testing
./scripts/create-placeholder-icon.sh
./scripts/generate-app-icons.sh scripts/assets/app-icon-source.png

# Option 2: Use your own 1024x1024 icon
./scripts/generate-app-icons.sh path/to/your-icon.png
```

## App Store Preparation

app-store/metadata.md contains:
- App name, subtitle, description
- Keywords for discoverability
- Categories and age rating
- Screenshot requirements
- Review notes for Apple

## Legal Pages

Privacy Policy: /privacy

Terms of Service: /terms

Support: /support

## Before App Store Submission

1. **Create your app icon** (1024x1024 PNG, no transparency)
2. **Generate icon sizes**: `./scripts/generate-app-icons.sh your-icon.png`
3. **Take screenshots** on iPhone 15 Pro Max and iPad Pro
4. **Test on physical device** (camera, haptics, push notifications)
5. **Beta test via TestFlight**
6. **Submit for review** via App Store Connect

# Project Structure

```
fuel-rx/
├── app/                    # Next.js app directory
│   ├── page.tsx           # Home page
│   ├── onboarding/        # User onboarding flow
│   ├── meal-plan/         # Meal plan display
│   └── grocery-list/      # Shopping list
├── components/            # Reusable React components
├── lib/                   # Utility functions
│   ├── supabase.ts       # Supabase client
│   ├── claude.ts         # Claude API integration
│   └── types.ts          # TypeScript types
├── public/               # Static assets
├── supabase/             # Database migrations
└── styles/               # Global styles
```

# Deployment

## Deploy to Vercel

1. Push your code to GitHub
2. Import project in Vercel dashboard
3. Add environment variables in Vercel project settings
4. Deploy automatically on push to main branch

```bash
# Or use Vercel CLI
npm install -g vercel
vercel
```

# Features

## Weekly Meal Plan Generation

## Quick Meals

## Logging

To make FuelRx a one-stop shop, you can log what you actually eat in the app. There are a few ways to log.

1. Add ingredients manually
2. Barcode scanning
3. Snap a picture

### Barcode Scanning

The barcode scanning feature allows users to quickly add food items by scanning product barcodes.

**Scanner UI**

Uses the ZXing library for real-time barcode detection via the device camera. Supports EAN-13, EAN-8, UPC-A, UPC-E, CODE-128, and CODE-39 formats. Includes a manual entry fallback when camera access is unavailable.

**Lookup Process**

Uses a tiered fallback strategy: Database lookup (fastest) → Open Food Facts API → FatSecret API → Not found. The database is checked first to avoid repeated external API calls for the same product.

**Results Display**

When a barcode is found, displays the product image, name, brand, and nutrition info (calories, protein, carbs, fat). Users can "Scan Again" or "Add & Log" the item.

**Database Storage**

When saved, creates an ingredient with `is_user_added: true` and stores nutrition with `source: 'barcode_scan'`. The barcode is persisted for future lookups.

### Snap a Picture

The Snap a Picture feature lets users photograph their meals for AI-powered nutritional analysis.

**How It Works**

Users take a photo or select from their gallery. The image is compressed client-side (1200x1200 max, 80% quality JPEG) to reduce storage and bandwidth, then uploaded to a private Supabase Storage bucket. The API generates signed URLs for secure, time-limited access to photos.

**AI Analysis**

Photos are analyzed using Claude Sonnet 4 (`claude-sonnet-4-20250514`) with vision capabilities. The model identifies individual ingredients, estimates portion sizes based on visual cues (plate size, utensils), and calculates macros using USDA FoodData Central guidelines. Portion estimates are calibrated for CrossFit athletes (4-8oz protein servings, 1-2 cups vegetables). Each ingredient receives a confidence score (0-1) indicating how certain the model is about the identification.

**Review and Save**

After analysis, users review the AI-generated results and can edit meal names, adjust ingredient quantities, or add/remove items. The meal can be logged to daily consumption, saved to the My Meals library, or both.


# Feature Roadmap

## 🔧 Meal Plan Quality Improvements

**Extended Meal Memory**
- Track meal names from the last 3-4 weeks (not just 1 week)
- Pass to LLM as exclusion list to prevent repetition
- Solves: "FuelRx keeps suggesting the same meals"

**Variety Anchors in Prompts**
- Instruct LLM to use 3+ different protein sources per week
- Require 2+ cuisine styles (Mediterranean, Asian, Mexican, etc.)
- Add seasonal hints based on current month

**Ingredient-Efficient Meal Generation**
- New user preference: "Optimize for simpler shopping"
- When enabled, LLM designs meals around shared anchor ingredients:
  - 2-3 core proteins (chicken breast, ground beef, salmon)
  - 4-5 versatile vegetables (broccoli, bell peppers, spinach, sweet potatoes)
- Meals vary in preparation but share base ingredients
- Solves: "The grocery list is too long"

**Leftover Intelligence**
- LLM considers multi-serving meals when planning
- "Tuesday's grilled chicken makes Wednesday's lunch salad"
- Reduces cooking sessions and waste

**WOD-Meal Pairing**
- User inputs weekly training schedule (no gym app integration needed but could be cool to integrate with PushPress's API)
- For each day: workout type (rest, light, moderate, heavy, intense) and time (morning, midday, evening)
- LLM adjusts meals based on training:
  - Rest days: Lower carbs, anti-inflammatory foods
  - Heavy/strength days: Higher protein emphasis
  - Intense days: Prioritize carbs, especially around workout
- Meal timing adapts to workout time:
  - Morning WOD → lighter breakfast, substantial post-workout meal
  - Evening WOD → lunch as pre-fuel, dinner focused on recovery
- Start with manual input; gym app integration (PushPress, etc.) possible later
- Differentiator: No other meal app does this well for CrossFit

---

## ⚡ Convenience Features

**Meal Prep Mode**
- Transform 21 separate meals into a structured prep plan
- "Sunday Prep Session" view showing:
  - What to batch cook
  - Estimated total time
  - Which meals each prep item feeds
- Daily view shows assembly only, not full cooking
- High-impact differentiator

**Quick Swap**
- One tap on any meal shows 3 alternatives with similar macros
- No regenerating the whole plan
- Keeps plans flexible when life changes

**Ingredient Substitution**
- "Out of salmon?" → "Swap for cod, chicken thigh, or canned tuna"
- Prevents missing ingredients from derailing the plan
- LLM-powered, feels like magic

**Costco Mode**
- Leverage your inventory scraper
- "Optimize my plan for what's available at Costco"
- Match meals to actual products at user's local warehouse
- Nobody else does this — genuine differentiator

**One-Click Grocery Export**
- Export to Instacart, Amazon Fresh, Walmart
- Or clean shareable list for texting
- Fewer steps between plan and groceries in kitchen

---

## 📸 Photo Capture ("Snap a Meal")

**The Flow**
1. User takes photo of a meal they made
2. Claude Vision analyzes and identifies:
   - Suggested meal name
   - Visible ingredients with estimated portions
   - Estimated macros
3. User reviews, tweaks if needed, saves
4. Optional: Share with community

**Smart Matching**
- After analysis, search existing database for similar meals
- "This looks like Community Member's Teriyaki Bowl — use those verified macros?"
- Turns photo into search tool, not just estimation

**Low-Friction Capture**
- "Meal Memory" — snap without committing
- Review at week's end: "Add any of these to saved meals?"
- Builds personal cookbook over time with zero effort

---

## ✅ Frictionless Tracking (Optional)

**One-Tap Logging**
- FuelRx already knows what you planned to eat
- Meal card shows: "Did you eat this? ✓"
- One tap = logged with accurate macros
- No searching, no manual entry, no friction

**Smart Adjustments**
- "Ate this but only 75% of it" → Adjust portions
- "Swapped chicken for salmon" → Update protein source
- Still one tap, just with minor tweaks

**Historical Trends**
- Natural side effect of one-tap logging
- See weekly/monthly macro adherence
- "You hit your protein target 6/7 days this week"
- Charts show trends, not daily guilt

**MyFitnessPal Migration**
- One-time import of historical data
- Brings over past macro trends so you don't lose history
- Discontinue MFP entirely, track in FuelRx going forward
- Framing: "Stop manually logging. FuelRx already knows your meals."

---

## 👥 Community Features

**Guiding Principle**: Community as a smart recipe database, not a social network. Users benefit from collective wisdom without social pressure.

**Passive Quality Signals**
- Track when users keep vs. swap meals (no explicit rating needed)
- Powers "Most-kept meals" and "Fan favorites"
- Quality emerges from usage, not voting

**Taste Twins**
- Match users with similar macros, dietary prefs, and swap patterns
- "Athletes like you loved these meals"
- No following required — quiet algorithmic matching

**Browse by Problem**
- Replace endless feed with practical search:
  - "I have 20 minutes"
  - "I need to use chicken thighs"
  - "Big batch Sunday prep"
  - "Eating same lunch all week"
  - "Something different"
- Community feels like organized cookbook

**One-Tap Plan Integration**
- "Add to Next Week" — slot community meal into your plan
- AI rebalances macros and updates grocery list automatically
- "Replace All My Breakfasts" — lock in a community meal as default
- "Steal This Week" — clone another athlete's full plan as starting point

**Curated Collections**
- "Coach Hillari's Favorites" — permanent collection adding personality
- Guest collections from coaches or respected athletes
- "FuelRx Verified" badge for macro-accurate community favorites

**Contribution Without Pressure**
- "Your meal helped 43 athletes this week" — warm feedback
- Recipe remixes saved when users tweak community meals
- Contributing feels rewarding but is never required

---

## Priority Order (Suggested)

| Phase | Features | Impact | Rationale |
|-------|----------|--------|-----------|
| 1 | Extended meal memory, Ingredient-efficient generation | Fix current pain points | Quality must be solid before adding features |
| 2 | One-tap tracking, MFP migration | Reduce friction vs. competitors | Keep users from needing two apps |
| 3 | Meal Prep Mode | Major differentiator | CrossFit athletes batch cook on Sundays |
| 4 | Quick Swap, Ingredient Substitution | Daily convenience | Life happens, plans change |
| 5 | Snap a Meal (photo capture) | Frictionless meal saving | Build library passively |
| 6 | Browse by Problem, One-tap plan integration | Community becomes useful | Network effects kick in |
| 7 | Costco Mode, Grocery export | Shopping convenience | Final polish on the core loop |
| 8 | Passive quality signals, Taste Twins | Smart recommendations | Data-driven improvements |

---

# What We're NOT Building

**We avoid features that create guilt, friction, or daily obligation:**

- **Mandatory daily logging** — Tracking is optional convenience, not required
- **Streak tracking or gamification** — No guilt for missing days
- **Manual calorie counting** — If it's not one-tap easy, we don't do it
- **Social feeds requiring engagement** — Community without pressure
- **Manual ingredient searches** — FuelRx already knows what's in your meals
- **Daily app opens as requirement** — Open weekly to plan, optionally daily to track

**The test**: Does this feature make the "Generate → Shop → Prep → Eat → Repeat" loop easier? If no, we don't build it.

---

# Success Metrics

**Planning metrics (primary):**
- **Weekly active plan generation** — Users creating meal plans
- **Grocery list exports** — Plans converting to shopping
- **Swap rate** — Lower = better meal quality
- **Community meal additions** — Plans enriched by community
- **Time to plan** — Getting faster over time

**Tracking metrics (secondary, only for users who opt in):**
- **One-tap log rate** — % of planned meals confirmed with single tap
- **Manual entry rate** — Should be near zero (if high, we failed at convenience)
- **Tracking adherence** — Users who start tracking and keep doing it
- **MFP churn** — Users who discontinue MFP after migrating to FuelRx

---

# Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

# License

MIT License - see LICENSE file for details

# Contact

For questions or feedback, please open an issue on GitHub.

---

*Built with ❤️ for athletes who'd rather lift than meal plan.*
