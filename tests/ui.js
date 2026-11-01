// UI checks on desktop, phone (upright) and phone (sideways), in Telugu and English.
// Saves screenshots to test-output/ for a human look. Exit code 1 on any failure.
const { chromium } = require("playwright");
const path = require("path"), fs = require("fs");
const URL = "file://" + path.join(__dirname, "..", "index.html");
const OUT = path.join(__dirname, "..", "test-output");
fs.mkdirSync(OUT, { recursive: true });

const VIEWS = [
  { name: "desktop", viewport: { width: 1280, height: 900 } },
  { name: "phone", viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { name: "phone-sideways", viewport: { width: 844, height: 390 }, screen: { width: 844, height: 390 }, isMobile: true, hasTouch: true },
];
const FIELDS = ["pDate", "pVara", "pSr", "pSs", "pTithi", "pNak", "pVarj", "pDur", "pYoga", "pKarana", "pRahu", "pYama", "pAbhijit", "pAbhLagna", "pSunRasi", "pMoonRasi", "pMoodh"];
let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log("  FAIL " + msg); } };

(async () => {
  const browser = await chromium.launch();
  for (const v of VIEWS) for (const lang of ["te", "en"]) {
    const ctx = await browser.newContext({ ...v, timezoneId: "Asia/Kolkata" });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.addInitScript((l) => { try { localStorage.clear(); localStorage.setItem("hora-lang", l); localStorage.setItem("hora-place", JSON.stringify({ city: 0, offset: 0 })); } catch (e) {} }, lang);
    await page.goto(URL);
    await page.fill("#date", "2026-10-31");
    await page.dispatchEvent("#date", "input");
    await page.waitForTimeout(200);
    console.log(`${v.name} / ${lang}`);
    const s = await page.evaluate((F) => ({
      empty: F.filter((id) => !document.getElementById(id) || !document.getElementById(id).innerText.trim()),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      band: document.querySelectorAll("#band > div").length,
      dayRows: document.querySelectorAll("#dayTbl tbody tr").length,
      nightRows: document.querySelectorAll("#nightTbl tbody tr").length,
      cols: ["dayTbl", "nightTbl"].map((id) => [...document.querySelectorAll(`#${id} th`)].map((t) => Math.round(t.getBoundingClientRect().left)).join(",")),
      cellOverflow: [...document.querySelectorAll("#dayTbl td, #nightTbl td")].filter((td) => td.offsetParent && td.scrollWidth > td.clientWidth + 1).length,
      vara: document.getElementById("pVara").innerText,
      panch: document.querySelector(".panel.panch").innerText,
      title: document.querySelector("h1").innerText,
    }), FIELDS);
    check(errors.length === 0, "page errors: " + errors.join(" | "));
    check(s.empty.length === 0, "empty panchangam rows: " + s.empty.join(", "));
    check(s.overflow <= 1, `page scrolls sideways by ${s.overflow}px`);
    check(s.band === 24, `hora band has ${s.band} segments, expected 24`);
    check(s.dayRows === 12 && s.nightRows === 12, `hora tables have ${s.dayRows}/${s.nightRows} rows`);
    check(s.cols[0] === s.cols[1], `day and night table columns not aligned: ${s.cols.join(" vs ")}`);
    check(s.cellOverflow === 0, `${s.cellOverflow} hora table cells are cut off`);
    check(s.vara.includes(lang === "te" ? "శనివారం" : "Sanivara"), "31-10-2026 should be Saturday: " + s.vara);
    if (lang === "te") check(!/\b(AM|PM)\b/.test(s.panch), "Telugu panchangam shows AM/PM");
    check(s.title === (lang === "te" ? "పంచాంగం - హోర చక్రం" : "Panchangam - Hora Chakram"), "title: " + s.title);
    // 10-day section
    await page.evaluate(() => { const d = document.getElementById("daysRef"); d.open = true; d.dispatchEvent(new Event("toggle")); });
    await page.waitForTimeout(200);
    const rows = await page.evaluate(() => document.querySelectorAll("#daysBody .drow").length);
    check(rows === 10, `10-day section has ${rows} rows`);
    // Good-time rules: nothing changes until Apply
    await page.evaluate(() => { document.getElementById("goodRef").open = true; });
    const bars = () => page.evaluate(() => document.querySelectorAll("#gtrack .gbar").length);
    const before = await bars();
    await page.click('#goodSet [data-all="hora"]');
    check((await bars()) === before, "good-time bars changed before Apply");
    await page.click("#goodApply");
    check((await bars()) >= before, "Apply with all horas should not reduce good times");
    await page.click("#goodReset"); await page.click("#goodApply");
    check((await bars()) === before, "Default rules + Apply should restore the original bars");
    await page.screenshot({ path: path.join(OUT, `${v.name}-${lang}.png`), fullPage: true });
    // Current tara: with a janma nakshatra and the current Hindu day, exactly one tara is marked
    await page.selectOption("#janma", "0");
    await page.evaluate(() => jumpToNow());
    await page.waitForTimeout(200);
    const t = await page.evaluate(() => ({
      items: document.querySelectorAll("#taraBody .tara-item").length,
      cur: document.querySelectorAll("#taraBody .tara-item.cur").length,
      chip: document.querySelectorAll("#taraBody .tara-item.cur .chip.live").length,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    }));
    check(t.cur === 1 && t.chip === 1, `current tara: ${t.cur} marked (${t.chip} now chips) of ${t.items} items, expected exactly 1`);
    check(t.overflow <= 1, `page scrolls sideways by ${t.overflow}px with janma set`);
    // 10-day card for today: one now chip in its tara row when today's sunrise has passed (after jumpToNow, the date is then today)
    const d = await page.evaluate(() => {
      const tip = document.querySelector("#daysBody .drow .dlabel").dataset.tip, box = document.createElement("div");
      box.innerHTML = tip;
      const tara = [...box.querySelectorAll(".day-row")].find((r) => r.querySelector(".k").textContent === L().taraTitle);
      const sd = systemDate();
      return { chips: tara ? tara.querySelectorAll(".chip.live").length : -1, isToday: document.getElementById("date").value === isoDate(sd) };
    });
    check(d.isToday ? d.chips === 1 : d.chips <= 1, `10-day card for today has ${d.chips} tara now chips`);
    await page.locator("#taraBody").locator("..").screenshot({ path: path.join(OUT, `${v.name}-${lang}-tara.png`) });
    // Today's 10-day card (shown as a tooltip) with its tara now chip
    await page.locator("#daysBody .drow .dlabel").first().click();
    await page.waitForTimeout(150);
    const tip = page.locator("#daysBody .gtip");
    if (await tip.isVisible()) await tip.screenshot({ path: path.join(OUT, `${v.name}-${lang}-today-card.png`) });
    await page.keyboard.press("Escape");
    // A past date: nothing is marked
    await page.fill("#date", "2026-10-31");
    await page.dispatchEvent("#date", "input");
    await page.waitForTimeout(100);
    const past = await page.evaluate(() => document.querySelectorAll("#taraBody .tara-item.cur, #taraBody .chip.live").length);
    check(past === 0, `tara marked as current on a past date (${past})`);
    await ctx.close();
  }
  // Current tara at fixed times (fake clock), desktop, default town Hyderabad, janma Ashwini.
  // 1 Nov 2026: Punarvasu ends 10.32 (book time); with "apply to all" the shown end moves to 10.45.
  // At 06.08 Hyderabad's sunrise (06.15) has not come, so the page opens 31 Oct, still in Punarvasu.
  console.log("current tara (fixed clock)");
  for (const [hm, adj, want, wantDate] of [["10:31", false, "పునర్వసు"], ["10:33", false, "పుష్యమి"], ["10:44", true, "పునర్వసు"], ["10:46", true, "పుష్యమి"], ["06:08", false, "పునర్వసు", "2026-10-31"]]) {
    const ctx = await browser.newContext({ ...VIEWS[0], timezoneId: "Asia/Kolkata" }), page = await ctx.newPage();
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.clock.install({ time: new Date(`2026-11-01T${hm}:00+05:30`) });
    await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
    await page.goto(URL);
    await page.selectOption("#janma", "0");
    if (adj) await page.check("#adjAll");
    if (wantDate) await page.evaluate(() => jumpToNow());
    const got = await page.evaluate(() => ({
      date: document.getElementById("date").value,
      names: [...document.querySelectorAll("#taraBody .tara-item.cur .tara-top > b:first-child")].map((b) => b.textContent),
    }));
    if (wantDate) check(got.date === wantDate, `jumpToNow at ${hm} chose ${got.date}, expected ${wantDate}`);
    check(got.names.length === 1 && got.names[0] === want, `current tara at ${hm}${adj ? " (apply to all)" : ""}: ${got.names.join(", ") || "none"}, expected ${want}`);
    await ctx.close();
  }
  // The day runs from the town's sunrise. Chitta ends about 06.06 on 8 Nov 2026: after Rajahmundry's
  // sunrise (06.04) but before Hyderabad's (06.17), so for Hyderabad it belongs to 7 Nov's day.
  // With "apply to all" the shown times move by the offset, so the Rajahmundry day is kept.
  console.log("town day window");
  for (const [place, date, adj, want] of [[null, "2026-11-08", false, false], [null, "2026-11-07", false, true], [{ city: 0, offset: 0 }, "2026-11-08", false, true], [null, "2026-11-08", true, true]]) {
    const ctx = await browser.newContext({ ...VIEWS[0], timezoneId: "Asia/Kolkata" }), page = await ctx.newPage();
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.addInitScript((p) => { try { localStorage.clear(); if (p) localStorage.setItem("hora-place", JSON.stringify(p)); } catch (e) {} }, place);
    await page.goto(URL);
    if (adj) await page.check("#adjAll");
    await page.fill("#date", date);
    await page.dispatchEvent("#date", "input");
    await page.waitForTimeout(100);
    const naks = await page.textContent("#pNak");
    const where = `${place ? "Rajahmundry" : "Hyderabad"} ${date}${adj ? " (apply to all)" : ""}`;
    check(naks.includes("చిత్త") === want, `${where}: Chitta ${want ? "missing from" : "listed in"} the nakshatra list (${naks.trim()})`);
    await ctx.close();
  }
  await browser.close();
  console.log(failures ? `${failures} UI check(s) failed` : "All UI checks passed");
  process.exit(failures ? 1 : 0);
})();
