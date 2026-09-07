# Gauntlet PR review — mdn/beginner-html-site-styled#114

🟢 **IMPROVEMENT** · Added rel attribute to external link for security.

`main` @ bf7d481 → `sreejadandu-patch-1` @ c3e3de8 · 95s · ~4k tokens · advisory, not a merge gate

This PR adds rel="noopener noreferrer" and target="_blank" to the external Mozilla Manifesto link in index.html. This is a minor, low-risk change that improves security by preventing the new page from accessing window.opener, and opens the link in a new tab per common practice for external links. Deterministic metrics show no meaningful behavioral regression (load time and console errors essentially unchanged, build still passes).

## Measured, not claimed

| | base | head |
| --- | --- | --- |
| Build | ✅ | ✅ |
| Own tests | none found | none found |
| Landing DOM load | 124ms | 127ms |
| Console errors | 2 | 2 |
| Stack-trace leaks under hostile input | 0 | 0 |
| Live probe | ✅ | ✅ |

## Improvements
- External link now uses rel="noopener noreferrer" mitigating potential reverse tabnabbing security risk
- target="_blank" added so external link opens in a new tab, a common UX practice

## Concerns
- Very small, single-line change with minimal impact on a static beginner tutorial site; unlikely to be a meaningful security fix but not harmful
- No tests exist to verify behavior beyond manual diff review

### base — what the cloud browser saw

![base](base/screenshot.png)

### head — what the cloud browser saw

![head](head/screenshot.png)

---
Both sides ran in one disposable Solari sandbox; the browser evidence is a
real Chromium on a public preview URL. Evidence sealed and ed25519-signed
in [`manifest.json`](manifest.json) — `npm run verify` proves integrity.
