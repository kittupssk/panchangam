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
const FIELDS = ["pDate", "pVara", "pSr", "pSs", "pTithi", "pNak", "pVarj", "pDur", "pYoga", "pKarana", "pRahu", "pYama", "pSunRasi", "pMoonRasi", "pMoodh"];
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
    await ctx.close();
  }
  await browser.close();
  console.log(failures ? `${failures} UI check(s) failed` : "All UI checks passed");
  process.exit(failures ? 1 : 0);
})();
