// Builds index.html (served by GitHub Pages) from src/hora-chart.html.
// src/hora-chart.html is the page body exactly as published to the Claude artifact;
// index.html wraps it in a full HTML document. Never edit index.html by hand.
//   node tools/build.js          write index.html
//   node tools/build.js --check  exit 1 if index.html is out of date
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "src/hora-chart.html"), "utf8");
const doc = '<!doctype html>\n<html lang="te">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="color-scheme" content="dark">\n<style>:root{color-scheme:dark;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;background:#12111d;font:14px system-ui,-apple-system,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>\n</head>\n<body>\n' + src + '\n</body>\n</html>\n';
const out = path.join(root, "index.html");
if (process.argv.includes("--check")) {
  const cur = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : "";
  if (cur !== doc) { console.error("index.html is out of date: run `npm run build`"); process.exit(1); }
  console.log("index.html is up to date");
} else {
  fs.writeFileSync(out, doc);
  console.log(`wrote index.html (${doc.length} bytes)`);
}
