# Saffi × OurPai.ai (PAI)

This directory contains the integration layer that makes Saffi run on **OurPai.ai (PAI)** as its brain.

## Architecture

- **PAI (OurPai.ai)** = Saffi's core brain (memory, context/TELOS, skills, hooks, agent orchestration)
- **xAI (Grok)** = One of the engines PAI can use
- **PractiVault** = The business data layer + tools exposed as PAI Skills + UI surfaces

## Installation

The official way to install PAI:

```bash
curl -sSL https://ourpai.ai/install.sh | bash
```

## Skills

All PractiVault business capabilities should eventually be exposed as clean **PAI Skills** in the `skills/` folder.

Current direction:
- Every major action (create quote, create booking, send message, generate social post, etc.) becomes a Skill.
- Skills are well-described, take clear parameters, and return structured output.
- PAI decides when and how to use them.

## Memory & Context

We are evolving `safiMemory.ts` toward PAI's model:
- Hot (current session)
- Warm (recent learnings + corrections)
- Cold (long-term rules, preferences, business identity)
- Strong emphasis on turning signals into persistent rules (TELOS style)

## Status

This is the active migration path for Saffi. The long-term goal is that the heavy agentic reasoning, planning, and memory management lives in the PAI runtime, while PractiVault provides the domain-specific tools and data.
