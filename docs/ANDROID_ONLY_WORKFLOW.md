# Android-Only Development and Test Workflow

Status: **planning only. Nothing in this document has been executed.** No dependency was installed, no remote installer was run, no spike was started, no application code was written, and no GitHub setting was changed.
Date: 2026-10-14. Audience: the founder working from an Android phone.
Depends on: docs/F1_SPIKE_PLAN.md, docs/FRONTEND_IMPLEMENTATION_PLAN.md, OPEN_DECISIONS.md (approval record).

---

## 0. Important findings first

### 0.1 The local branch is behind the remote

The Git state of this working copy does not match the pushed branch.

| Item | State (checked 2026-10-14) |
|---|---|
| Remote `arena/fae714f3-tolesh-ai` | `c6c5b3b` (my last push, which succeeded) |
| Local `arena/fae714f3-tolesh-ai` | `c5e83ca` (the base commit). **Six commits behind**, none local-only |
| Working tree | Matches the remote content **byte for byte** for all 142 tracked files. The reconciled planning files show as untracked only because the local index predates them |
| Lost work | **None found.** The remote contains all commits; the working tree contains all files |

Consequence: committing now would create a commit on the wrong parent and the push would be rejected as non-fast-forward. So **nothing was committed in this turn.** The new documents in this turn are uncommitted files in the working tree.

Options for fixing the local branch. Each needs your approval:

- **A (recommended):** back up the working tree outside the repository, then move the local branch and index to the remote without touching files:
  ```
  cp -a /home/user/Tolesh-AI /home/user/Tolesh-AI-backup-2026-10-14
  git -C /home/user/Tolesh-AI reset --mixed origin/arena/fae714f3-tolesh-ai
  ```
  `--mixed` changes only the branch pointer and the index, not the files. The backup makes it reversible. It is still a reset, so it needs your explicit approval.
- **B:** leave the local branch as it is and make all commits from a fresh clone of the remote. More steps, and it leaves two copies to keep in sync.

### 0.2 The repository is public

`toluenesamuel/Tolesh-AI` is a public repository. Everything committed, including planning documents, is visible to anyone on the internet. This has three consequences:

- No API keys, credentials, personal data, or rater audio may be committed. Test audio from people stays outside Git (F1 plan §3).
- GitHub Actions logs from a public repository are public. Keep secrets in GitHub's encrypted secrets, and never print them.
- Changing visibility is a repository setting. I did not change it and will not. **Your decision:** keep the repository public, or make it private (private repositories use the included-minutes allowance for Actions; see §5).

### 0.3 Manual workflow trigger needs the default branch

The repository's default branch is `genspark_ai_developer`. GitHub's "Run workflow" button (`workflow_dispatch`) only appears for workflows stored on the default branch. Workflows triggered by `push` on `arena/fae714f3-tolesh-ai` run without that restriction. So the CI plan in §6 uses `push` triggers, and a manual run from the phone is not available unless the workflow is on the default branch. (Behaviour as described in GitHub's documentation; re-check when the workflow is written.)

---

## 1. What can be done now, from the existing environment

No new environment is needed for these. None of them runs product code.

| Check | Status | Notes |
|---|---|---|
| Document link and path checks | Done (last run passed) | Re-run after every edit |
| Decision-ID check (D-01 to D-29) | Done | 29 decisions present |
| Contrast ratios for the palette | Done | Calculated, not browser-tested |
| Stale-phrase and consistency checks (for example WCAG wording) | Done for WCAG 2.2 | Repeat before each commit |
| Package versions and licences (npm registry, read-only) | Done for 17 packages on 2026-10-14 | Re-check at ADR time; versions drift |
| Skill audit (18 directories) | Done | See docs/SKILL_VERIFICATION.md |
| Hosting and cost facts (web search, read-only) | Done for Actions, Codespaces, Firebase Test Lab, Azure Speech | Free-tier terms change; re-verify before relying on them |
| Tauri Linux prerequisites (official docs, read-only) | Done | `libwebkit2gtk-4.1-dev` and related packages (§5.2) |
| GitHub repository state (read-only) | Done | Public; default branch `genspark_ai_developer`; no workflows; Pages not enabled; Actions settings not readable with the current token (HTTP 403) |

**Cannot be done from here, even though they look like planning:**
- Reading GitHub Actions settings or enabling Actions or Pages. The token lacks that permission, and changing it would be a permission change that I will not make.
- Any build of Rust, Tauri, Gradle or Playwright. The sandbox cannot reach crates.io, Google Maven, the Playwright CDN, or the Ubuntu archive (checked 2026-10-14).
- Any test that needs a microphone, speaker, GPU, or the founder's phone.

---

## 2. Prioritised next work: orb and voice feasibility

These two are the highest-risk unknowns, and both can be tested on an Android phone without a desktop.

### 2.1 Animated orb

**What the phone can show:** frame timing in the phone browser (rAF intervals, dropped-frame share); whether WebGL2 is present; whether the page stops animating when hidden; and battery change over a fixed 15-minute run.

**What the phone cannot show well:** exact thermal state (not exposed to web pages), precise GPU time, and the native WebView frame statistics that `adb dumpsys gfxinfo` reports. Those need a desktop with `adb`, which is out of scope for an Android-only workflow. The probe must label them "not measured".

**Important difference:** Chrome on the phone is not the same as the Android WebView that Capacitor uses. The Chrome result tells us about the renderer and GPU; the WebView result needs an APK (§4, Step 6).

### 2.2 Voice interaction

**What the phone can show:** `getUserMedia` on a secure (HTTPS) origin; AudioWorklet frame delivery; live mic level; playback through Web Audio with a cancellable queue; barge-in timing measured in software; and the self-echo effect when the phone's own speaker plays into its own mic.

**What the phone cannot show:** the hardware audio latency, a controlled SPL level, a headset comparison at fixed volume (possible with a wired headset, but level is uncontrolled), and noisy-room recordings the phone cannot make reproducibly. These stay "not measured" until a controlled setup exists.

**Privacy:** the probe must not upload microphone audio anywhere. It processes audio locally and reports only timings and levels.

### 2.3 Language feasibility (Nigerian English, Pidgin, Yoruba)

This is gated by D-06 (native raters), D-05 (provider shortlist and budget), D-17 (release thresholds) and provider terms review. Nothing in it starts from the phone yet. The only zero-cost step is the Azure F0 trial in §5.4, and that needs an account and a card on file.

---

## 3. Environments investigated

Cost and account facts are from secondary sources read on 2026-10-14. Check the provider's own page before relying on any number.

| Environment | Works from Android browser? | What it can test | Cost (current, verify) | Account needed | Verdict |
|---|---|---|---|---|---|
| **Arena Agent Mode** (this environment) | Yes (chat) | Document work, planning checks, read-only API queries, and, once approved, a short-lived test server | Included | Arena (already in use) | **Use for all writing and coordination** |
| **Arena live preview** (a server started in this sandbox, opened as an HTTPS link) | Yes | Phone-browser probes: WebGL2, mic, orb frame timing, barge-in timing (software) | Included while the sandbox runs | Arena | **Use for the phone probe.** The link is live only while the process runs |
| **GitHub Actions**, standard hosted runners, **public** repository | Results visible in the GitHub mobile app or browser | Linux builds (Tauri), Windows builds, Android debug APK builds (Gradle), headless Playwright and axe tests | **Free and unlimited for standard runners on public repositories** (GitHub's documented terms, as reported by several sources on 2026-08 to 2026-10). Larger runners are billed | GitHub (already in use) | **Use as the build and CI environment.** Cannot test audio, GPU or mic |
| **GitHub Pages** | Yes | Hosting a static test page at an HTTPS URL that persists | Free | GitHub | Needs Pages enabled (a repository setting change). Option if the Arena link is not enough |
| **GitHub Codespaces** (VS Code in browser) | Works, but awkward on a phone | Linux container with Node, Rust, Playwright. No real mic, GPU, or Android device | Personal free quota: 120 core-hours and 15 GB-month storage per month. Storage is billed when stopped; compute only while running | GitHub | **Not needed.** Actions covers the same builds without a running machine |
| **GitHub github.dev** (web editor only) | Yes | Editing files only, no builds | Free | GitHub | Useful for a quick text edit; not for builds |
| **Firebase Test Lab** (Google) | Results in browser; the test runs on Google's devices | Installs an APK on real Android devices and runs instrumented or Robo tests. Whether it can exercise microphone input realistically is **unknown and must be tested** | Spark (free) plan: about 5 physical-device test runs per day and 10 virtual-device runs per day (secondary sources, 2023 and 2026; verify in the console). Paid plan charges per device-hour beyond that | Google account; Firebase project | **Good for device-compatibility checks** after the APK exists. Verify the microphone question first |
| **Azure Speech (F0 free tier)** | Via a test page or from CI | Nigerian English TTS (`en-NG-AbeoNeural`, male) and STT, once approved | 5 audio hours of speech-to-text and 0.5 million characters of neural TTS per month. F0 quotas cannot be raised. Card required to create the resource (secondary source). Standard tier costs beyond that (verify) | Microsoft account; Azure subscription; card | **Use only for the approved language trial.** No Yoruba or Pidgin voice is listed |
| **Termux** (Linux terminal app on Android) | Yes | Node, Python, git on the phone | Free | None | Possible for scripts. **Not suitable** for Tauri, Gradle or WebGL work. It is a local install, so it needs your approval |
| BrowserStack, AWS Device Farm and similar paid device farms | Yes | Real device sessions | Paid; not checked in detail | Account and payment | **Not recommended now**; Firebase Test Lab covers the same need at lower cost, if the microphone question is answered |
| Replit, StackBlitz, CodeSandbox | Yes | Web prototypes | Varies | Account | **Not suitable** for Rust, Android builds or device audio tests |

---

## 4. Which tests run where

Legend: **Now** = no new setup; **Phone** = founder's Android phone with the Arena probe; **CI** = GitHub Actions; **FTL** = Firebase Test Lab; **Win** = a physical Windows PC; **Zorin** = a physical Zorin OS PC; **Lab** = a controlled bench with a fixed sound level or external meter.

| Test (F1 ID) | Now | Phone | CI | FTL | Win | Zorin | Lab |
|---|---|---|---|---|---|---|---|
| Document, link, decision-ID and consistency checks | ✔ | | | | | | |
| Package versions and licences (read-only) | ✔ | | | | | | |
| WebGL2 present; AudioWorklet present (Chrome on phone) (O-1 setup, T-A-2 partial) | | ✔ | | | | | |
| Orb frame timing in phone Chrome, 5 minutes (O-1, O-5, O-6) | | ✔ (renderer only) | | | | | |
| Orb reduced-motion and hidden-tab behaviour (O-6, O-9) | | ✔ | ✔ (headless) | | | | |
| Orb frame timing, mid-range Android **WebView** (O-1, O-2) | | | | ✔ (if Test Lab reports frame stats; verify) | | | ✔ (`dumpsys gfxinfo` on a desktop) |
| Battery change over 15 min (O-7) | | ✔ (coarse) | | | | | ✔ (controlled) |
| Mic capture and level meter (A-1 software) | | ✔ | | | | | |
| VAD onset detection on scripted speech (A-2) | | ✔ (quiet room) | | | | | ✔ (controlled) |
| Barge-in stop time, headset (A-4) | | ✔ (wired headset, approximate) | | | | | ✔ |
| Echo self-interruption, speakers (A-5) | | ✔ (phone's own speaker) | | | | | ✔ |
| Permission deny and allow (A-7) | | ✔ | ✔ (headless only) | | | | |
| Android audio focus, call interrupts (A-8, T-A-3) | | ✔ (manual) | | | | | |
| Playwright and axe on the test scene, Chromium, Firefox, WebKit (accessibility) | | | ✔ | | | | |
| Tauri Linux build (T-Z setup) | | | ✔ (compile only) | | | | |
| Tauri Windows build (T-W setup) | | | ✔ (compile only) | | | | |
| Capacitor Android debug APK build (T-A setup) | | | ✔ (compile only) | | | | |
| Capacitor manifest variants, E2 (T-A-1) | | | | ✔ (if mic works in FTL; verify) | | | ✔ (on the phone, by installing the APK; needs approval) |
| WebGL2, AudioWorklet and mic in Windows WebView2 (T-W-1, T-W-2) | | | | | ✔ | | |
| WebKitGTK mic with and without permission handler, GStreamer plugins (T-Z-2, T-Z-4) | | | | | | ✔ | |
| Zorin WebGL2, orb, always-on-top, Wayland and X11 (T-Z-3, T-Z-5, T-Z-6) | | | | | | ✔ | |
| Language trials (WS-C) | | | | | | | After approvals (§7) |

**Cannot be done from Android at all:** Tauri runtime on Windows or Zorin, WebKitGTK behaviour, exact thermal and battery measurement, hardware audio latency, and any `adb`-based profiling.

**Cheapest ways to close the gaps:**
- Windows and Zorin both need a physical machine. A borrowed or spare PC is the cheapest route. The alternative is a paid cloud VM with a desktop and GPU, which is not cheap and is not verified here. Ask first.
- Controlled audio and battery tests need a quiet room and a fixed-volume playback source. The phone and a wired headset cover the software timings only.

---

## 5. Cost and accounts

### 5.1 Current costs: expected to be zero

| Item | Cost | Account | Notes |
|---|---|---|---|
| Arena Agent Mode and live preview | Included in the session | Arena | Preview is live only while the process runs |
| GitHub repository, Actions (standard runners, public repo) | Free and unlimited (per GitHub's documented terms) | GitHub (existing) | Confirm the repository stays public, or budget private minutes |
| GitHub Pages (if enabled) | Free | GitHub | Needs a repository setting change; your decision |
| Firebase Test Lab on the Spark plan | Free within daily quota | Google, Firebase project | Verify the quota in the console first |
| Azure Speech F0 | Free within 5 audio hours (STT) and 0.5 million characters (TTS) per month | Microsoft, Azure subscription, card | Quota cannot be raised; move to a paid tier for more |

### 5.2 Costs that start only if you approve

- **Private repository Actions:** included minutes are 2,000 a month on the Free plan (per GitHub's documented terms). After that, standard Linux runners cost about $0.006 a minute, Windows about $0.010 a minute (secondary sources, September to October 2026). Larger runners are always billed, even on public repositories.
- **Azure Speech above F0:** standard speech-to-text at about $1 an audio hour, and neural TTS at about $16 per million characters (secondary sources, mid-2026; check the Azure pricing page).
- **Firebase Test Lab above the free quota:** physical devices billed per device-hour (secondary sources give $5 a device-hour; verify).
- **Codespaces beyond the free quota,** and **paid device farms.** Not recommended now.

### 5.3 Recommended approach (cheapest practical)

1. Keep all writing and coordination in Arena.
2. Use GitHub Actions on the public repository for builds and headless tests. Cost is zero if the repository stays public.
3. Test the orb and voice on the phone through an Arena preview link, with no installation.
4. Add Firebase Test Lab on the free Spark plan only after the APK exists, and only after its microphone behaviour is checked.
5. Use the Azure F0 tier only for the approved language trial, with a spending limit set on the account. Never paste keys into chat.
6. Borrow a Windows PC and a Zorin PC for the desktop gates. Do not buy cloud desktops until those tests are approved.

### 5.4 Account requirements (what you would have to create)

| Account | Needed for | Your action |
|---|---|---|
| GitHub (existing) | Repository, Actions, Pages | None now. Decide on Pages and visibility |
| Firebase / Google | Test Lab | Create a project on the Spark plan (no card needed for Spark; verify) |
| Microsoft Azure | Speech F0 | Create an account and a Speech resource on F0. Card required. Keep the key out of chat |
| Hardware | Windows, Zorin, reference Android device | Tell us what you have (see §7) |

---

## 6. Step-by-step workflow (phone-first)

Commands appear only where they are needed. Steps marked **approval** do not start until you approve them.

**Step 1 — Fix the local branch (approval).** Either option A or B in §0.1. Recommended: option A, with the backup command first. Then confirm `git status` shows no differences that are not expected.

**Step 2 — Commit this planning change (after step 1).** The new files from this turn are `docs/ANDROID_ONLY_WORKFLOW.md` and any F1 cross-reference. Commit and push to `arena/fae714f3-tolesh-ai` only. No other branch.

**Step 3 — Build-and-check workflow in GitHub Actions (approval).** One workflow file on the session branch, using `push` triggers (§0.3). Initial jobs, all headless:
- docs checks (link and decision-ID checks, the same ones used now);
- Playwright plus axe on a placeholder test page in Chromium, Firefox and WebKit;
- later: Tauri Linux compile (`sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev` on the runner), Windows compile, and Capacitor Android debug APK build.

The founder reads results in the Actions tab in the GitHub app or browser. No command is needed from the founder.

**Step 4 — Phone capability probe (approval).** A single throwaway page under spikes/phone-probe/ (created only after approval), with no product code. It reports WebGL2, AudioWorklet, `getUserMedia`, and frame timing for a 5-minute orb run, and it processes the mic locally. The agent serves it with:
```
python3 -m http.server 8080 --bind 0.0.0.0
```
The founder opens the HTTPS preview link that Arena shows for port 8080 in the phone's Chrome. The link is live only while the process runs.

**Step 5 — Run the probe on the phone.** Tap Start. Keep the phone unplugged, at normal brightness, with the screen on for 5 minutes. Note the battery percentage before and after. Tap "Copy results" and paste the text into the chat. Do not paste audio or any personal data.

**Step 6 — Android WebView check (approval; needs a debug APK).** The CI builds a debug APK. To test on your phone you would install it, which needs "Install unknown apps" enabled for the app you install from. That is a phone setting change you must approve. Alternative without installing: Firebase Test Lab (§5.4).

**Step 7 — Record results.** The agent writes the results to docs/spikes/F1-phone-probe-results.md (created by the probe), marks each criterion as pass, fail or not measured, and commits. Raw logs stay out of Git unless small.

**Step 8 — Desktop gates (when a PC is available).** Windows and Zorin tests follow the F1 plan's WS-D order. Each needs a physical machine, and each needs approval to run.

**Step 9 — Language trial (after D-05, D-06, D-17 and provider terms).** Azure F0 is the first candidate; no keys in chat or in Git.

---

## 7. Decisions and inputs needed from you

| # | Item | My recommendation |
|---|---|---|
| 1 | Approve Step 1 (local branch sync, option A with backup) | Approve. It is needed before any commit |
| 2 | Repository visibility: keep public, or make private | Keep public for now, with the rule in §0.2. Private would use the Actions allowance |
| 3 | Approve the Actions workflow (Step 3) | Approve; headless jobs only |
| 4 | Approve the phone probe (Step 4) and its HTTPS preview link | Approve; it is the single most useful next test |
| 5 | Allow a phone setting change for a debug APK (Step 6), or use Firebase Test Lab instead | Start with Test Lab later; decide after the probe |
| 6 | Hardware: a Windows PC and a Zorin PC, or confirm none are available | Tell us what you have; we will plan around it |
| 7 | Create a Firebase project (free Spark plan) | Optional; needed only for Step 6 alternative |
| 8 | Create an Azure account and F0 Speech resource (card required) | Only when you approve the language trial |
| 9 | Pages enabled for a static test page | Not needed if Arena preview is enough |
| 10 | Approvals still open from F1: §6 targets, toolchain installs on your machines, spike code location, headset-first rule, raters (D-06), providers (D-05), thresholds (D-17) | Unchanged from docs/F1_SPIKE_PLAN.md §12 |

---

## 8. Single best next step

**Approve Step 1 (local branch sync with backup), then approve Step 4 (the phone probe).** The probe is the only test that gives real evidence on the orb and voice from the device you actually have, at zero cost, with no installation. It also covers the most uncertain part of the F1 plan: the browser-side microphone and render path on Android. Everything else in this document can wait.

**Nothing has been executed.** Waiting for your approval.
