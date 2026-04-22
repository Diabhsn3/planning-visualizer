# Design System — Planning Visualizer

> **Memorable thing:** "The terminal green glow that makes planning algorithms click instantly."
> Every design decision serves this — the dark terminal aesthetic is the identity, and clarity/instant comprehension is the mission.

---

## Product Context

- **What this is:** An interactive visualization tool for domain-independent AI planners. Users select a planning domain (Blocks World, Gripper, Depot, Hanoi, Rovers, Satellite), configure a problem and strategy, then generate and step through state-by-state visual renderings of the planner's solution.
- **Who it's for:** University students in AI planning courses, researchers, and CS educators.
- **Space/industry:** Academic CS education, AI planning research tools.
- **Project type:** Single-page web application (React + TypeScript + Tailwind CSS + tRPC).
- **Peers:** There are no direct visual competitors — this is a unique tool in its space. The closest analogues are algorithm visualizers (VisuAlgo, Algorithm Visualizer) and CS education tools (Jupyter notebooks, STRIPS planners with text output).

---

## Aesthetic Direction

- **Direction:** Retro-Futuristic / Industrial-Utilitarian hybrid.
- **Decoration level:** Intentional — subtle texture (scanline overlay, grid background, floating orb particles) that reinforces the terminal/mission-control atmosphere without overwhelming the visualization content.
- **Mood:** A dark mission control room where planning algorithms come alive. Serious enough for researchers, engaging enough for students. The green-on-dark palette evokes terminal sessions and hacker culture — the user should feel like they're operating sophisticated software, not using a toy.
- **Key visual elements:**
  - CRT scanline overlay (fixed, full-screen, very subtle)
  - Technical grid background (40px grid, near-invisible lines)
  - Floating gradient orbs (3 orbs with slow drift animations, 20-30s cycles)
  - Green glow effects on primary actions (pulsing box-shadow on Generate button)
  - Card accent hairlines (green gradient top border on loaded cards)

---

## Typography

- **Display/Hero:** JetBrains Mono (monospace) — Used for the "Planning Visualizer" header, domain names in the sidebar, terminal command displays, and all headings that should feel "technical." The monospace font is the strongest brand signal — it says "this is a tool built by engineers."
- **Body:** IBM Plex Sans (sans-serif) — Clean, readable, designed for technical documentation. Used for descriptions, labels, plan step text, and all general UI copy. Loaded via Google Fonts with weights 300-700.
- **UI/Labels:** IBM Plex Sans — Same as body. Step labels, button text, badge text, and sidebar controls all use IBM Plex Sans at various weights.
- **Data/Tables:** JetBrains Mono — Plan step details, state indices, and any data-oriented content uses monospace for alignment and technical feel.
- **Code:** JetBrains Mono — Terminal command displays, PDDL content in modals.
- **Loading:** Google Fonts CDN — `https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap`

### Type Scale (current usage)

| Level | Size | Weight | Font | Usage |
|-------|------|--------|------|-------|
| Hero | text-2xl (24px) | semibold | JetBrains Mono | "Ready to Visualize" heading |
| Title | text-xl (20px) | semibold | JetBrains Mono | "Planning Visualizer" header |
| Section | text-sm (14px) | semibold | JetBrains Mono | Step titles ("Domain", "Problem", "Strategy") |
| Body | text-sm (14px) | normal/medium | IBM Plex Sans | Descriptions, plan step text |
| Label | text-xs (12px) | medium | IBM Plex Sans | Sidebar labels, badges, button text |
| Caption | text-[11px] | medium/bold | IBM Plex Sans | Step numbers in circles, small badges |
| Micro | text-[10px] | medium | IBM Plex Sans | Speed badges, strategy badges (inside pills only) |

### Tracking

| Context | Value | Rationale |
|---------|-------|-----------|
| Section headers ("CONFIGURE") | tracking-[0.15em] | Wide letter-spacing for uppercase labels, military/technical feel |
| Footer | tracking-wide | Subtle spacing for small footer text |
| Hero heading | tracking-tight | Tighter for large display text |

---

## Color

- **Approach:** Restrained — One primary accent (green) plus cool-toned neutrals. Color is rare and meaningful. Green means "active/primary/go." Other colors appear only for semantic purposes (error, warning, provider badges).
- **Mode:** Dark-first. The app is designed for dark mode. A light mode exists in CSS variables but the app forces `.dark` class.

### Dark Mode Palette (primary)

| Token | Hex | Role |
|-------|-----|------|
| `--background` | `#0B1524` | Page background — deep navy-black |
| `--card` | `#111E30` | Card/panel surfaces — slightly lighter |
| `--secondary` | `#1A2840` | Elevated surfaces, hover states |
| `--muted` | `#0F1A2E` | Recessed surfaces, subtle backgrounds |
| `--foreground` | `#E2E8F0` | Primary text (slate-200) |
| `--card-foreground` | `#E2E8F0` | Card text |
| `--secondary-foreground` | `#CBD5E1` | Secondary text (slate-300) |
| `--muted-foreground` | `#64748B` | Muted/disabled text (slate-500) |
| `--primary` | `#22C55E` | Terminal green — primary accent, CTAs, active states |
| `--primary-foreground` | `#0B1524` | Text on green backgrounds |
| `--accent` | `rgba(34, 197, 94, 0.1)` | Green-tinted highlight backgrounds |
| `--accent-foreground` | `#4ADE80` | Bright green for accent text (green-400) |
| `--destructive` | `#F87171` | Error/destructive actions (red-400) |
| `--border` | `rgba(255, 255, 255, 0.07)` | Hairline borders — barely visible |
| `--ring` | `#22C55E` | Focus ring color |

### Semantic Colors

| Purpose | Color | Tailwind Class | Usage |
|---------|-------|----------------|-------|
| Success/Active | `#22C55E` | green-500 | Active domain, selected states, primary buttons |
| Error | `#F87171` / `#EF4444` | red-400 / red-500 | Error states, destructive badges |
| Warning | `#F59E0B` | amber-500 | Warning badges, amber alerts |
| Info | `#6366F1` | indigo-500 | Gemini provider badge, chart accent |
| Claude provider | `#FB923C` | orange-400 | Claude model badge (orange-500/15 bg) |
| Gemini provider | `#60A5FA` | blue-400 | Gemini model badge (blue-500/15 bg) |

### Domain-Specific Colors

Each planning domain has a unique color identity used for its icon, name, and active state in the sidebar. These are defined in the `domainColors` map:

| Domain | Icon Color | Name Color | Accent |
|--------|-----------|------------|--------|
| Blocks World | `#4ade80` (green-400) | `#86efac` (green-300) | Green family |
| Gripper | `#38bdf8` (sky-400) | `#7dd3fc` (sky-300) | Sky/blue family |
| Depot | `#fb923c` (orange-400) | `#fdba74` (orange-300) | Orange family |
| Hanoi | `#a78bfa` (violet-400) | `#c4b5fd` (violet-300) | Violet family |
| Rovers | `#f87171` (red-400) | `#fca5a5` (red-300) | Red family |
| Satellite | `#2dd4bf` (teal-400) | `#5eead4` (teal-300) | Teal family |

### Opacity Scale (for layered dark surfaces)

| Value | Usage |
|-------|-------|
| `0.04` | Barely visible — inner card highlight, shimmer base |
| `0.05-0.06` | Subtle — sidebar border, hover backgrounds |
| `0.07` | Standard — card borders, input borders |
| `0.08-0.10` | Visible — active backgrounds, scrollbar thumb |
| `0.15` | Prominent — provider badge backgrounds |
| `0.20` | Strong — hover states on scrollbar |

---

## Spacing

- **Base unit:** 4px (Tailwind default)
- **Density:** Comfortable — the app uses generous padding inside cards and panels, but keeps list items compact for scanning.

### Spacing Scale (most frequently used)

| Token | Value | Primary Usage |
|-------|-------|---------------|
| `gap-1` / `gap-1.5` | 4-6px | Icon-to-text gaps, tight inline groups |
| `gap-2` | 8px | Most common gap — list items, button groups, inline elements |
| `gap-3` | 12px | Section gaps within cards, sidebar sections |
| `gap-4` | 16px | Major section gaps |
| `p-2` / `p-2.5` | 8-10px | Small card padding, button padding |
| `p-3` | 12px | Medium card padding |
| `p-4` | 16px | Standard card padding |
| `p-6` | 24px | Large card padding, modal padding |
| `px-3` | 12px | Horizontal padding on list items, inputs |
| `px-4` | 16px | Horizontal padding on cards |
| `px-6` | 24px | Horizontal padding on large buttons |
| `py-2` / `py-2.5` | 8-10px | Vertical padding on buttons, list items |
| `py-3` / `py-3.5` | 12-14px | Vertical padding on larger buttons |
| `py-4` | 16px | Vertical padding on card sections |

---

## Layout

- **Approach:** Grid-disciplined — strict two-column layout (sidebar + main content) with predictable alignment.
- **Grid:** Single breakpoint layout — sidebar (320px fixed) + fluid main content area.
- **Max content width:** 1440px (`max-w-[1440px]`)
- **Sidebar width:** 320px (w-80)
- **Main content:** Flex column with visualization card + plan steps card side by side.

### Border Radius Scale

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-md` | 6px | Small elements (rare) |
| `rounded-lg` | 8px | Buttons, inputs, list items, badges |
| `rounded-xl` | 12px | Cards, panels, modals, textareas |
| `rounded-2xl` | 16px | Large cards, main visualization panel |
| `rounded-full` | 9999px | Pill badges, step circles, avatar-like elements |

### Breakpoints

| Breakpoint | Width | Behavior |
|------------|-------|----------|
| Mobile (<640px) | 100% | Container padding 1rem, sidebar collapses |
| Tablet (640-1023px) | 100% | Container padding 1.5rem |
| Desktop (1024px+) | max 1440px | Container padding 2rem, sidebar + main layout |
| Wide (1536px+) | max 1440px | Container padding 2.5rem |

---

## Motion

- **Approach:** Intentional — meaningful animations that aid comprehension and add personality, without being distracting. The app uses both CSS animations (ambient effects) and Framer Motion (interactive transitions).
- **Library:** Framer Motion for React component animations; CSS @keyframes for ambient effects.

### CSS Animations (ambient/decorative)

| Animation | Duration | Easing | Purpose |
|-----------|----------|--------|---------|
| `fade-in` | 250ms | cubic-bezier(0.23, 1, 0.32, 1) | General entrance |
| `slide-up` | 300ms | cubic-bezier(0.23, 1, 0.32, 1) | Content entrance from below |
| `scale-in` | 200ms | cubic-bezier(0.23, 1, 0.32, 1) | Scale entrance |
| `shimmer` | 1.5s | linear, infinite | Loading skeleton effect |
| `blink` | 1s | steps(2), infinite | Cursor blink in terminal |
| `btn-idle-glow` | 2.8s | ease-in-out, infinite | Generate button pulsing glow |
| `step-pulse` | 2s | ease-in-out, infinite | Active plan step left-border pulse |
| `glow-pulse` | varies | ease-in-out, infinite | Node glow in empty state SVG |
| `orb-drift-a/b/c` | 20-30s | ease-in-out, infinite | Background floating orbs |

### Framer Motion Patterns (interactive)

| Pattern | Config | Usage |
|---------|--------|-------|
| Spring expand | `stiffness: 400, damping: 36` | Collapsible sections (sidebar panels) |
| Spring pop | `stiffness: 340, damping: 22` | Node entrance in empty state SVG |
| Path draw | `duration: 0.45, delay: staggered` | Edge drawing in empty state SVG |
| Fade | `duration: 0.18` | Simple opacity transitions |
| Scan line | `duration: 2.5, repeat: Infinity, linear` | Vertical scan line in loading state |

### Transition Defaults

| Property | Duration | Usage |
|----------|----------|-------|
| `transition-all duration-150` | 150ms | Most interactive elements (buttons, list items) |
| `transition-colors` | 200ms (base default) | Color-only transitions |
| `transition-all duration-200` | 200ms | Global default on button/a/input/select/textarea |
| `transition-all duration-300` | 300ms | Larger layout transitions (rare) |

---

## Shadows

- **Approach:** Minimal — shadows are used sparingly. The layered dark surface approach (background → card → secondary) provides depth without shadows. Shadows appear only on:
  - The Generate button (`btn-primary-green` glow shadow)
  - Focus rings (`ring-2 ring-ring ring-offset-2`)
  - Card inner highlight (`0 1px 0 rgba(255,255,255,0.04) inset`)
  - Scrollbar thumb (none — uses opacity only)

| Shadow | Value | Usage |
|--------|-------|-------|
| `shadow-sm` | Tailwind default | Rare — small elevation |
| Button glow (idle) | `0 4px 20px rgba(34,197,94,0.28), inset highlight` | Generate button resting state |
| Button glow (hover) | `0 6px 32px rgba(34,197,94,0.5), inset highlight` | Generate button hover |
| Card surface | `0 1px 0 rgba(255,255,255,0.04) inset` | Inner top highlight on `.surface` class |
| Focus ring | `ring-2 ring-green-500 ring-offset-2 ring-offset-background` | Keyboard focus indicator |

---

## Icons

- **Source:** Custom hand-drawn SVG icons for domain-specific icons (Blocks, Gripper, Depot, Hanoi, Rovers, Satellite). Lucide-style stroke icons for UI actions (imported as custom components in `Icons.tsx`).
- **Stroke width:** 1.0-1.2 for primary strokes, 0.8-0.9 for secondary/detail strokes.
- **ViewBox:** 16x16 for all domain icons.

### Icon Size Scale

| Size | Tailwind Class | Usage |
|------|---------------|-------|
| Tiny | `w-3 h-3` | Inline indicators, chevrons inside small elements |
| Small | `w-3.5 h-3.5` | Badge icons, step indicators |
| Medium | `w-4 h-4` | Standard UI icons (sidebar toggle, buttons, list items) |
| Default | `w-5 h-5` | Primary action icons, domain icons in sidebar |
| Large | `w-6 h-6` | Header icons, empty state icons |

---

## Components

### Cards

Cards use the `.surface` class: `background: var(--card)`, `border: 1px solid var(--border)`, `box-shadow: inset highlight`. Border radius is `rounded-2xl` for main panels, `rounded-xl` for nested cards.

### Buttons

| Variant | Style | Usage |
|---------|-------|-------|
| Primary (Generate) | `.btn-primary-green` — green gradient, glow shadow, dark text | Main CTA |
| Secondary | `bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08]` | Sidebar actions, secondary CTAs |
| Ghost | `hover:bg-white/[0.04]` text only | Tertiary actions, toggles |
| Danger | `bg-red-500/15 text-red-400 hover:bg-red-500/25` | Delete, destructive |

### Badges

Pill-shaped (`rounded-full`), small (`text-[10px]` or `text-[11px]`), with colored background at 15% opacity and matching text color. Used for: speed indicators, strategy type, provider labels, cached renderer metadata.

### Step Circles

Numbered circles in the sidebar indicating configuration steps (1-4). Size `w-7 h-7`, `rounded-full`, with green background when active and muted background when inactive. Font is `text-[11px] font-bold` JetBrains Mono.

### Modals

Fixed overlay with `bg-black/60` backdrop. Modal card uses `rounded-2xl`, `p-6`, with close button in top-right. Content uses the standard card surface styling.

---

## Accessibility

- **Focus indicators:** `ring-2 ring-ring ring-offset-2 ring-offset-background` on `:focus-visible`.
- **Reduced motion:** Full `prefers-reduced-motion: reduce` support — disables all animations, orbs, scanlines, and reduces transition durations to near-zero.
- **Cursor states:** `cursor-pointer` on all interactive elements, `cursor-not-allowed` on disabled.
- **ARIA labels:** Applied to playback controls and modal close buttons.
- **Color contrast:** Primary text (#E2E8F0) on background (#0B1524) passes WCAG AA. Green accent (#22C55E) on dark backgrounds passes AA for large text.
- **Selection color:** Green-tinted selection (`rgba(34, 197, 94, 0.25)`) for brand consistency.
- **Scrollbar:** Custom styled (7px width, subtle thumb) for visual consistency without hiding functionality.

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025 | Dark-first with terminal green | Target audience (CS students, researchers) expects a technical, developer-tool aesthetic. Green-on-dark evokes terminal sessions and feels authoritative for algorithm visualization. |
| 2025 | IBM Plex Sans + JetBrains Mono | IBM Plex Sans is designed for technical documentation (IBM's open-source typeface). JetBrains Mono is the gold standard for code/developer tools. Together they signal "serious engineering tool." |
| 2025 | Custom domain SVG icons | No existing icon library covers planning domains (blocks, grippers, rovers). Hand-drawn SVGs ensure visual consistency and domain-specific clarity. |
| 2025 | Framer Motion for interactive, CSS for ambient | Framer Motion provides spring physics for UI interactions (collapsible panels, node entrances). CSS handles ambient effects (orbs, scanlines, button glow) that run continuously without React re-renders. |
| 2025 | Scanline + grid + orb decoration | Reinforces the "mission control" atmosphere. Scanlines are extremely subtle (0.018 opacity) — visible subconsciously but never distracting. Orbs add organic movement to an otherwise rigid technical layout. |
| 2026-04-22 | Design system documented | Inferred from existing codebase via /plan-design-review. All tokens, patterns, and rationale captured as source of truth for future development. |
