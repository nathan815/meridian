# Meridian

Meridian is a local-first Chrome new tab extension with world clocks, pinned sites, browser-history search, Copilot prompts, generated backgrounds, break reminders, WorkIQ briefing snapshots, and work-time analysis.

## Install from source

1. Clone this repository.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Choose **Load unpacked** and select the repository folder.

All settings and work-time records stay in the browser profile. Bookmark and history access are optional and requested only when you enable those sources.

## Optional local briefing

Meridian starts with safe empty states. To populate the Copilot briefing, Upcoming, and Pull requests panels, create an ignored `briefing.json` file in the extension directory using this shape:

```json
{
  "updated": "2026-01-01T12:00:00Z",
  "art": {
    "date": "2026-01-01",
    "style": "contours",
    "seed": 1,
    "palette": 0,
    "events": 0,
    "prs": 0,
    "actions": 0
  },
  "actions": {
    "generatedAt": "2026-01-01T12:00:00Z",
    "focus": "",
    "items": []
  },
  "agenda": {
    "items": []
  },
  "prs": {
    "items": []
  }
}
```

The snapshot file is intentionally excluded from Git so personal calendar and repository data cannot be committed accidentally.

## Development

Run the tests with:

```powershell
node --test *.test.cjs
```

## License

MIT © nathan815
