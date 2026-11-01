# Panchangam - Hora Chakram

A Telugu panchangam and daily hora chart, calculated in the browser to match a Rajahmundry panchangam book. Live on GitHub Pages from `index.html`.

## Working on it

```
npm install
npx playwright install chromium
npm run build      # src/hora-chart.html -> index.html
npm test           # build check, accuracy vs the book, UI and paste tests
```

Edit `src/hora-chart.html`, never `index.html`. Project rules for people and for Claude are in [CLAUDE.md](CLAUDE.md).

## Claude Code agents

Defined in `.claude/agents/`:

| Agent | Use it for |
|---|---|
| `panchang-calc` | Any calculation: tithi, nakshatra, yogam, karanam, varjyam, Rahu kalam, moudhyam, offsets |
| `telugu-ui` | Layout, styling, Telugu/English wording, mobile and desktop |
| `qa-tester` | Independent testing and screenshot review after a change (reports, does not fix) |
| `release` | Build, test, commit and push to the live site |

Open the folder in Claude Code (`claude`), then describe the change. Claude picks the right agent, or name one: "Use the qa-tester agent to check the 10-day section on mobile", or type `@` and choose it.
