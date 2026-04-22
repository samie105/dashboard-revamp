---
name: feature-suggest
description: Analyze an existing codebase to suggest new features, UX improvements, and marketing-driven enhancements based on what's already built. Use when user asks to suggest features, improve UX, find marketing opportunities, brainstorm product ideas, or wants to know what would make the platform better.
---

# Feature Suggest

## Quick Start

When triggered, ask the user for focus:

1. **Full platform** — scan everything and suggest across all areas
2. **Specific area** — focus on a feature, page, or user flow (e.g., onboarding, trading)
3. **Lens** — prioritize marketing, UX, retention, or monetization suggestions

Then run the relevant sections below. Present suggestions grouped by impact.

## Workflow

### 1. Understand What Exists

- [ ] Map all user-facing pages, flows, and features
- [ ] Identify the core value proposition and target users
- [ ] Note the current tech stack capabilities (real-time, notifications, etc.)
- [ ] Review existing UI patterns, components, and design system

### 2. UX & Usability Gaps (see [REFERENCE.md](REFERENCE.md#ux--usability))

- [ ] Audit onboarding — is the first-time experience smooth?
- [ ] Check for missing empty states, tooltips, or guided tours
- [ ] Identify friction points — too many clicks, confusing navigation
- [ ] Look for missing feedback — loading, success, error indicators
- [ ] Check mobile responsiveness and touch interactions
- [ ] Audit accessibility — keyboard nav, screen reader support, contrast
- [ ] Identify missing personalization or preference options

### 3. Marketing & Growth Features (see [REFERENCE.md](REFERENCE.md#marketing--growth))

- [ ] Check for referral/invite system
- [ ] Look for social sharing hooks (achievements, milestones)
- [ ] Identify gamification opportunities (streaks, badges, leaderboards)
- [ ] Check for email/push notification infrastructure
- [ ] Look for viral loops — features that naturally bring in new users
- [ ] Audit SEO — meta tags, OG images, structured data
- [ ] Check for analytics and conversion tracking

### 4. Retention & Engagement (see [REFERENCE.md](REFERENCE.md#retention--engagement))

- [ ] Look for re-engagement hooks (daily rewards, activity feed)
- [ ] Check for community features (chat, forums, social)
- [ ] Identify habit-forming loops in the product
- [ ] Audit the notification strategy — is it timely and relevant?
- [ ] Check for personalized dashboards or recommendations

### 5. Monetization Opportunities (see [REFERENCE.md](REFERENCE.md#monetization))

- [ ] Identify premium/pro feature tier opportunities
- [ ] Look for upsell points in existing flows
- [ ] Check for partnership or affiliate integration points
- [ ] Audit the pricing/plan presentation

## Output Format

```markdown
## Suggestions Summary
| Priority | Category      | Count |
|----------|---------------|-------|
| High     | UX            | X     |
| High     | Marketing     | X     |
| Medium   | Retention     | X     |
| Low      | Monetization  | X     |

## High Priority
### [H1] Feature Title
**Category**: UX / Marketing / Retention / Monetization
**What**: What to build and why users would want it
**Where**: Which existing pages/flows this touches
**Impact**: Expected effect on growth, engagement, or revenue
**Effort**: Low / Medium / High — brief justification

## Medium Priority
### [M1] ...

## Low Priority / Future Ideas
### [L1] ...
```

## Tips

- Compare against competitors — what do similar platforms offer?
- Think in user journeys: discover → sign up → first action → habit → refer
- Every page is a marketing surface — look for share, invite, and CTA gaps
- Small UX wins (micro-animations, better copy, smart defaults) compound fast
- Prioritize features that serve both the user AND growth (e.g., referrals)
