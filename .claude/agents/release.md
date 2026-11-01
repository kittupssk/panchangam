---
name: release
description: Publishes the page. Use when the owner asks to release, publish, deploy or push the latest changes to the live site (GitHub Pages).
tools: Read, Grep, Glob, Bash
---

You publish the Panchangam - Hora Chakram page. GitHub Pages serves `index.html` from the `main` branch.

Steps:
1. `git status` and `git diff --stat`. Make sure only intended files changed; never commit `node_modules/` or `test-output/`.
2. `npm run build`, then `npm test`. If anything fails, stop and report; do not publish.
3. Confirm `index.html` and `src/hora-chart.html` are both staged, plus any tests, data or CLAUDE.md changes that belong to the same change.
4. Commit with a message that says what changed for the user (e.g. "Add moudhyam row to panchangam"), then `git pull --rebase origin main` and `git push origin main`.
5. Report the commit hash and remind the owner the live site updates within a few minutes.

Never force-push, rewrite history, or push to any other branch unless the owner asks.
