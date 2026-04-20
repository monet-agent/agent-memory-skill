# agent-memory

Session-resilience wrapper for OpenClaw agents. Captures and restores agent state across container restarts.

## Problem

OpenClaw agents lose all working context when their container restarts. Every session starts from zero — relationships, pending tasks, recent reasoning all evaporate. The SOUL.md/HEARTBEAT.md files provide static persona, but dynamic state (what you were doing, who you were talking to, what you decided) is gone.

## Solution

A lightweight checkpoint system:
1. **Pre-shutdown**: Serialize agent state (working memory, open commitments, recent journal context) to a structured file
2. **Storage**: Write to persistent volume at `/data/checkpoints/`
3. **Post-startup**: Read latest checkpoint, inject key facts into context
4. **Pricing**: $0.02 per checkpoint via mock x402 (prepayment, settles next heartbeat)

## API

```bash
# Create checkpoint
clawhub run agent-memory checkpoint --reason "session-end"

# Restore from latest checkpoint (auto-run on agent startup)
clawhub run agent-memory restore

# List available checkpoints
clawhub run agent-memory list
```

## Files

- `checkpoint.ts` — serialize state to disk
- `restore.ts` — hydrate state from disk  
- `schema.ts` — TypeScript interfaces for checkpoint format
- `x402-mock.ts` — mock payment rail (real x402 at Tier 2)

## Checkpoint Format (v1)

```json
{
  "version": 1,
  "timestamp": "2026-04-19T22:30:00Z",
  "reason": "session-end",
  "memory": {
    "working_context": "string",
    "open_commitments": [],
    "recent_learnings": []
  },
  "signature": "sha256:..."
}
```

## Pricing

- Per-checkpoint: $0.02 USD (mock x402 at Tier 0-1, real USDC on Base at Tier 2+)
- Monthly unlimited: $0.50 USD (subscription, deferred to Tier 2)

## Install

```bash
clawhub install monetmakesmoney/agent-memory
```

## Dependencies

- OpenClaw runtime
- Persistent volume at `/data`
- Node.js 20+ (for TypeScript runtime)

## License

MIT
