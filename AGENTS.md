# OriginPoint site — working rules

Read this before editing. It applies to people and to AI agents (Claude Code, Codex) working
in this repo.

## Who works where

Two people share this repo: **saged** (laptop, Tailscale `100.67.72.84`) and **shado**
(`100.73.19.70`). Both drive AI agents, so collisions are the main risk.

- **Pull before you edit**, every time: `git pull --rebase`.
- **Commit after each change**, in small pieces, and push straight away. Long-running
  uncommitted work is how edits get lost.
- **One writer per file at a time.** `index.html` and `styles.css` are shared by everything —
  agree who holds a file before touching it, or work on a short branch and merge quickly.
- **Never overwrite work you did not read first.** If a file changed unexpectedly, read it and
  merge deliberately. Do not revert someone else's work to reapply your own.
- **Do not move project files between machines over SSH/scp.** Git is the only source of truth.

## Do not touch

- `reference/` — internal brand and planning documents, including pricing, costs and
  strategy. Gitignored on purpose so deploys can never publish it. Never commit it, never
  copy it to another machine.

## The site

Static, no build step, deployable to Netlify or Vercel as-is. Current structure is
multi-page: `index.html`, `services.html`, `process.html`, `about.html`, `contact.html`,
plus `styles.css` and `site.js`.

> Open question: the original brief asked for a single page with exactly two files and inline
> JS. The multi-page build is the agreed base for now. Settle this before restructuring
> again.

### Brand

Colours (CSS custom properties at `:root`):

| Token (CSS name) | Colour | Hex | Use |
|---|---|---|---|
| `--color-burgundy` | Cassis | `#351E28` | logo, headings, buttons, hero and page-header fields, closing field |
| `--color-ink` | Deep cassis ink (a shade of Cassis) | `#211218` | dark fields, display type, text on Orange Topaze and Vert Sauge |
| `--color-ink-light` | Orange Topaze | `#FF5C34` | hairlines and numerals on dark fields |
| `--color-sky` | Wasabi | `#E9F056` | headlines, rings and buttons on dark fields, tabs, highlight cards |
| `--color-plate` | Orange Topaze | `#FF5C34` | the "Why" field, the hero disc, binder page 3, with dark text |
| `--color-wash` | Cool Blue | `#D7EFFF` | quiet fields |
| `--color-sage` | Vert Sauge | `#AEB8A0` | secondary mid-tone field (binder page 4), with dark text |
| `--color-ivory` | Soft ivory | `#F7F3EC` | header, cards, paper sections |
| `--color-paper` | Warm paper | `#EFE8DC` | letter-like fields |
| `--color-charcoal` | Muted charcoal | `#26242A` | body copy on light fields |

The five palette colours (Cassis, Wasabi, Orange Topaze, Cool Blue, Vert Sauge) are the
"La Palette Pinterest 2026" set, hex values as printed on the reference. The token names are
historical (they date from earlier palettes): `--color-sky` is now Wasabi and
`--color-burgundy` is Cassis. The class names follow the old roles too: `.section--sky` (hero,
page headers) is Cassis with light text, and `.section--plate` (the "Why" section) is Orange
Topaze. Keep the names stable; change the values. Orange Topaze and Vert Sauge are mid-tones:
use the dark ink on them, never ivory body text.

- **Type:** Playfair Display throughout, body at 1.7 line-height, body lines under 75
  characters.
- **Logo lockup:** "Origin" bold roman + "Point" italic, set tight with no space between.
  "Point" stays italic wherever the name appears in display type.
- **Voice:** confident, considered, timeless. Clear over clever. Sentence case, no ALL CAPS,
  no exclamation marks. Tagline: "Clarity at the starting line."
- **Look:** generous whitespace, editorial not SaaS. 1px burgundy hairlines instead of
  shadows. No gradients as decoration, no glassmorphism, no blur, no uniform rounded corners,
  no stock photography.
  One deliberate exception: every ring (the hero ripples, the binder hardware, the slow
  background and drifting rings) is polished silver. The gradient is the material, not
  decoration; do not use gradients anywhere else.

### Must not regress

- No horizontal scrolling at 320, 390, 768, 1024 or 1440px wide.
- Visible keyboard focus on every interactive element; skip link; semantic HTML.
- All motion disabled under `prefers-reduced-motion`.
- Contact form: client-side validation with inline errors, success message replaces the form.
  There is no backend — wire it to a form service before relying on it.
- Hero canvas, where present: pause when hidden or scrolled out of view, cap active rings,
  and keep hero text legible against it.

## Scripts on Windows

Write any `.ps1` file as **ASCII only**. Windows PowerShell 5.1 reads UTF-8 without a BOM as
ANSI, so em dashes and curly quotes become parse errors.
