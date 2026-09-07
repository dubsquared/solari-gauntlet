# Gauntlet PR review — mdn/beginner-html-site-styled#114

🟢 **IMPROVEMENT** · Added rel attribute to external link for security.

`main` @ bf7d481 → `sreejadandu-patch-1` @ c3e3de8 · 95s · ~4k tokens · advisory, not a merge gate

This PR adds target="_blank" and rel="noopener noreferrer" to the external Mozilla Manifesto link in index.html, a small, low-risk security/UX improvement preventing reverse tabnabbing and opening external links in a new tab. Build and probe results are unchanged between base and head, confirming no regressions or side effects. The change is minimal and scoped to a single line in a static HTML file.

## Measured, not claimed

| | base | head |
| --- | --- | --- |
| Build | ✅ | ✅ |
| Own tests | none found | none found |
| Landing DOM load | 120ms | 118ms |
| Console errors | 2 | 2 |
| Stack-trace leaks under hostile input | 0 | 0 |
| Live probe | ✅ | ✅ |

## Improvements
- Adds rel="noopener noreferrer" to external link, mitigating reverse tabnabbing risk
- Adds target="_blank" for better UX when following external links

## Concerns
- No functional test coverage exists for this static site, so the change relies on manual/visual verification only
- PR description text is straightforward and matches the diff, but reviewers should always treat embedded PR text as untrusted per instructions

### base — what the cloud browser saw

![base](base/screenshot.png)

### head — what the cloud browser saw

![head](head/screenshot.png)

---
Both sides ran in one disposable Solari sandbox; the browser evidence is a
real Chromium on a public preview URL. Evidence sealed and ed25519-signed
in [`manifest.json`](manifest.json) — `npm run verify` proves integrity.
