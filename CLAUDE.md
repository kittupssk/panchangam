# Panchangam - Hora Chakram

A single-page Telugu panchangam and daily hora chart, served by GitHub Pages from `index.html`.
Owner: Krishna. Users read it mostly in Telugu, often on phones.

## Files

| Path | What it is |
|---|---|
| `src/hora-chart.html` | **The source. Edit this.** Page body: styles, markup, the calculation engine (script 1, `PJ`) and the app (script 2). |
| `index.html` | **Built file. Never edit by hand.** `npm run build` wraps `src/hora-chart.html` in a full HTML document. GitHub Pages serves it. |
| `data/book-data.js` | Times transcribed from the reference book (30 Oct 2026 – 7 Apr 2027): tithi, nakshatra, yogam end times, varjyam starts, sunrise/sunset. |
| `data/book-pages/` | Photos of the book pages the data came from. Check these when a book value looks wrong. |
| `tests/` | `accuracy.js` (engine vs book), `ui.js` (layout/behaviour on desktop, phone, phone sideways, te/en), `paste.js` (WhatsApp paste). |
| `tools/build.js` | Build / `--check` that `index.html` matches the source. |
| `tools/moodham-gen.js` | Regenerates the Guru/Sukra moudhyam table (uses `astronomy-engine`). |

## Commands

```
npm install && npx playwright install chromium   # once
npm run build        # src/hora-chart.html -> index.html
npm test             # build check + accuracy + UI + paste; must pass before any commit
```
Screenshots from `npm run test:ui` land in `test-output/` (git-ignored). Look at them after any visual change.

## The reference: the book wins

- The reference is a Telugu panchangam book for **Rajahmundry** (lat 17.50, lon 82.45). When the WhatsApp channel and the book differ, **follow the book**.
- The engine is Surya Siddhanta with constants fitted to the book (`MOON_FIX`, `SUN_FIX`, `EOT_K`, `SHIFT_MIN` …). Do not change them without running `npm run test:accuracy` before and after, and only keep a change that improves it.
- Current fit (page minus book): tithi rms ≈1.8 min, nakshatra ≈3.0, varjyam ≈2.9, yogam ≈2.3, sunrise ≈0.8. A few book entries are known outliers (listed in `tests/accuracy.js` with reasons).
- Sunrise/sunset: Sun's centre, no refraction, at Rajahmundry.
- Varjyam and Amrutakalam: start ghati tables per nakshatra, 4 ghatis long (tables in the source; verified against the book).
- Durmuhurtham, Rahu kalam, Yamagandam: from **actual sunrise to sunset** (day in 8 parts for Rahu/Yama). Not the 6 AM–6 PM convention the channel uses. Pasted Rahu/Yama values are ignored on purpose.
- Abhijit muhurtham: 8th of the 15 day muhurtas (sunrise to sunset). Abhijit lagnam: the rashi rising during it, worked out at Rajahmundry (ascendant from sidereal time; ayanamsa = modern tropical Sun − engine Sun, so lagna at sunrise = Sun). The town offset moves both, as the book does for muhurtham lagnas. Not yet checked against a book lagna table (only the 11 Apr 2027 Vrishabha example in the book's note).
- Moudhyam: Guru within 11° of the Sun; Sukra within 10° (8° while retrograde). Precomputed table 2025–2040 from modern positions (may differ from the book by about a day).
- Masam is amanta, named by the rashi the Sun enters; samvatsaram changes at Ugadi.

## Town offset (desantara)

- Towns table follows the book: "+" means earlier, "−" later; local time = Rajahmundry time − offset. Default town Hyderabad.
- The offset applies to sunrise, sunset, horas, durmuhurtham, Rahu kalam, Yamagandam, Abhijit muhurtham and lagnam.
- It does **not** apply to tithi, nakshatra, varjyam, amrutakalam, yogam, karanam (they are the same instant everywhere) unless the user ticks the "apply to all" box.
- The day is the **town's** sunrise to its next sunrise (`dayWindow`): it decides which tithis, nakshatras, yogams, karanams, varjyams and amrutakalams are listed for a date, the taras, the masam/paksham line and the green bars. With "apply to all" ticked the shown times already move by the offset, so the real window stays Rajahmundry's.
- Sunrise/sunset for a town = Rajahmundry's minus the offset (the book's method), not calculated from the town's latitude.

## Hora

- Day hora = (sunset − sunrise)/12; night hora = (next sunrise − sunset)/12. First hora lord = weekday lord, then Chaldean order: Surya, Sukra, Budha, Chandra, Sani, Guru, Kuja.
- Lord labels: Telugu first syllable; English two letters (Sk for Sukra). Guru/Sukra green, Sani/Kuja red.
- Good times (green bars) use the user's rules from "శుభ సమయాల నియమాలు" (saved per device, take effect only on **Apply**). Defaults: Guru/Sukra/Budha/Chandra hora; no durmuhurtham or varjyam; tithi 2,3,5,7,10,11,13 of both pakshas + Shukla Chaturdashi, Purnima, Bahula Padyami; tara 2,4,6,8,9 when a janma nakshatra is set; windows ≥ 5 min.

## Telugu text conventions (follow the book everywhere)

- Time prefixes ఉ. / ప. / సా. / రా. / తె., time as h.mm, a space after the prefix: `ఉ. 6.15`.
- Ranges use ల with spaces: `ఉ. 6.15 ల 7.46`. Next day: ` (+1)` with a space before it.
- హోర (short ఓ), not హోరా — but keep హోరాధిపతి.
- No AM/PM in Telugu. English uses `06:15 AM`.
- No good/bad words (మంచిది/చెడ్డది) in the hora tables. Never mention the book's publisher name on the page.
- Every user-visible string exists in both `I18N.te` and `I18N.en`. English is a translation of the Telugu, not a separate wording.

## Layout rules

- Dark theme only. Default date = today. Telugu is the default language.
- Panchangam: two columns on wide screens (main details left; yogam, karanam, Rahu kalam, Yamagandam, rashis, Abhijit, moudhyam right), one column on phones.
- Main hora band and 10-day bands are the same size. On upright phones they scroll sideways and start at the current time. Phones held sideways (`html.land-phone`, set from the real screen orientation) show the band first and taller.
- 10-day day card (tooltip): line 1 date · day · sunrise/sunset; line 2 samvatsaram · ayanam · rutuvu · masam · paksham (each item kept on one line); then tithi, nakshatra and the other rows.
- Tarabalam: a day can have 2–3 taras; the one running now is highlighted with a ఇప్పుడు / Now chip (panel and today's 10-day card). "Now" is inside the day from the town's sunrise to the next town sunrise.
- No horizontal scrolling of the page itself at 390 px width.
- The page is also published as a Claude artifact, where the frame grows to full height and blocks geolocation, so never rely on scrolling inside the page or on media queries for orientation.

## How to work

1. Edit `src/hora-chart.html` only. Keep changes small and in the style of the surrounding code.
2. `npm run build`, then `npm test`. Fix anything that fails. Look at the screenshots for visual changes.
3. Commit with a clear message. `index.html` and `src/hora-chart.html` are always committed together.
4. When a rule above changes, update this file in the same commit.
