# Feature Suggest — Reference Checklists

Detailed patterns and opportunities to evaluate during each suggestion phase.

## UX & Usability

### Onboarding & First-Time Experience

| Check | Question |
|-------|----------|
| Welcome flow | Is there a guided setup or tutorial for new users? |
| Progressive disclosure | Are advanced features hidden until the user is ready? |
| Smart defaults | Are forms and settings pre-filled with sensible defaults? |
| Empty states | Do empty pages explain what goes there and how to start? |
| Quick win | Can the user accomplish something meaningful in under 2 minutes? |
| Trust signals | Are there security badges, testimonials, or social proof? |

### Navigation & Information Architecture

- [ ] Can users reach any core feature in 3 clicks or fewer?
- [ ] Is the navigation consistent across mobile and desktop?
- [ ] Are breadcrumbs or back-navigation clear?
- [ ] Is search available and does it cover all content types?
- [ ] Are related features grouped logically?
- [ ] Is there a command palette or keyboard shortcut system?

### Feedback & Micro-interactions

- [ ] Do buttons show loading state during async operations?
- [ ] Are success actions confirmed with clear feedback (toast, animation)?
- [ ] Are errors specific and actionable ("Email already taken" vs "Error")?
- [ ] Do forms validate inline (not just on submit)?
- [ ] Are destructive actions confirmed with a clear warning?
- [ ] Do long processes show progress bars (not just spinners)?

### Personalization

- [ ] Can users customize their dashboard layout?
- [ ] Are there theme options (dark/light, accent colors)?
- [ ] Can users set notification preferences?
- [ ] Are recently used or favorited items surfaced?
- [ ] Is the UI language localizable?
- [ ] Can users set their preferred currency/units?

---

## Marketing & Growth

### Referral & Viral Mechanics

| Feature | Description |
|---------|-------------|
| Referral program | Unique invite links with tracked rewards |
| Share achievements | Social cards for milestones (first trade, profit, etc.) |
| Invite friends CTA | Contextual prompts at high-engagement moments |
| Social proof | "X users joined today" or activity feeds |
| Embeddable widgets | Portfolio badges, price tickers for external sites |

### SEO & Discoverability

- [ ] Are pages server-rendered or statically generated for SEO?
- [ ] Do pages have unique, descriptive `<title>` and `<meta description>`?
- [ ] Are Open Graph images generated for shared links?
- [ ] Is there structured data (JSON-LD) for rich search results?
- [ ] Are public pages (pricing, features, blog) properly indexed?
- [ ] Is there a sitemap.xml and robots.txt?
- [ ] Are URLs clean and descriptive (not hash-based)?

### Content & Education

- [ ] Is there a blog or knowledge base?
- [ ] Are there in-app tutorials or walkthroughs?
- [ ] Are complex features explained with tooltips or info modals?
- [ ] Is there a changelog or "what's new" section?
- [ ] Are there video tutorials or interactive demos?

### Social & Community

- [ ] Is there a public activity feed or leaderboard?
- [ ] Can users follow or connect with each other?
- [ ] Are there community channels (Discord, Telegram) linked?
- [ ] Can users share strategies, portfolios, or watchlists?
- [ ] Is there a copy-trading or social trading feature?

---

## Retention & Engagement

### Habit Formation

| Hook | Implementation |
|------|---------------|
| Daily reward | Login bonus, daily free signal, streak tracker |
| Progress tracking | XP bars, level badges, milestone celebrations |
| Streaks | Consecutive login/trade streaks with visual indicators |
| Notifications | Smart alerts: price targets, portfolio changes, friend activity |
| Personalized feed | Relevant content based on user's holdings/interests |

### Re-engagement Triggers

- [ ] Are there email campaigns for inactive users?
- [ ] Do push notifications bring users back for relevant events?
- [ ] Are there "you missed" summaries (weekly portfolio recap)?
- [ ] Are price alerts or watchlist notifications implemented?
- [ ] Is there a "recommended for you" section?

### Community & Social Features

- [ ] Can users comment on or react to trades/posts?
- [ ] Is there a leaderboard (daily, weekly, all-time)?
- [ ] Can users create and share watchlists?
- [ ] Are there trading competitions or challenges?
- [ ] Is there a reputation or trust score system?

### Stickiness Features

- [ ] Portfolio tracking that users check daily
- [ ] Custom alerts and watchlists users don't want to lose
- [ ] Transaction history and tax reporting they need
- [ ] Earned rewards, badges, or status they've invested in
- [ ] Social connections and followers they've built

---

## Monetization

### Freemium / Premium Split

| Feature area | Free tier | Premium tier |
|-------------|-----------|-------------|
| Trading | Basic orders | Advanced order types, lower fees |
| Analytics | Basic charts | Pro charts, indicators, signals |
| Alerts | Limited alerts | Unlimited, SMS/push |
| API Access | Read-only | Full trading API |
| Support | Community/email | Priority/live chat |

### Revenue Opportunities

- [ ] Transaction fee optimization (tiered by volume)
- [ ] Premium subscription for advanced features
- [ ] Sponsored content or featured tokens
- [ ] API access for developers/bots
- [ ] White-label or B2B partnerships
- [ ] NFT minting or marketplace fees
- [ ] Staking or yield product fees

### Upsell Touchpoints

- [ ] When user hits a free tier limit — show upgrade CTA
- [ ] After a successful trade — suggest premium analytics
- [ ] On portfolio growth milestones — offer advanced tools
- [ ] During onboarding — highlight premium path
- [ ] In reports/exports — watermark vs clean for premium
