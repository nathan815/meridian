---
name: meridian-generate-briefing
description: Populate or refresh Meridian briefing data from the user's work context. Use when asked to update the briefing, find action items, summarize upcoming work, or collect relevant messages, email, calendar events, and pull requests for Meridian.
---

# Populate the Meridian briefing

Build a concise briefing from sources the user has authorized and that are available in the current environment.

## Gather

- Search the user's work messages and work email for recent commitments, requests, decisions, and follow-ups. Teams or Slack and Outlook or Gmail are examples, not required integrations.
- When WorkIQ is available, it can search Teams messages and Outlook email; do not require it or assume it is configured.
- Use available calendar and pull request sources for agenda and PR sections.
- Prefer evidence-backed actions with a stable source identifier. Reuse an existing action ID when the same commitment reappears.
- Do not read live accounts unless the user requested a refresh and the relevant tools are authorized.

## Update safely

Do not hand-edit `briefing.json` or reconstruct the full document.

1. Inspect only the section you need: `node .github/skills/meridian-generate-briefing/scripts/briefing-tool.cjs inspect actions --file <path-to-briefing.json>`.
2. Write a temporary JSON patch containing one or more top-level sections: `actions`, `agenda`, or `prs`. Include complete `items` for `agenda` or `prs`; action items are merged by `id`.
3. Apply it with `node .github/skills/meridian-generate-briefing/scripts/briefing-tool.cjs apply <patch.json> --file <path-to-briefing.json>`.
4. Remove the temporary patch after a successful apply.

The apply command validates the resulting briefing before an atomic replacement. It preserves untouched sections, completed action history, and stable action IDs. Put action items in priority order; omitted existing items remain after the proposed items. A non-empty `actions.note` keeps the previous successful `generatedAt` timestamp.

Meridian dismissals are honored automatically from the local feedback helper's default file. Use `--feedback <path>` only when the feedback file is stored elsewhere.

## Patch example

```json
{
  "actions": {
    "focus": "Follow up on the release decision.",
    "items": [
      {
        "id": "release-follow-up-2026-11-20",
        "title": "Confirm the release owner",
        "context": "The launch thread has an unresolved owner.",
        "source": "Work message",
        "url": "https://example.invalid/message"
      }
    ]
  }
}
```

Use synthetic values in tests and documentation. Never place private briefing data in the repository.
