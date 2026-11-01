// Accuracy against the book (data/book-data.js), using the engine exactly as it runs in index.html.
// Prints residuals (page minus book, minutes) and fails if accuracy is worse than the recorded baseline.
// Update BASELINE only on purpose, when an engine change is meant to improve the fit.
const { chromium } = require("playwright");
const path = require("path");
const book = require("../data/book-data.js");

const BASELINE = { // allowed rms / max |residual| in minutes (current fit + a small margin)
  tithi: { rms: 2.2, max: 7 },
  nak: { rms: 3.5, max: 10 },
  yoga: { rms: 3.0, max: 6 },
  varj: { rms: 3.4, max: 11 },
  sunrise: { rms: 1.0, max: 2 },
};

// Book entries that disagree with every reasonable fit (likely misprints or photo-reading slips).
// They are reported but left out of the pass/fail numbers. Add to this list only with a reason.
const KNOWN_OUTLIERS = {
  tithi: ["11-10 12:56", "03-15 09:47", "11-27 14:46"], // ~42, ~26, ~19 min off; neighbours fit within 5 min
  nak: ["03-15 08:39"],                                 // ~22 min off
  varj: ["03-15 13:49", "03-15 00:56"],                 // follow from the 15 Mar nakshatra entry above
  yoga: [], sunrise: [],
};

// Abhijit lagnam = 4th lagna from the lagna at sunrise (book's rule, confirmed by the owner). Times are an engine
// snapshot at Rajahmundry (guards against regressions; the book has no lagna table transcribed yet):
// [year, month, day, rashi index, start, end]
const ABHIJIT_LAGNA = [
  [2026, 11, 1, 9, "11:32", "13:23"],  // Sun Tula -> Makara
  [2026, 12, 15, 10, "10:29", "12:07"], // Vrischika -> Kumbha
  [2027, 1, 15, 0, "11:40", "13:25"],  // Makara -> Mesha
  [2027, 4, 11, 2, "09:47", "12:00"],  // Meena -> Mithuna
  [2027, 6, 21, 5, "11:41", "13:46"],  // Mithuna -> Kanya
  [2027, 9, 1, 7, "11:14", "13:28"],   // Simha -> Vrischika
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Block web fonts so the test runs offline and fast
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto("file://" + path.join(__dirname, "..", "index.html"));
  const { out: res, lagna: lagnaRes } = await page.evaluate((B) => {
    const H = 3600e3;
    const endNear = (fn, count, t, i) => {
      const segs = PJ.segments(fn, t - 36 * H, t + 36 * H, count).filter((s) => s.index === i);
      if (!segs.length) return null;
      return segs.map((s) => (s.end - t) / 60000).sort((a, b) => Math.abs(a) - Math.abs(b))[0];
    };
    const out = {};
    out.tithi = B.tithi.map((x) => ({ label: x.label, d: endNear(PJ.tithiPos, 30, x.t, x.i) }));
    out.nak = B.nak.map((x) => ({ label: x.label, d: endNear(PJ.nakPos, 27, x.t, x.i) }));
    out.yoga = B.yoga.map((x) => ({ label: x.label, d: endNear(yogaPos, 27, x.t, x.i) }));
    out.varj = B.varj.map((x) => {
      const v = PJ.segments(PJ.nakPos, x.t - 60 * H, x.t + 36 * H, 27).flatMap(PJ.varjyam);
      const d = v.map((y) => (y.start - x.t) / 60000).sort((a, b) => Math.abs(a) - Math.abs(b))[0];
      return { label: x.label, d };
    });
    out.sunrise = B.sun.map((x) => {
      const ev = PJ.sunEvents(x.y, x.m, x.d, REF.lat, REF.lon);
      return { label: x.label, d: Math.round((ev.rise - x.rise) / 60000) };
    });
    // Lagna: at sunrise it must sit on the Sun (largest gap over the book's sunrise days, degrees);
    // the book's note gives Vrishabha lagnam at 8.40 on 11 Apr 2027 at Rajahmundry
    const sunGap = Math.max(...B.sun.map((x) => {
      const t = PJ.sunEvents(x.y, x.m, x.d, REF.lat, REF.lon).rise, g = Math.abs(PJ.lagna(t, REF.lat, REF.lon) - PJ.longitudes(t).sun);
      return Math.min(g, 360 - g);
    }));
    const apr11 = Math.floor(PJ.lagna(Date.UTC(2027, 3, 11, 8, 40) - IST * 60000, REF.lat, REF.lon) / 30);
    // Abhijit lagnam (book rule): 4th lagna from the sunrise lagna, full rising period, Rajahmundry, offset 0
    const abh = B.abh.map(([y, m, d]) => {
      const base = istMidnight(y, m, d), ev = PJ.sunEvents(y, m, d, REF.lat, REF.lon);
      const x = dayAbhijit(base, (ev.rise - base) / 60000, (ev.set - base) / 60000, 0).lagna;
      return { label: `${y}-${m}-${d}`, index: x.index, start: (x.start - base) / 60000, end: (x.end - base) / 60000 };
    });
    // Every day for a year: rashi = Sun's rashi at sunrise + 3, and a daytime rising period
    const yearBad = [];
    for (let i = 0; i < 365; i++) {
      const p = istParts(Date.UTC(2026, 10, 1, 12) + i * 86400000), base = istMidnight(p.Y, p.M, p.D), ev = PJ.sunEvents(p.Y, p.M, p.D, REF.lat, REF.lon);
      const x = dayAbhijit(base, (ev.rise - base) / 60000, (ev.set - base) / 60000, 0).lagna;
      const want = (Math.floor(PJ.longitudes(ev.rise).sun / 30) + 3) % 12;
      if (x.index !== want || !(x.start < x.end) || !(x.start < ev.set && x.end > ev.rise)) yearBad.push(isoDate(p));
    }
    return { out, lagna: { sunGap, apr11, abh, yearBad } };
  }, { tithi: book.tithi, nak: book.nak, yoga: book.yoga, varj: book.varj, sun: book.sun, abh: ABHIJIT_LAGNA.map((x) => x.slice(0, 3)) });
  await browser.close();
  let fail = errors.length > 0;
  if (errors.length) console.error("Page errors:", errors);
  const lagnaOk = lagnaRes.sunGap < 0.05 && lagnaRes.apr11 === 1;
  if (!lagnaOk) fail = true;
  console.log(`${lagnaOk ? "PASS" : "FAIL"} lagna    at sunrise within ${lagnaRes.sunGap.toFixed(3)}° of the Sun; 11 Apr 2027 8.40 = rashi ${lagnaRes.apr11} (book: 1, Vrishabha)`);
  // Abhijit lagnam: rashi must match, start/end within 2 min of the expected values
  const abhBad = [];
  lagnaRes.abh.forEach((x, i) => {
    const [, , , rashi, s, e] = ABHIJIT_LAGNA[i], hm = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
    const ds = Math.abs(x.start - hm(s)), de = Math.abs(x.end - hm(e));
    if (x.index !== rashi || !(ds <= 2) || !(de <= 2)) abhBad.push(`${x.label}: rashi ${x.index} (want ${rashi}), start ${ds.toFixed(1)}, end ${de.toFixed(1)} min off`);
  });
  lagnaRes.yearBad.forEach((d) => abhBad.push(`${d}: wrong rashi or no daytime rising period`));
  if (abhBad.length) fail = true;
  console.log(`${abhBad.length ? "FAIL" : "PASS"} abhLagna ${ABHIJIT_LAGNA.length} dates + 365-day scan, 4th lagna from sunrise lagna, start/end within 2 min${abhBad.length ? ": " + abhBad.join("; ") : ""}`);
  for (let [k, list] of Object.entries(res)) {
    if (process.env.VERBOSE) console.log(k, list.slice().sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 6).map((x) => x.label + " " + x.d.toFixed(1)).join(", "));
    const skipped = list.filter((x) => KNOWN_OUTLIERS[k].includes(x.label));
    list = list.filter((x) => !KNOWN_OUTLIERS[k].includes(x.label));
    const ds = list.map((x) => x.d).filter((d) => d !== null);
    const missing = list.length - ds.length;
    const rms = Math.sqrt(ds.reduce((s, d) => s + d * d, 0) / ds.length);
    const worst = list.filter((x) => x.d !== null).sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
    const max = Math.abs(worst.d);
    const ok = rms <= BASELINE[k].rms && max <= BASELINE[k].max && missing === 0;
    if (!ok) fail = true;
    console.log(`${ok ? "PASS" : "FAIL"} ${k.padEnd(8)} n=${ds.length} rms ${rms.toFixed(2)} min, max ${max.toFixed(1)} min (${worst.label})${missing ? `, ${missing} not found` : ""}${skipped.length ? `, ${skipped.length} known outliers skipped (${skipped.map((x) => x.label + " " + x.d.toFixed(0)).join("; ")})` : ""}  [limit rms ${BASELINE[k].rms}, max ${BASELINE[k].max}]`);
  }
  process.exit(fail ? 1 : 0);
})();
