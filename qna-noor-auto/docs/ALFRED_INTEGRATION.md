# Alfred → Vultrix Personal Assistant — Integration Roadmap

> Status: **PLAN ONLY — nothing here is built yet.** This is the agreed direction
> for gradually folding the standalone [Alfred](https://github.com/Micron2005/Alfred-ai)
> assistant into Vultrix's **personal accounts**, one safe slice at a time.

## 1. Goal

Bring Alfred's *brain* — its personality, memory, and (later) select tools — into
Vultrix's existing personal-account AI assistant, as clean **multi-tenant SaaS
features**. We are **not** running the `alfred-core` Docker stack in production and
we are **not** shipping Alfred's home/hardware features to SaaS users.

Locked decisions:
- **Integration style:** port Alfred's persona + capabilities into Vultrix's
  existing assistant (rebuild as multi-tenant features). ✅
- **Persona:** a *genericized* "Alfred" butler personality that each user can
  optionally enable, **name**, and tune (not hardcoded to one person). ✅
- **First slice:** the personality/tone layered onto the existing personal chat. ✅
- **Infra/models:** best-judgment (see §7). ✅

## 2. Where each system stands today

### Vultrix assistant (the thing we're extending)
Already a solid multi-tenant base — we extend it, we don't replace it:
- `src/lib/assistant/conversation.ts` — true multi-turn orchestration loop.
- `src/lib/assistant/providers.ts` — pluggable backends (OLLAMA / OPENAI /
  ANTHROPIC), each accepts a `systemPrompt`.
- `src/lib/assistant/actions.ts` — app tools (calendar events, notes, etc.).
- `src/lib/assistant/datetime.ts` — natural-language date parsing (chrono).
- `src/app/api/assistant/chat/route.ts` — API entry; **`buildSystemPrompt()`
  (~line 350)** is where the persona string is assembled today
  (`You are ${assistantName}, a friendly, knowledgeable AI assistant.`), using
  `org.aiAssistantName`.
- `src/app/assistant/AssistantClient.tsx` — chat UI (sends browser timezone,
  voice mode).
- `src/app/settings/ai-assistant-actions.ts` — settings server actions.
- **Prisma `Organization` already has the hooks we need:**
  `aiAssistantEnabled`, `aiHostedEnabled`, `aiAssistantProvider` (default
  `OLLAMA`), `aiAssistantApiKeyEncrypted` (BYO key), **`aiAssistantName`**
  (already user-customizable), `aiAssistantVoice`.
- Billing: AI assistant is a **+$10/mo add-on** on Personal, or **bring your own
  OpenAI/Anthropic key** for free (see `src/lib/billing.ts`, signup wizard).

### Alfred (source of ideas/behaviour)
- `alfred-core` (FastAPI + Postgres/pgvector): `persona.py` (Standard +
  Nightfall), `wake.py`, `router.py` (local vs cloud), `llm/*`, `tools/*`,
  marker-based tools (`[REMEMBER]`, `[SEARCH]`/Tavily, `[SEND_EMAIL]`/Gmail,
  `[SPOTIFY_*]`, `[GENERATE_IMAGE]`/Pollinations, `[REMEMBER_CONVERSATION]`),
  long-term memory (pgvector + markdown mirror).
- `alfred-web` (Next.js): chat UI, theme swap per mode, JARVIS HUD, Design Pad.
- Home/hardware: voice (Whisper/Piper/openWakeWord), camera presence, hand
  tracking, Home Assistant, Creality K1 printer, Tailscale remote access.

## 3. Guiding principles (multi-tenant SaaS)

1. **Per-user isolation** — every persona setting, memory, and key is scoped to
   the `Organization`/user. No global state (Alfred's mode is a global today).
2. **Genericize the persona** — remove hardcoded "Mukarram"/"Batman"; drive tone,
   honorific, name, and sarcasm level from per-user config.
3. **Leave home/hardware out of the SaaS** — smart home, 3D printer, camera,
   hand-tracking, Design Pad, Tailscale, Gmail/Spotify creds do **not** belong in
   a multi-tenant web app. They stay in the standalone Alfred repo.
4. **Security first** — encrypt any per-user secrets (reuse the existing
   `aiAssistantApiKeyEncrypted` pattern); never log memory content or keys.
5. **Cost-aware** — hosted model runs on shared infra; heavy users can BYO key.
6. **Entitlement-gated** — features respect the existing AI add-on / hosted flags.

## 4. What we bring over vs leave behind

| Alfred capability | Verdict | Notes |
|---|---|---|
| Butler **persona/tone** (Standard) | ✅ Bring (Slice 1) | Genericized + per-user config |
| Nightfall Protocol (Batman) | ⚠️ Optional easter-egg later | Fun toggle; not core; per-user only |
| Wake phrases ("Hey Alfred") | ✅ Later (voice) | Ties to voice slice |
| **Long-term memory** (pgvector) | ✅ Bring (Slice 2) | Strict per-user isolation |
| `[SEARCH]` web search (Tavily) | ✅ Bring (Slice 3) | Cloud-safe tool |
| `[GENERATE_IMAGE]` | ✅ Bring (Slice 3) | Use Vultrix's approved image path |
| Voice STT/TTS | ✅ Bring (Slice 4) | Browser-first; server STT optional |
| `[SEND_EMAIL]` (Gmail) | 🔶 Maybe, guarded | Only via app-owned sender + consent |
| `[SPOTIFY_*]` | ❌ Skip (SaaS) | Per-user OAuth, low value here |
| Smart home / 3D printer / camera / hand-tracking / Design Pad | ❌ Leave in Alfred repo | Home-bound, not multi-tenant |

## 5. Phased roadmap

### Phase 0 — Foundations (do once, before Slice 1)
- Add persona config to `Organization`:
  - `aiAssistantPersona` (enum/string, default `STANDARD`; e.g. `STANDARD` |
    `BUTLER`).
  - `aiAssistantTone` (optional free-text/enum: e.g. `warm` | `dry_witty` |
    `formal`), `aiAssistantHonorific` (e.g. "sir"/"" — optional).
  - `aiAssistantSarcasm` (0–2) optional dial.
- Prisma migration + defaults so existing users are unchanged (`STANDARD`).
- Settings UI additions in the AI-assistant settings page.

### Phase 1 — Alfred **personality/tone** (FIRST SLICE) 🎯
Goal: when a user turns on the "Alfred/Butler" persona, the same assistant answers
with a dry, loyal, quietly-competent butler voice — using **their** chosen name
and honorific — with **zero** change to tool behaviour or data.
- Extend `buildSystemPrompt()` in `src/app/api/assistant/chat/route.ts` to branch
  on `aiAssistantPersona`/tone and inject a genericized butler system prompt
  (adapted from Alfred `persona.py`, stripped of personal/hardcoded references).
- Keep `aiAssistantName` as the spoken name (default could suggest "Alfred").
- Small settings UI: persona picker + preview + tone/honorific dials.
- Tests: unit-test prompt assembly per persona; a chat smoke test.
- No schema/data risk; fully reversible (persona = STANDARD → unchanged).

### Phase 2 — Per-user long-term memory
- New Prisma models: `AssistantMemory` (userId/orgId, kind, content, createdAt)
  and embeddings via **pgvector** (Vultrix already uses Postgres; enable the
  extension in a migration).
- Adapt Alfred's `[REMEMBER]` / semantic recall into Vultrix tool-calls
  (function-call style, not raw markers) wired through `conversation.ts`.
- Strict scoping: every query filtered by user; never cross-tenant.

### Phase 3 — Cloud-safe tools
- Web search (`[SEARCH]`) → a Vultrix tool (Tavily or similar; server-side key).
- Image generation → route through Vultrix's approved image path.
- Register as function-call tools in the existing multi-turn loop.

### Phase 4 — Voice
- Browser Web Speech first (already partially present via voice mode); optional
  server STT (faster-whisper) / TTS (edge-tts/Piper) later.
- Wake phrase optional, per-user.

### Phase 5 — Optional / fun
- Nightfall-style alt persona as a **per-user** toggle (never global).
- Additional dials, per-user memory export.

### Explicitly out of scope for the SaaS
Smart home, 3D printer, camera presence, hand tracking, Design Pad, Tailscale,
Gmail/Spotify integrations — these remain in the standalone Alfred project.

## 6. Data model additions (sketch)
```prisma
model Organization {
  // ...existing...
  aiAssistantPersona   String  @default("STANDARD") // STANDARD | BUTLER
  aiAssistantTone      String? // warm | dry_witty | formal
  aiAssistantHonorific String? // "", "sir", etc.
  aiAssistantSarcasm   Int     @default(0) // 0..2
}

// Phase 2
model AssistantMemory {
  id        String   @id @default(uuid())
  orgId     String
  kind      String   // fact | preference | note
  content   String
  embedding Unsupported("vector(1536)")? // pgvector
  createdAt DateTime @default(now())
  @@index([orgId])
}
```

## 7. Infra & models (DigitalOcean + Ollama) — recommendation

Vultrix's hosted assistant currently targets Ollama (`llama3.1:8b`), which is a
weak/slow tool-caller. Recommendation (verify latest at build time):

- **Host Ollama on a DigitalOcean GPU droplet** (private network / Tailscale or
  VPC; not public). Keep the model **env-configurable** (`OLLAMA_HOST`,
  `OLLAMA_MODEL`) so upgrades are a config change.
- **Default hosted model:** **`qwen2.5:14b-instruct`** (≈16 GB VRAM at q4) — best
  quality-to-VRAM for tool/function calling on a single mid-range GPU.
  - Budget/smaller GPU: `qwen2.5:7b-instruct` (≈8 GB).
  - Scale-up ceiling: `qwen2.5:32b` (24 GB) → `llama3.3:70b` (48 GB+).
- **BYO keys stay first-class:** users can select OpenAI/Anthropic and paste a key
  (`aiAssistantProvider` + `aiAssistantApiKeyEncrypted`) for top-tier quality with
  no shared-infra cost to us.
- Keep `providers.ts` as the single abstraction so model/host swaps never touch
  feature code.
- Ops: health-check the Ollama endpoint, set request timeouts, and fall back to a
  friendly "assistant is busy" message on cold starts.

## 8. Security & privacy
- Encrypt all per-user secrets (reuse `aiAssistantApiKeyEncrypted` approach).
- Memory and chat content are per-user; never logged in plaintext to shared logs.
- Ollama endpoint on a private network, never public.
- Persona config cannot leak another tenant's data (all queries org-scoped).

## 9. Billing tie-in
No new billing needed for Slice 1 — persona/tone rides on the **existing** AI
add-on (+$10/mo) or BYO-key entitlement. Memory/tools (Phases 2–3) may later
justify positioning as "premium AI", TBD.

## 10. First-slice implementation checklist (when we start Phase 1)
- [ ] Prisma: add `aiAssistantPersona` (+ optional tone/honorific/sarcasm),
      migration with safe defaults.
- [ ] `buildSystemPrompt()`: branch on persona → genericized butler prompt.
- [ ] Settings UI: persona picker + live preview + name field (exists) + dials.
- [ ] Unit tests for prompt assembly; chat smoke test.
- [ ] Verify STANDARD persona output is byte-identical to today (no regressions).
- [ ] Screenshot review of the settings + a butler-mode chat.

## 11. Open questions (revisit before Phase 1)
1. Default persona for **new** personal users — keep `STANDARD`, or suggest
   "Alfred/Butler" as the friendly default?
2. Should the butler persona be available on **BYO-key** users too, or only the
   paid hosted add-on? (Recommend: available to both — it's just a prompt.)
3. Naming: ship as "Alfred" by default, or a neutral name the user renames? (The
   `aiAssistantName` field already supports any name.)
4. Do we want the Nightfall-style alt persona at all in the SaaS (as an opt-in
   easter egg), or drop it entirely?
