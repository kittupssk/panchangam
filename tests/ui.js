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
    // Day card: the calendar line (samvatsaram · ayanam · rutuvu · masam · paksham) comes right after the head, once
    const samvWord = lang === "te" ? "నామ సంవత్సరం" : "samvatsaram";
    const cards = await page.evaluate((w) => [...document.querySelectorAll("#daysBody .drow")].map((r) => {
      const box = document.createElement("div");
      box.innerHTML = r.querySelector(".dlabel").dataset.tip;
      const day = box.querySelector(".day"), second = day && day.children[1];
      return { second: second ? second.className : "", has: second ? second.textContent.includes(w) : false, count: day ? day.textContent.split(w).length - 1 : 0,
        same: r.querySelector(".band").dataset.tip === r.querySelector(".dlabel").dataset.tip };
    }), samvWord);
    check(cards.every((c) => c.second === "day-cal" && c.has), "10-day card: second line is not the calendar line: " + JSON.stringify(cards[0]));
    check(cards.every((c) => c.count === 1), "10-day card: samvatsaram shown more than once: " + cards.map((c) => c.count).join(","));
    check(cards.every((c) => c.same), "10-day card: day label and band show different cards");
    // Abhijit lagnam (31-10-2026, Sun in Tula): one item, Makara (4th from the sunrise lagna) with its rising period,
    // and the 10-day card's Abhijit row shows the same text
    const abl = await page.evaluate(() => { const b = document.createElement("div"), n = (s) => s.replace(/\s+/g, " ").trim();
      b.innerHTML = document.querySelector("#daysBody .drow .dlabel").dataset.tip;
      const row = [...b.querySelectorAll(".day-row")].find((r) => r.querySelector(".k").textContent === L().abhS);
      const main = document.querySelectorAll("#pAbhLagna .item");
      return { items: main.length, text: main.length ? n(main[0].querySelector("span").textContent) : "", card: row ? n(row.querySelector(".v").textContent) : "" }; });
    check(abl.items === 1 && (lang === "te" ? /^మకరం ఉ\. 11\.\d\d ల 1\.\d\d$/ : /^Makara 11:\d\d AM – 01:\d\d PM$/).test(abl.text), "Abhijit lagnam: " + JSON.stringify(abl));
    check(abl.text && abl.card.endsWith(abl.text), "10-day card Abhijit row lacks the Abhijit lagnam: " + abl.card);
    // Today's card shows the same calendar line as the panchangam (#panchCal)
    const todayIso = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
    await page.fill("#date", todayIso); await page.dispatchEvent("#date", "input"); await page.waitForTimeout(150);
    const calCmp = await page.evaluate(() => { const b = document.createElement("div"), n = (s) => s.replace(/\s+/g, " ").trim();
      b.innerHTML = document.querySelector("#daysBody .drow .dlabel").dataset.tip;
      return [n(b.querySelector(".day-cal").textContent), n(document.getElementById("panchCal").textContent)]; });
    check(calCmp[0] === calCmp[1], "today's 10-day card calendar line differs from #panchCal: " + calCmp.join(" vs "));
    await page.fill("#date", "2026-10-31"); await page.dispatchEvent("#date", "input"); await page.waitForTimeout(150);
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
    // Guidance (book pages): two headings, two tables, five list items; tables fit without the page scrolling sideways
    await page.evaluate(() => { document.getElementById("guideRef").open = true; });
    const gd = await page.evaluate(() => {
      const b = document.getElementById("guideRefBody"), W = (el) => el.getBoundingClientRect();
      return { h3: b.querySelectorAll("h3").length, tables: b.querySelectorAll("table").length, items: b.querySelectorAll("ol > li").length,
        rows: [...b.querySelectorAll("table")].map((t) => t.tBodies[0].rows.length).join(","),
        heads: [...b.querySelectorAll("th")].filter((th) => !th.offsetParent || !th.textContent.trim()).length,
        clipped: [...b.querySelectorAll(".tbl-wrap")].filter((w) => w.scrollWidth > w.clientWidth + 1).length,
        outside: [...b.querySelectorAll("table")].filter((t) => W(t).right > W(b).right + 1).length,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        noteHeads: [...document.querySelectorAll(".note .sub-h")].map((h) => getComputedStyle(h).fontWeight + "/" + getComputedStyle(h).display) };
    });
    check(gd.h3 === 2 && gd.tables === 2 && gd.items === 5 && gd.rows === "8,7", "Guidance section content: " + JSON.stringify(gd));
    check(gd.heads === 0, `Guidance tables: ${gd.heads} column headings hidden or empty`);
    check(gd.clipped === 0 && gd.outside === 0, `Guidance tables do not fit: ${gd.clipped} scroll inside, ${gd.outside} stick out`);
    check(gd.overflow <= 1, `page scrolls sideways by ${gd.overflow}px with the Guidance section open`);
    check(gd.noteHeads.length === 2 && gd.noteHeads.every((x) => x === "600/block"), "bottom note headings not bold on their own line: " + gd.noteHeads.join(" "));
    await page.locator("#guideRef").screenshot({ path: path.join(OUT, `${v.name}-${lang}-guide.png`) });
    await page.locator(".note").screenshot({ path: path.join(OUT, `${v.name}-${lang}-note.png`) });
    await page.evaluate(() => { document.getElementById("guideRef").open = false; });
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
      const row = document.querySelector("#daysBody .drow.today .dlabel");
      if (!row) return { chips: -1, isToday: true };
      const tip = row.dataset.tip, box = document.createElement("div");
      box.innerHTML = tip;
      const tara = [...box.querySelectorAll(".day-row")].find((r) => r.querySelector(".k").textContent === L().taraTitle);
      const sd = currentDay();
      return { chips: tara ? tara.querySelectorAll(".chip.live").length : -1, isToday: document.getElementById("date").value === isoDate(sd) };
    });
    check(d.isToday ? d.chips === 1 : d.chips <= 1, `10-day card for today has ${d.chips} tara now chips`);
    await page.locator("#taraBody").locator("..").screenshot({ path: path.join(OUT, `${v.name}-${lang}-tara.png`) });
    // Today's 10-day card (shown as a tooltip) with its tara now chip
    await page.locator("#daysBody .drow .dlabel").first().click();
    await page.waitForTimeout(150);
    const tip = page.locator("#daysBody .gtip");
    if (await tip.isVisible()) {
      await tip.screenshot({ path: path.join(OUT, `${v.name}-${lang}-today-card.png`) });
      const o = await page.evaluate(() => ({ second: (document.querySelector("#daysBody .gtip:not([hidden]) .day > :nth-child(2)") || {}).className,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        itemOut: (() => { const c = document.querySelector("#daysBody .gtip:not([hidden]) .day-cal"); if (!c) return -1; const r = c.getBoundingClientRect();
          return [...c.querySelectorAll(".ci")].filter((s) => s.getBoundingClientRect().right > r.right + 1).length; })() }));
      check(o.itemOut === 0, `open 10-day card: ${o.itemOut} calendar items stick out of the card`);
      check(o.second === "day-cal", "open 10-day card: second line is " + o.second);
      check(o.overflow <= 1, `page scrolls sideways by ${o.overflow}px with a 10-day card open`);
    }
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
  // 10 days start from the selected date; "today" marks only the real today (fake clock: 1 Nov 2026, noon)
  console.log("10 days from the selected date (fixed clock)");
  for (const v of [VIEWS[0], VIEWS[1]]) {
    const ctx = await browser.newContext({ ...v, timezoneId: "Asia/Kolkata" }), page = await ctx.newPage();
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.clock.install({ time: new Date("2026-11-01T12:00:00+05:30") });
    await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
    await page.goto(URL);
    await page.evaluate(() => { const d = document.getElementById("daysRef"); d.open = true; d.dispatchEvent(new Event("toggle")); });
    const state = () => page.evaluate(() => ({
      title: document.getElementById("daysTitle").textContent.replace(/\s+/g, " ").trim(),
      dates: [...document.querySelectorAll("#daysBody .drow .dlabel b")].map((b) => b.textContent),
      today: [...document.querySelectorAll("#daysBody .drow")].map((r, i) => r.classList.contains("today") ? i : -1).filter((i) => i >= 0),
      labels: [...document.querySelectorAll("#daysBody .drow .dlabel small:not(.src)")].length,
      lines: document.querySelectorAll("#daysBody .nowline").length,
      cardToday: [...document.querySelectorAll("#daysBody .drow .dlabel")].filter((el) => el.dataset.tip.includes(" · " + L().today + "</b>")).length,
      scroll: document.querySelector("#daysBody .days-scroll").scrollLeft,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    }));
    const pick = async (iso) => { await page.fill("#date", iso); await page.dispatchEvent("#date", "input"); };
    let s = await state();
    check(s.dates[0] === "01/11" && s.dates.length === 10 && s.today.join() === "0" && s.labels === 1 && s.lines === 1 && s.cardToday === 1,
      `${v.name} default: 10 days should start today (01/11) with today on row 1: ${JSON.stringify(s)}`);
    check(s.title === "01/11 నుండి 10 రోజుల పంచాంగం", `${v.name} default heading: ${s.title}`);
    // The 30 s refresh must not rebuild the rows (keeps the sideways scroll)
    await page.evaluate(() => { document.querySelector("#daysBody .drow").dataset.mark = "1"; });
    await page.clock.runFor(31000);
    check(await page.evaluate(() => document.querySelector("#daysBody .drow").dataset.mark === "1"), `${v.name}: 10-day rows rebuilt by the 30 s refresh`);
    await pick("2026-12-25");
    s = await state();
    check(s.dates.join() === "25/12,26/12,27/12,28/12,29/12,30/12,31/12,01/01,02/01,03/01", `${v.name} 25 Dec: rows ${s.dates.join()}`);
    check(s.title === "25/12 నుండి 10 రోజుల పంచాంగం", `${v.name} 25 Dec heading: ${s.title}`);
    check(s.today.length === 0 && s.labels === 0 && s.lines === 0 && s.cardToday === 0, `${v.name} 25 Dec: today marked although not in range: ${JSON.stringify(s)}`);
    check(s.scroll === 0, `${v.name} 25 Dec: bands should start at sunrise, scrollLeft ${s.scroll}`);
    check(s.overflow <= 1, `${v.name} 25 Dec: page scrolls sideways by ${s.overflow}px`);
    if (v.name === "phone") {
      // Today out of range: the refresh must not rebuild the rows or lose the sideways scroll
      await page.evaluate(() => { document.querySelector("#daysBody .days-scroll").scrollLeft = 99; document.querySelector("#daysBody .drow").dataset.mark = "2"; });
      await page.clock.runFor(61000);
      const kept = await page.evaluate(() => ({ mark: document.querySelector("#daysBody .drow").dataset.mark, scroll: document.querySelector("#daysBody .days-scroll").scrollLeft }));
      check(kept.mark === "2" && kept.scroll === 99, `${v.name} 25 Dec: 10-day rows rebuilt or scroll lost by the refresh: ${JSON.stringify(kept)}`);
      // One line: no taller than the one-line heading of the hora reference
      const oneLine = async (lang) => {
        const h = await page.evaluate(() => [document.getElementById("daysTitle"), document.querySelector("#horaRef > summary")].map((e) => Math.round(e.getBoundingClientRect().height)));
        check(h[0] <= h[1] + 2, `${v.name} ${lang} heading wraps (${h.join(" vs ")}px)`);
      };
      await oneLine("Telugu");
      await page.selectOption("#lang", "en");
      s = await state();
      check(s.title === "Panchangam for 10 days from 25/12", `${v.name} English heading: ${s.title}`);
      await oneLine("English");
      await page.locator("#daysRef").screenshot({ path: path.join(OUT, `days-from-selected-${v.name}-en.png`) });
      await page.selectOption("#lang", "te");
    }
    await pick("2026-10-29");
    s = await state();
    check(s.dates[0] === "29/10" && s.today.join() === "3" && s.labels === 1 && s.lines === 1 && s.cardToday === 1, `${v.name} 29 Oct: today should be row 4: ${JSON.stringify(s)}`);
    await page.locator("#daysRef").screenshot({ path: path.join(OUT, `days-from-selected-${v.name}-te.png`) });
    // An empty date box: heading and rows keep the same start date
    await pick("");
    s = await state();
    check(s.title.startsWith(s.dates[0]), `${v.name} empty date: heading "${s.title}" does not match first row ${s.dates[0]}`);
    await page.evaluate(() => jumpToNow());
    s = await state();
    check(s.dates[0] === "01/11" && s.today.join() === "0" && s.title === "01/11 నుండి 10 రోజుల పంచాంగం", `${v.name} jumpToNow: ${JSON.stringify(s)}`);
    if (v.name === "phone") check(s.scroll > 0, `${v.name} jumpToNow: bands should start near the current time (scrollLeft ${s.scroll})`);
    await ctx.close();
  }
  // The day runs from the town's sunrise. Chitta ends about 06.06 on 8 Nov 2026: after Rajahmundry's
  // sunrise (06.04) but before Hyderabad's (06.17), so for Hyderabad it belongs to 7 Nov's day.
  // With "apply to all" the shown times move by the offset, so the Rajahmundry day is kept.
  // Before sunrise the page opens on the previous day, whose night horas hold the current hora:
  // band line, Now row and top card all show. Left open, it moves on to the new day at sunrise.
  console.log("before sunrise (fixed clock)");
  {
    const ctx = await browser.newContext({ ...VIEWS[0], timezoneId: "Asia/Kolkata" }), page = await ctx.newPage();
    await page.route(/fonts.(googleapis|gstatic).com/, (r) => r.abort());
    await page.clock.install({ time: new Date("2026-11-02T00:30:00+05:30") });
    await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
    await page.goto(URL);
    const st = () => page.evaluate(() => ({ date: document.getElementById("date").value, line: !document.getElementById("nowLine").hidden,
      rows: document.querySelectorAll("#dayTbl tr.cur, #nightTbl tr.cur").length, night: document.querySelectorAll("#nightTbl tr.cur").length,
      card: !document.getElementById("nowCard").hidden, today: [...document.querySelectorAll("#daysBody .drow")].findIndex((r) => r.classList.contains("today")) }));
    let s = await st();
    check(s.date === "2026-11-01" && s.line && s.rows === 1 && s.night === 1 && s.card, `00.30 on 2 Nov should open on 1 Nov with the current night hora marked: ${JSON.stringify(s)}`);
    await page.click("#daysRef summary"); await page.waitForTimeout(100);
    s = await st();
    check(s.today === 0, `00.30 on 2 Nov: the 10-day "today" row should be 01/11 (row ${s.today})`);
    // Calendar date chosen by hand: no line, but the card still shows last night's hora
    await page.fill("#date", "2026-11-02"); await page.dispatchEvent("#date", "input"); await page.waitForTimeout(100);
    s = await st();
    check(!s.line && s.rows === 0 && s.card, `2 Nov chosen at 00.30: expected no line, no Now row, card shown: ${JSON.stringify(s)}`);
    await ctx.close();
  }
  {
    // Left open from 06.00 (before Hyderabad's 06.15 sunrise) to 06.30: moves on to 2 Nov
    const ctx = await browser.newContext({ ...VIEWS[0], timezoneId: "Asia/Kolkata" }), page = await ctx.newPage();
    await page.route(/fonts.(googleapis|gstatic).com/, (r) => r.abort());
    await page.clock.install({ time: new Date("2026-11-02T06:00:00+05:30") });
    await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
    await page.goto(URL);
    const d0 = await page.inputValue("#date");
    await page.clock.runFor(30 * 60000);
    const s = await page.evaluate(() => ({ date: document.getElementById("date").value, line: !document.getElementById("nowLine").hidden, rows: document.querySelectorAll("#dayTbl tr.cur").length }));
    check(d0 === "2026-11-01" && s.date === "2026-11-02" && s.line && s.rows === 1, `left open 06.00 -> 06.30: ${d0} -> ${JSON.stringify(s)}`);
    // A date picked by hand stays
    await page.fill("#date", "2026-12-25"); await page.dispatchEvent("#date", "input");
    await page.clock.runFor(2 * 60000);
    check(await page.inputValue("#date") === "2026-12-25", "a date picked by hand must not be replaced by the refresh");
    await ctx.close();
  }
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
