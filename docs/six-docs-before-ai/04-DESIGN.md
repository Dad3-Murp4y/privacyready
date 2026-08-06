# DESIGN — Design Brief

> A clear guide to the visual direction of PrivacyReady

- Consistent look & feel across marketing + portal
- Defined colors & typography
- Reusable components
- Screen style guidance
- Better AI/agent results — no random palettes

---

## Look & feel

**Brand personality:** Trustworthy UK compliance product — navy authority, calm sky accents, warm lotus highlight. Professional, not neon SaaS.

**Marketing site:** Light cream content sections over deep navy heroes; serif display headlines (Fraunces) + Thai/Latin-friendly body (Anuphan / Noto Sans). Editorial, confident.

**Portal:** Dark glassmorphism dashboard — navy surfaces, translucent cards, sky interactive accents, lotus sparingly for warmth. Ambient radial glows (restrained). Metric cards, soft borders, 20–24px radii.

Do **not** introduce purple-on-white, terracotta-cream newspaper layouts, or neon cyan/violet themes — the portal was intentionally retinted away from those.

---

## Color palette

### Marketing (`frontend/styles.css`)

| Token | Hex | Use |
|-------|-----|-----|
| `--navy` | `#0B2447` | Primary brand / headers / theme-color |
| `--navy2` | `#19376D` | Secondary navy surfaces |
| `--mid` | `#576CBC` | Mid accents |
| `--sky` | `#A5D7E8` | Links, highlights, CTAs on dark |
| `--lotus` | `#E8C5A0` | Warm accent |
| `--cream` | `#F0F8FF` | Light section backgrounds |
| `--white` | `#FFFFFF` | Text on dark / cards |
| `--ink` | `#0B2447` | Body text on light |
| `--danger` | `#C0392B` | Fail / critical |
| `--warning` | `#E67E22` | Medium risk |
| `--success` | `#27AE60` | Pass / healthy |

### Portal (`frontend/portal/src/index.css`)

| Token | Hex | Use |
|-------|-----|-----|
| `--navy` | `#0A1628` | App background |
| `--mid` | `#142238` | Elevated surfaces |
| `--mid-light` | `#1C2E4A` | Hover / secondary panels |
| `--sky` | `#6C8FD8` | Primary interactive |
| `--sky-hover` | `#4A67B0` | Hover |
| `--accent` | `#E8C5A0` | Lotus accent |
| `--text-primary` | `#F8FAFC` | Headings / body |
| `--text-secondary` | `#94A3B8` | Muted labels |
| `--text-tertiary` | `#64748B` | Hints |
| `--success` / `--warning` / `--danger` | `#27AE60` / `#E67E22` / `#C0392B` | Status (aligned with marketing) |
| Glass | `rgba(20,34,56,0.65)` + border `rgba(255,255,255,0.08)` | Cards / sidebar |

Maintenance banner: `#d97706` on white text.

---

## Typography

### Marketing
| Role | Family | Notes |
|------|--------|-------|
| Display / logo / heroes | **Fraunces** (serif) | Expressive headlines |
| Body / UI | **Anuphan**, **Noto Sans** | Multilingual (EN/TH/RU marketing) |
| Mono / scores | **DM Mono** | Scan scores, technical snippets |

### Portal
| Role | Token / family | Guidance |
|------|----------------|----------|
| Headings | `--font-heading`: **Outfit** | ~32–36px page titles, -0.02em tracking |
| Body | `--font-sans`: **Inter** | 14–16px |
| Mono / clocks | `--font-mono`: **DM Mono** | Live time, IDs |

Suggested scale (portal):
- H1 / page title ≈ 36px bold
- Auth title ≈ 32px
- H2 / empty-title ≈ 20px semibold
- Body ≈ 15–16px
- Labels ≈ 12px uppercase tracked
- Secondary ≈ 13–14px

---

## Components

### Buttons
- **Primary** — solid `--sky` (portal) or high-contrast CTA on marketing navy; white/navy text
- **Secondary** — glass / outlined with sky border
- **Danger** — translucent red border/fill for destructive team/admin actions
- Radius: ~4px (portal `.btn`) to ~8px (marketing scan controls); cards use larger radii

### Cards
- Portal: `.metric-card`, `.content-card`, `.auth-card` — glass background, 20–24px radius, light border, hover lift
- Marketing: `.service-card`, `.price-card` — featured Growth/Starter with badge

### Forms
- Dark inputs (portal): `rgba(0,0,0,0.3)` fill, sky focus ring
- Labels uppercase muted
- `.error-message` danger tint box

### Navigation
- Marketing: top nav + footer product/legal links
- Portal: sidebar (desktop) + mobile menu; active nav = sky tint + left border

### Consent
- Mandatory cookie consent wall / banner; analytics gated behind consent

### Status / scores
- Poor / Medium / Good score chips using danger / warning / success tokens
- Live green pulse indicator on dashboard profile widget

---

## Screen style

### Marketing home
- Full-bleed navy hero with brand + scanner as the primary composition
- One clear CTA group ("Check Free" / "See Beta Pricing")
- Trust logos → three-step services → GDPR pillars → pricing → testimonials → footer

### Auth (login / register / verify)
- Centered glass card on navy ambient glow
- Brand mark, single form job, link to alternate auth path

### Dashboard
- Sidebar brand + user/org widget + nav
- Header with page title
- Metric grid → tab content (tables, empty states with icon + CTA)
- Paywall: blurred content + overlay CTA for free orgs

### Admin / Team
- Same shell as dashboard; tabular user/org or teammate lists with role actions

### Empty states
- Centered icon, short title, one supporting sentence, one primary CTA — no cluttered card stacks in hero areas

---

## Motion

Keep intentional and sparse (already in portal CSS):
1. `fadeUp` on enter
2. Metric card hover lift + sheen
3. Nav item slide / active glow

Avoid decorative emoji clusters and multi-layer neon glows beyond existing ambient backgrounds.
