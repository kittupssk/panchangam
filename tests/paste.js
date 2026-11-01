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
  // The empty box shows the sample layout, with a headline above it; the sample itself must parse
  const box = () => page.evaluate(() => ({ ph: document.getElementById("pasteText").placeholder, label: document.querySelector("label[for=pasteText]").textContent }));
  let b = await box();
  check(b.ph.includes("తిథి:") && b.ph.includes("సూర్యోదయం:") && b.label.includes("నమూనా"), "Telugu sample/headline missing: " + JSON.stringify(b));
  await page.selectOption("#lang", "en");
  b = await box();
  check(b.ph.includes("తిథి:") && b.label.includes("sample"), "English headline/sample missing: " + JSON.stringify(b));
  await page.selectOption("#lang", "te");
  await page.fill("#pasteText", b.ph);
  await page.click("#pasteApply");
  await page.waitForTimeout(200);
  check((await t("pasteMsg")).includes("31/10/2026") && (await t("pTithi")).includes("రా. 9.17"), "the sample itself should paste cleanly: " + (await t("pasteMsg")));
  await page.click("#pasteClear");
  await page.waitForTimeout(200);
  check(errors.length === 0, "page errors: " + errors.join(" | "));
  await browser.close();
  console.log(failures ? `${failures} paste check(s) failed` : "All paste checks passed");
  process.exit(failures ? 1 : 0);
})();
