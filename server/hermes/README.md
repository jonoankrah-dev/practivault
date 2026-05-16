# Hermes Agent

Hermes is the **self-improving autonomous brain** for PractiVault, powered by Grok.

## Current Status (Phase 1)

- Starting with **text/chat** natural language input.
- Saffi will automatically escalate certain messages to Hermes using keyword triggers.
- Hermes will return structured proposals.
- All proposals will go through **user approval** via Saffi chat before execution.

## Planned Flow (Option 1 + Hybrid)

1. User talks to Saffi normally.
2. Saffi checks if the message matches trigger keywords.
3. If yes → message is sent to Hermes for reasoning.
4. Hermes returns a proposal (what actions it wants to take).
5. Saffi shows the proposal to the user and asks for approval.
6. If approved → actions are executed using PractiVault tools.

## Future Phases

- Phase 2: Connect Hermes with **PAI (OurPai Life OS)** for long-term memory and goals.
- Improve escalation logic (beyond simple keywords).
- Allow Hermes to handle more complex multi-step workflows.
- Add self-improvement loop (Hermes learns from approved/rejected actions).

## Folder Structure

- `types.ts` → TypeScript interfaces
- `keywords.ts` → Trigger keywords for Phase 1
- `tools.ts` → Available actions Hermes can propose
- `reasoner.ts` → Core reasoning logic (mock + future real Grok call)
- `index.ts` → Public API for Hermes

## Current Status

Hermes is currently in **mock mode**. When a message is sent to it, it returns a fake but realistic proposal so we can test the full flow with Saffi.

Next milestone: Replace the mock with a real call to your Grok-powered Hermes Agent.

---

**Note**: This is still early stage. We are building the foundation first.