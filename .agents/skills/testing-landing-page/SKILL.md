---
name: testing-landing-page
description: Test the landing page editor and theme customizer end-to-end. Use when verifying /site or /site/edit changes.
---

# Testing the Landing Page

## Overview
The landing page has two main features:
1. **Rich text editor** at `/site/edit` — Google Docs-style content editing with Tiptap
2. **Theme customizer** at `/site/edit` — color pickers, 6 presets, background patterns

The public page at `/site` renders the saved content and theme.

## Setup

1. Navigate to the `qna-noor-auto/` subdirectory (the repo has a nested project folder)
2. Run `npx prisma migrate dev` to apply any pending migrations
3. Run `npx prisma generate` to ensure the Prisma client is in sync with the schema
4. Start the dev server: `pnpm dev`
5. Log in at `/login` with the APP_PASSWORD (default: `changeme`)
6. Verify you can access `/site` (public) and `/site/edit` (admin)

### Common Setup Issue: Prisma Client Out of Sync
If you see errors like `Unknown argument 'theme'` or similar Prisma runtime errors after schema changes, the Prisma client needs to be regenerated:
```bash
npx prisma generate
# Then restart the dev server
```
This happens when the database schema has been updated but the TypeScript client wasn't regenerated.

## Testing the Theme Customizer

1. Navigate to `/site/edit`
2. Click "Customize Colors & Patterns" to expand the theme panel
3. The panel shows:
   - **Quick Presets**: Default, Ocean Blue, Forest Green, Warm Red, Purple Night, Sunset Orange
   - **Color pickers**: Header (bg/text/border), Hero Banner (bg/title/subtitle), Buttons (bg/text), Page Background (color + pattern), Footer (bg/text/border)
4. Click a preset → verify color pickers update
5. Click "Save Theme" → expect green "Saved" text (appears briefly, ~2 seconds)
6. Click "View live page" or navigate to `/site` → verify colors applied

### Key Test Flow
- Start from Default theme → verify dark zinc look on `/site`
- Apply a preset (e.g., Ocean Blue) → Save → verify on `/site`
- Switch to another preset (e.g., Warm Red) → Save → verify the previous preset was fully replaced

### Expected Colors for Common Presets
- **Ocean Blue**: Hero #1e3a8a, Button #2563eb, Footer #1e3a8a, Page BG #eff6ff, Pattern: Waves
- **Warm Red**: Hero #7f1d1d, Button #dc2626, Footer #7f1d1d, Page BG #fef2f2, Pattern: None
- **Default**: Hero #18181b, Button #18181b, Footer #ffffff, Page BG #fafaf9, Pattern: None

## Testing the Rich Text Editor

1. Navigate to `/site/edit`
2. The toolbar has: B/I/U/S, H1-H3, font size, text/highlight color, alignment, lists, image, blockquote, horizontal rule, Save
3. Type text in the editor area
4. Apply formatting (e.g., H1, bold)
5. Click "Save" → expect "Saved" indicator
6. Navigate to `/site` → verify formatted content renders

## Auth Testing
- `/site` is publicly accessible (no login needed)
- `/site/edit` requires authentication — unauthenticated users get redirected to `/login`
- When logged in, `/site` shows "Edit page" and "Dashboard" buttons instead of "Login"

## Devin Secrets Needed
- `APP_PASSWORD` — password for admin login (default `changeme` in development)
- PostgreSQL credentials — user `noor`, password `noor`, database `noorauto` at `localhost:5432`

## Tips
- The "Saved" indicator after Save Theme is transient (~2s) — don't wait too long to check for it
- Server logs show `saveLandingTheme(...)` calls with 200 status to confirm saves went through
- Theme colors are stored as JSON in the `LandingContent.theme` column in PostgreSQL
- The theme panel remembers the last saved values when you reopen `/site/edit`
- Background patterns (dots, grid, diagonal, crosshatch, waves, chevron) are CSS-based and may be subtle
