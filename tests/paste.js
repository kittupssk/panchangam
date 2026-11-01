// Pasting a WhatsApp channel message (tests/sample-whatsapp.txt, 31-10-2026) overrides that day's values.
// Rahu kalam and Yamagandam stay sunrise-based (the book's method), so the channel's 6-to-6 times must NOT be used.
const { chromium } = require("playwright");
const path = require("path"), fs = require("fs");
const msg = fs.readFileSync(path.join(__dirname, "sample-whatsapp.txt"), "utf8");
let failures = 0;
const check = (ok, m) => { if (!ok) { failures++; console.log("  FAIL " + m); } };
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, timezoneId: "Asia/Kolkata" });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem("hora-lang", "te"); localStorage.setItem("hora-place", JSON.stringify({ city: 0, offset: 0 })); } catch (e) {} });
  await page.goto("file://" + path.join(__dirname, "..", "index.html"));
  await page.fill("#date", "2026-10-31");
  await page.dispatchEvent("#date", "input");
  await page.evaluate(() => { document.getElementById("pasteRef").open = true; });
  await page.fill("#pasteText", msg);
  await page.click("#pasteApply");
  await page.waitForTimeout(200);
  const t = (id) => page.evaluate((i) => document.getElementById(i).innerText.replace(/\s+/g, " "), id);
  check((await t("pasteMsg")).includes("31/10/2026"), "paste message not recognised: " + (await t("pasteMsg")));
  check((await t("pTithi")).includes("రా. 9.17"), "tithi should use pasted రా. 9.17: " + (await t("pTithi")));
  check((await t("pKarana")).includes("వణిజ రా. 9.17"), "karanam should use pasted value: " + (await t("pKarana")));
  check(!(await t("pRahu")).includes("9.00 ల 10.30"), "Rahu kalam must stay sunrise-based, not the channel's 6-to-6 time");
  check((await t("panchRange")).length > 0, "pasted-values tag should show");
  await page.click("#pasteClear");
  await page.waitForTimeout(200);
  check((await t("panchRange")).length === 0, "pasted-values tag should clear");
  // The box holds an editable sample in the page's language, with a headline above it
  const box = () => page.evaluate(() => ({ v: document.getElementById("pasteText").value, label: document.querySelector("label[for=pasteText]").textContent }));
  const press = async () => { await page.click("#pasteApply"); await page.waitForTimeout(200); };
  await page.fill("#pasteText", "");
  await page.evaluate(() => document.getElementById("pasteText").dispatchEvent(new FocusEvent("blur")));
  let b = await box();
  check(b.v.includes("తిథి:") && b.label.includes("నమూనా"), "an emptied box should get the Telugu sample back: " + JSON.stringify(b));
  // Applying the untouched sample saves nothing
  await press();
  check((await t("pasteMsg")).includes("నమూనా మాత్రమే") && (await t("panchRange")).length === 0, "untouched sample must not be applied: " + (await t("pasteMsg")));
  // Switching language swaps an untouched sample
  await page.selectOption("#lang", "en");
  b = await box();
  check(b.v.includes("Tithi: Shashthi till 9:17 PM") && b.label.includes("sample"), "English sample/headline missing: " + JSON.stringify(b));
  // Pasting into the untouched sample replaces it (not inserted into it)
  await page.evaluate((m) => { const dt = new DataTransfer(); dt.setData("text/plain", m); const el = document.getElementById("pasteText"); el.focus(); el.setSelectionRange(5, 5); el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); }, msg);
  const after = (await box()).v;
  check(after.replace(/\r/g, "") === msg.replace(/\r/g, ""), "paste over the sample should replace it: " + JSON.stringify(after.slice(0, 60)));
  // Editing the English sample in place and applying it
  await page.fill("#pasteText", b.v.replace("Shashthi till 9:17 PM", "Shashthi till 9:20 PM").replace("Then Vanija till 9:17 PM", "Then Vanija till 9:20 PM"));
  await press();
  check((await t("pasteMsg")).includes("31/10/2026"), "edited English sample not recognised: " + (await t("pasteMsg")));
  check((await t("pTithi")).includes("09:20 PM"), "English tithi time should be 09:20 PM: " + (await t("pTithi")));
  check((await t("pNak")).includes("12:04 PM"), "English nakshatra time: " + (await t("pNak")));
  check(/Garaja.*10:30 AM.*Vanija.*09:20 PM/.test(await t("pKarana")), "English karanam names/times: " + (await t("pKarana")));
  check((await t("pYoga")).includes("Siddha"), "English yogam name: " + (await t("pYoga")));
  check((await t("pVarj")).includes("11:19 PM") && (await t("pVarj")).includes("12:49 AM"), "English varjyam range: " + (await t("pVarj")));
  check(!(await t("pRahu")).includes("09:00 AM – 10:30 AM"), "Rahu kalam must stay sunrise-based for English pastes too");
  await page.click("#pasteClear"); await page.waitForTimeout(200);
  // The Telugu sample also applies cleanly once edited
  await page.selectOption("#lang", "te");
  await page.fill("#pasteText", "");
  await page.evaluate(() => document.getElementById("pasteText").dispatchEvent(new FocusEvent("blur")));
  b = await box();
  await page.fill("#pasteText", b.v.replace("రా9.17 వరకు\nనక్షత్రం", "రా9.25 వరకు\nనక్షత్రం"));
  await press();
  check((await t("pTithi")).includes("రా. 9.25"), "edited Telugu sample: tithi should be రా. 9.25: " + (await t("pTithi")));
  await page.click("#pasteClear"); await page.waitForTimeout(200);
  check(errors.length === 0, "page errors: " + errors.join(" | "));
  await browser.close();
  console.log(failures ? `${failures} paste check(s) failed` : "All paste checks passed");
  process.exit(failures ? 1 : 0);
})();
