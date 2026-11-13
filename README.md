# Shrī Chitrāpur Mat͟h — Pañchāṅga

A small static website that shows **today's tithi** from the Shri Chitrapur Math
calendar, **reminds you of important days 10 days in advance**, and lets you keep
**birthdays by the Hindu calendar**. It runs entirely in the browser and is hosted
on GitHub Pages.

## What it does

- **Today's pañchāṅga** — tithi, paksha, māsa, ṛtu, nakshatra and saṁvatsara, with
  the day's observances (Ekādashī, Pūrṇimā, Amāvasyā, Pradoṣa, Saṅkaṣṭī).
  On transition days both tithis are shown, e.g. `KR7/KR8`.
- **Timings** — sunrise, sunset, Rāhu Kāla, Yamagaṇḍa, Gulika and Abhijit muhūrta
  for the day, plus the exact moment each tithi begins and ends. Choose your place
  (or use your device location) so the times are right for you.
- **Find a day** — type a festival, Vardhantī or tithi (`Ramanavami`, `Ekadashi`,
  `Navaratri`) and jump to its next occurrence.
- **Coming up** — every important day and observance in the next 10 days
  (15 and 30 days selectable), plus your family's birthdays.
- **My people** — add a birthday by tithi + māsa, by nakshatra, or both; the site
  works out the next occurrence and the countdown. Stored in your browser's
  `localStorage`; nothing is uploaded. Export/import as JSON to move between devices.
- **Browse the calendar** — a month grid of tithi and nakshatra, click any day for
  full detail.

## The Sandhyāvandanam reader

The app also carries the full daily ritual: **`sandhyavandanam.html`** reproduces the
booklet *Saṅkshipta Sandhyāvandanam — Tṛtīya Āvṛttih* as readable text, step by step,
so you can follow it while doing sandhyāvandanam instead of flipping through a PDF.

- All 19 steps, from Ācamanam through to Gāyatrī prasthānam.
- Each mantra in **Devanagari** and in **roman transliteration** — switch between
  Devanagari / Both / Roman, and the choice is remembered.
- The booklet's **English instructions** for each step (what to do with the hands
  and the water) sit in a highlighted box beside the mantra.
- A **saṅkalpa reference** at the end: the māsa/ṛtu pairs, the sixteen tithi
  locatives and the seven vāra names, so the blanks in the saṅkalpa can be filled.

The text lives in `assets/sandhyavandanam.js` as structured data, so a correction is
a one-line edit. The roman text is generated from the Devanagari by rule
(`indic-transliteration`), not typed by hand.

The Today card links to it, and it is cached by the service worker, so it works
offline once opened.

## Where the data comes from

The Math publishes its calendar as public iCal feeds on
[chitrapurmath.net](https://www.chitrapurmath.net/events):

| Feed | Used for |
| --- | --- |
| Tithis | daily tithi / paksha / māsa / ṛtu / nakshatra + observances |
| Math Almanac | important days — Vardhantī, Samārādhanā, Jayantī, festivals |

`scripts/build_data.py` downloads both, parses them and writes a single
`data/panchang.json` that the site reads. The feeds use the **Amānta** māsa
convention and the Math's own tithi boundaries.

The feeds carry only tithi *names* per day, so the timings come from
`assets/panchang.js` — a small self-contained engine (Meeus longitude series for
the Sun and Moon, NOAA for sunrise/sunset). It needs no packages and no network.
Tithi boundaries are global instants; sunrise-based windows are computed for the
place you pick.

> The printed Mat͟h calendar gives Rāhu Kāla on a fixed 6 a.m. sunrise basis, so its
> clock times differ by a few minutes from the ones computed here from the real
> sunrise. Where it matters, follow the printed calendar.

```bash
python3 scripts/build_data.py      # regenerate data/panchang.json
```

No third-party packages are needed — only the Python standard library.

## Keeping it current

`.github/workflows/refresh.yml` re-runs the build once a day and commits any change
to `data/panchang.json`, so the site always carries the latest published calendar.
Run it by hand from the **Actions** tab any time.

## Visitor analytics (optional)

`assets/analytics.js` is set up for Google Analytics 4 but is **switched off by
default** — with no Measurement ID it loads nothing and sets no cookies. To turn
it on, create a GA4 property and web data stream for the Pages URL, then paste
the `G-XXXXXXXXXX` ID into `window.GA_MEASUREMENT_ID` at the top of that file.

GA4 reports **users, sessions and page views**. It does not log or store IP
addresses (it uses them transiently for coarse location, then discards them), so
it cannot give you a unique-IP count.

For that you need a server-side counter, because GitHub Pages is static hosting
with no request logs. The workable approach is a small Cloudflare Worker that
hashes the visitor IP with a rotating daily salt and increments a counter in KV —
counting uniques without ever storing an address. Note that an IP address is
personal data under India's DPDP Act and, for EU visitors, GDPR; a salted hash
with short retention is the defensible way to do it.

If you serve EU visitors, GA4 sets cookies and needs consent — consider a consent
banner or a cookieless service such as GoatCounter or Plausible instead.

## Hosting

Served by GitHub Pages from the `main` branch root. To use your own copy, fork the
repo and enable Pages under **Settings → Pages**.

## Installing it as an app

The site is a small PWA, so it can open on its own — full screen, no browser bars —
and it works offline once loaded.

- **iPhone / iPad** — open it in Safari, tap Share, then **Add to Home Screen**.
- **Android / Chrome** — open it, tap the menu, then **Install app** (or *Add to Home screen*).
- **Desktop** — use the install icon in the address bar.

This is powered by `manifest.json` (standalone display, name, icons) and
`sw.js` (a service worker that caches the app shell; page loads and
`data/panchang.json` go network-first so updates still show, with the cached copy as
an offline fallback).

> **When you change the app, bump `CACHE` in `sw.js`** (e.g. `chitrapur-panchang-v1` →
> `-v2`). That clears the old cached shell so everyone picks up the new version.

## A note

This is a convenience companion to the Math's own calendar, not a substitute.

The Sandhyāvandanam text is reproduced from the Math's booklet as the Math distributes
it freely; all rights remain with Shrī Chitrāpur Mat͟h, Shirāḷi. For ritual use, follow
your own guru-paramparā and the printed booklet. For religious observance, please
confirm with the printed Mat͟h calendar or your local pañchāṅga.
