# Hermes — The Agentic Brain

Hermes is the **high-level reasoning engine** for PractiVault.

It understands natural language updates from practitioners (e.g. "Just finished the boiler repair at 123 Main St, used 2 valves and 1 pump, customer was happy") and proposes structured actions that Saffi then presents for user approval.

## Current Architecture (Clean Modular Structure)

```
server/hermes/
├── index.ts                 ← Public API (only file Saffi should import)
├── config.ts                ← Feature flags & settings
├── types.ts                 ← All TypeScript interfaces
├── prompts.ts               ← System prompts for future real Grok calls
├── keywords/
│   └── index.ts             ← Keyword lists + quick detection
├── tools/
│   └── index.ts             ← Tool definitions (function calling format)
├── core/
│   └── reasoner.ts          ← The actual reasoning logic (mock today)
├── test/
│   └── test-hermes.ts       ← Manual test runner
└── README.md
```

## Public API (What Saffi Uses)

```ts
import { shouldEscalateToHermes, sendToHermes } from "./hermes";

if (shouldEscalateToHermes(userMessage)) {
  const response = await sendToHermes(userMessage, context);
  // response contains proposal or directReply
}
```

## Current Status (Phase 1)

- Uses a strong **advanced mock reasoner** (no real Grok call yet)
- Hybrid escalation: Saffi uses fast keyword check → Hermes does deeper reasoning
- Returns structured `HermesProposal` with `actions[]`
- All high-impact actions require explicit user approval via Saffi

## Running Tests

```bash
npx tsx server/hermes/test/test-hermes.ts
```

## Next Steps (Roadmap)

1. Improve the mock reasoner with better endoPulse/aesthetics treatment understanding
2. Connect to real Grok (via xAI API or your Hermes Agent)
3. Add proper action execution layer (after approval)
4. Phase 2: Integrate with PAI (OurPai.ai) for long-term memory & goals

---

**Goal**: Hermes becomes the intelligent "operator brain" that makes PractiVault feel magical while Saffi stays the friendly face.
