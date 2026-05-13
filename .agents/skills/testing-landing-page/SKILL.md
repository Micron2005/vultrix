---
name: testing-landing-page
description: Test the public landing page and rich text editor feature end-to-end. Use when verifying /site or /site/edit changes.
---

# Testing the Landing Page & Rich Text Editor

## Local Dev Setup

1. Navigate to the `qna-noor-auto/` subdirectory (the repo has a nested project structure)
2. Run `npx prisma migrate dev` to apply any pending migrations
3. Run `pnpm dev` to start the dev server at `http://localhost:3000`

## Login

- Password: stored as `APP_PASSWORD` secret (default for local dev: `changeme`)
- Login page: `/login`
- The login is shared — there's one password for all staff

## Key Routes

| Route | Auth Required | Purpose |
|---|---|---|
| `/site` | No | Public landing page (customers see this) |
| `/site/edit` | Yes | Rich text editor for shop owner |
| `/login` | No | Password entry |

## Test Scenarios

### 1. Editor Toolbar Verification
- Navigate to `/site/edit` (must be logged in)
- Verify toolbar has: B, I, U, S, H1, H2, H3, Size dropdown, color pickers, alignment, lists, Image, blockquote, horizontal rule, Undo/Redo, Save
- The editor uses Tiptap (ProseMirror-based) with a contenteditable div
- If old block-based buttons appear ("+Heading", "+Text", "+Image"), the migration to rich text editor may have regressed

### 2. Content Creation & Persistence
- Click into editor area, type text
- Apply formatting (select text → click toolbar buttons)
- Click Save → look for green "Saved" indicator next to the Save button
- Click "View live page" → verify content renders on `/site` with formatting preserved
- Check HTML in DOM: formatted content should be inside a `.landing-content` div using `dangerouslySetInnerHTML`

### 3. Access Control
- Sign out (navigate to `/logout`)
- Visit `/site` → should show "Login" button (not "Edit page")
- Visit `/site/edit` → should redirect to `/login?next=%2Fsite%2Fedit`

### 4. Image Upload (if testing)
- In editor, click "Image" button → file picker opens
- Select an image file → image is embedded as base64 data URL in the HTML
- Images are stored inline in the HTML, not as separate files

## Database

- Landing page content is stored in the `LandingContent` table (singleton pattern, id="singleton")
- Uses Prisma ORM with PostgreSQL
- Local dev DB: user `noor`, password `noor`, database `noorauto` at `localhost:5432`

## Devin Secrets Needed

- `APP_PASSWORD`: Login password for the app (default local dev: `changeme`)
