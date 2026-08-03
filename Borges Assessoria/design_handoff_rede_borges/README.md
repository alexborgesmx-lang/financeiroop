# Handoff: Rede Borges — Sistema de Design v3.0

## Overview
This package is the complete visual identity + document system for **Borges Assessoria Financeira** ("Rede Borges"), a private-trust credit network. It covers: design tokens (color, type, spacing) in light & dark, the "Linha de Confiança" signature element, UI component specs, four printable client documents, a WhatsApp message library, and an email signature. The goal of implementation is to bake this system into the company's real product/back-office ("FinanceiroOp") and its outbound documents so every surface looks and speaks the same.

Grand concept: **"A Borges não vende crédito. Constrói confiança."** (The Borges doesn't sell credit — it builds trust.) Six values: Confiança, Respeito, Responsabilidade compartilhada, Atendimento humano, Compromisso, Simplicidade.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing the intended look, tokens, and behavior. They are **not production code to copy verbatim**. The task is to **recreate this system inside the target codebase** using its established stack and patterns:
- If the app already has a framework (React, Vue, Svelte, SwiftUI, native, etc.), port the tokens/components into it as first-class primitives (CSS variables / theme file / component library).
- If no environment exists yet, pick the most appropriate stack for the project and implement there.
- The four documents and the two channel pieces (WhatsApp, email signature) can be shipped much closer to as-is, because they are self-contained HTML — but should be wired to real data (see below).

## Fidelity
**High-fidelity (hifi).** All colors, typography, spacing, radii, and shadows are final and exact. Recreate pixel-faithfully using the codebase's libraries. Every hex below is authoritative — **never invent a color; always use a token.**

## Design Tokens

Tokens are defined once in `brand-v3.css` (`:root`) and mirror the Manual. Implement them as your theme's source of truth. Contrast is measured against the surface of use.

### Color — light / dark
| Token | Light | Dark | Role | Contrast |
|---|---|---|---|---|
| `--bg` | `#F7F5EF` | `#06231A` | Warm ivory · page background | — |
| `--surface` | `#FFFDF9` | `#0B3227` | Cards, modals, tables | — |
| `--surface-2` | `#F0EDE4` | `#123B2E` | Table zebra, insets | — |
| `--ink` | `#1A1712` | `#EFF3EC` | Primary text | 15.6:1 AAA |
| `--ink-soft` | `#57514A` | `#AEBAB0` | Secondary text | 7.1:1 AAA |
| `--ink-faint` | `#7C756B` | `#7F8C82` | Labels, captions | 4.6:1 AA |
| `--brand` | `#0B3D2E` | `#5AD09B` | Trust · brand · "current" | 9.6:1 AAA |
| `--brand-2` | `#0E5C44` | `#46CB92` | Bands, hovers | — |
| `--signal` | `#127A57` | `#43D69C` | Data · progress (text) | 4.7:1 AA |
| `--signal-viz` | `#1FB877` | `#1FB877` | Chart fill ≥24px | — |
| `--action` | `#A8E03F` | `#A8E03F` | CTA (text uses `--action-ink`) | 9.1:1 AAA |
| `--action-ink` | `#07241B` | `#07241B` | Text on lime (fixed both themes) | — |
| `--on-brand` | `#EAF6EF` | `#06231A` | Text on `--brand` | — |
| `--on-brand-soft` | `#8FE3C0` | `#0B3D2E` | Secondary label on `--brand` | — |
| `--success` | `#15805A` | `#5AD09B` | Confirmation · positive | 4.9:1 AA |
| `--warning` | `#9A6510` | `#E3A93A` | Warning · pending | 4.8:1 AA |
| `--error` | `#C0322F` | `#F0716E` | Error · overdue · destructive | 5.1:1 AA |
| `--info` | `#166C70` | `#5FC2C6` | Info · link | 5.3:1 AA |
| `--line` | `#E2DDD1` | `#1B4234` | Borders | — |
| `--line-soft` | `#EEEAE0` | `#153328` | Soft dividers | — |

Semantic backgrounds (tints) exist per theme: `--success-bg`, `--warning-bg`, `--error-bg`, `--info-bg` (see `brand-v3.css` / manual token JS).

> **Critical dark-mode rule:** in dark, `--brand` becomes light mint, so anything sitting on a `--brand` surface must use `--on-brand` / `--on-brand-soft` (dark ink), never a hardcoded `#fff`. This bit us once — enforce it.

### Typography
| Role | Font | Stack |
|---|---|---|
| Display / headings / certificate | **Newsreader** (serif, wght 400/500/600, italic) | `"Newsreader", Georgia, "Times New Roman", serif` |
| UI, body & numbers | **Helvetica Neue** | `"Helvetica Neue", Helvetica, Arial, "Segoe UI", sans-serif` |
| Codes, IDs, labels | **IBM Plex Mono** (400/500/600) | `"IBM Plex Mono", ui-monospace, Menlo, monospace` |

- **Money rule (non-negotiable):** every monetary value uses Helvetica with `font-variant-numeric: tabular-nums` and weight 700–900. **Never monospace for money** — mono is only for codes (PIX, CPF, contract IDs, auth strings).
- Google Fonts import (Newsreader + IBM Plex Mono) is in `brand-v3.css`. Helvetica Neue is system.

### Spacing / radius / elevation
- Spacing scale (base 4): **8, 12, 16, 24, 32**.
- Radius: **8px** input/button · **16px** card · **999px** pill (CTA/badge).
- Shadows (two only): `--shadow` for cards, `--shadow-lg` for modals. Exact values in `brand-v3.css`.

## Signature element — "A Linha de Confiança"
A thin continuous line stitching nodes (each node = a network member; larger center node = "you"). It is the brand *without the logo*. Appears at the top of the certificate, PDF footers, app header, and as a section divider. Rules: always thin, airy, legible — never a dense ornament.
- Implemented in `brand-v3.js`: any `<svg data-thread data-w data-h data-n data-sw>` gets drawn; color comes from `currentColor`. Port this as a small component/util in the target stack.

## Components (specs)
Hierarchy: **one primary CTA (lime pill) per context**; everything else recedes. All components exist in light & dark.
- **Primary CTA** — `background:--action; color:--action-ink;` pill (radius 999). One per context.
- **Secondary / ghost** — `--surface` + `1.5px --line` border, pill.
- **Institutional** — `--brand` bg, `--on-brand` text, radius 8 (login/brand actions).
- **Contextual/warning** — `--warning-bg` bg, `--warning` text + border.
- **Destructive** — `--error` bg, white text, radius 8 (intentionally NOT a pill).
- **Disabled** — `--surface-2` bg, `--ink-faint`, reduced opacity.
- **KPI cards** — hierarchy, not a uniform grid: the "action of the day" KPI is emphasized (`--brand` bg with `--on-brand`/`--on-brand-soft` labels); others recede to `--surface`. Labels in small mono uppercase; value in large tabular `.num`.
- **Table** — header in mono uppercase `--ink-faint` on `--surface-2`; subtle zebra; right-aligned tabular values; status chips in semantic tints.

## Screens / Documents in this bundle

### FinanceiroOp (internal app) — reference only
The manual (§05) shows a Dashboard mock: left sidebar on `--brand`, main area on `--bg`, KPI row (2fr/1fr/1fr), and an "overdue installments" list. Use it as the pattern for the real app: sidebar nav, emphasized action-of-the-day KPI, semantic overdue styling. **Rebuild this in the product's real framework** — it's the biggest implementation surface.

### Documents (ship close to as-is, wire to real data)
Each is a standalone HTML page with a **Salvar / imprimir PDF** button (`window.print()`), print CSS (`@page size A4/letter`), and the Linha de Confiança. Currently they contain **example data typed into the HTML** — the implementation job is to template these fields from the real system (DB/spreadsheet/API).
1. **Comprovante de Pagamento** — payment receipt, 452px card. Fields: cliente, CPF, contrato, forma de pagamento, pago em, vencimento, saldo devedor, ID transação.
2. **Comprovante de Quitação** — the *showcase piece*. A4 formal declaration + referral invitation ("Você faz parte da Rede Borges"). Fields: cliente, contrato, principal, total pago, parcelas, período, data de quitação, auth code.
3. **Timbre de Contrato** — A4 letterhead for legal docs (header + watermark + footer with page numbers). Body clauses are sample text.
4. **Extrato do Contrato** — full contract statement: identification, KPI summary, financial situation, payment history table, overdue table. Fields map 1:1 to a contract record.

### Channels
5. **Régua WhatsApp** — 10 message templates across the lifecycle (reminders D-3/D-0, payment confirmed, welcome, overdue D+3/D+15/D+30, promise-to-pay, quitação+referral, referral thanks). Placeholders: `{{nome}}`, `{{parcela}}`, `{{valor}}`, `{{venc}}`, `{{dias}}`, `{{restantes}}`, `{{padrinho}}`, `{{link}}`. "Copiar texto" strips formatting to plain text. Port these strings into the messaging tool / API.
6. **Assinatura de E-mail** — full + compact versions, table-based inline-styled HTML (email-client safe). "Copiar assinatura" uses `ClipboardItem` (rich HTML). **The símbolo image must be swapped from the local path to a public URL before real use.**

### Hub
7. **Central de Marca** — brand portal: logo downloads, click-to-copy hex swatches, type specimens, links to all pieces. Good candidate to host internally as the team's brand home.

## Interactions & Behavior
- **Theme toggle** (manual only): `data-theme="light|dark"` on `<html>`, persisted in `localStorage` (`borges-manual-v3-theme`). In the real app, respect system preference + user override.
- **Copy-to-clipboard**: swatches (`navigator.clipboard.writeText`), WhatsApp bubbles (plain text; `<br>`→`\n`), email signatures (`ClipboardItem` rich HTML with plain-text fallback).
- **Print**: each document calls `window.print()`; print CSS forces `-webkit-print-color-adjust:exact`, hides the toolbar, and sets A4/letter geometry.
- **Motion**: confirms action, never decorates. Respect `prefers-reduced-motion`. Entrance animations must degrade to visible end-state for print/PDF.
- **Accessibility**: targets ≥44px; visible keyboard focus; contrast ≥AA on every text/bg pair (values above); status conveyed by color **and** icon/label, not color alone.

## State Management (for the app port)
- Theme (light/dark, persisted).
- Per-document data models: Client (nome, CPF, telefone, id), Contract (id, principal, parcelas, datas, status), Installment (nº, vencimento, valor, pago em, status/atraso), Payment/Transaction (id, forma, valor, data).
- Derived: progresso de quitação (%), saldo devedor, maior atraso (dias), totals recebido/pendente.

## Assets
In `assets/` (PNG):
- `borges-logo-horizontal.png` — lockup for light backgrounds.
- `borges-logo-horizontal-branco.png` — lockup for dark backgrounds.
- `borges-simbolo.png` — symbol, 1024×1024, transparent.
- `borges-simbolo-verde.png` — symbol on forest tile (avatar / app icon / email).
- `borges-favicon-256.png` — favicon.
The symbol is two overlapping rounded squares (lime `#1FB877` + forest `#0B3D2E`, dark intersection `#07241B`) — often drawn inline as SVG in the prototypes; reuse either the PNG or the inline SVG.

## Files (design references)
- `brand-v3.css` — tokens, fonts, base primitives, print rules. **Start here.**
- `brand-v3.js` — Linha de Confiança renderer.
- `Manual de Design v3.html` — full system (source of truth) + light/dark toggle.
- `Manual de Design v3.md` — text spec of the manual (good to feed as context).
- `Central de Marca.html` — brand portal / downloads.
- `Régua WhatsApp.html`, `Assinatura de E-mail.html` — channels.
- `Comprovante de Pagamento.html`, `Comprovante de Quitação.html`, `Timbre de Contrato.html`, `Extrato do Contrato.html` — documents.
- `assets/` — logos & favicon.

## Company data (use in all documents)
**Borges Assessoria Financeira** · CNPJ **63.124.205/0001-07** · borgesassessoriafinanceira@gmail.com · **(62) 98487-7843**

## Suggested implementation order
1. Port `brand-v3.css` tokens + fonts into the app's theme (light & dark).
2. Add the Linha de Confiança util (`brand-v3.js`) and base components (buttons, KPI, table, chips).
3. Rebuild the FinanceiroOp dashboard/screens on those primitives.
4. Templatize the four documents from real contract/payment data; keep print CSS.
5. Load the WhatsApp templates into the messaging flow; publish the email signature (with a hosted símbolo URL).
6. Host Central de Marca internally as the brand home.
