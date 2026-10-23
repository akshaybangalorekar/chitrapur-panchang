#!/usr/bin/env python3
"""
Build data/panchang.json for the Shri Chitrapur Math panchang site.

Source: the public Google-Calendar iCal feeds published on chitrapurmath.net
  - Tithis       : daily tithi / paksha / masa / ritu / nakshatra + observances
  - Math Almanac : the important days (Vardhanti, Samaradhana, Jayanti, festivals)

Run:  python3 scripts/build_data.py
"""
import json
import os
import re
import unicodedata
import urllib.request
from datetime import date, datetime, timezone

FEEDS = {
    "tithis": "https://calendar.google.com/calendar/ical/"
              "49p6r5o0atao7sbj29fsk9omhg@group.calendar.google.com/public/basic.ics",
    "almanac": "https://calendar.google.com/calendar/ical/"
               "3366fbc776e1c8161b94f5f7b1d120338ef82e9375ebe05262eca4c256b3663d"
               "@group.calendar.google.com/public/basic.ics",
}

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "panchang.json")

MASA = ["Chaitra", "Vaishakha", "Jyeshtha", "Ashadha", "Shravana", "Bhadrapada",
        "Ashwija", "Kartika", "Margashirsha", "Pushya", "Magha", "Phalguna"]
RITU = ["Vasanta", "Grishma", "Varsha", "Sharad", "Hemanta", "Shishira"]
NAKSHATRA = ["Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashiras", "Ardra",
             "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni",
             "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha",
             "Anuradha", "Jyeshtha", "Mula", "Purvashadha", "Uttarashadha",
             "Shravana", "Dhanishtha", "Shatabhisha", "Purvabhadra",
             "Uttarabhadra", "Revati"]
NAKSHATRA_ABBR = {"ASW": "Ashwini", "BHR": "Bharani", "KTK": "Krittika",
                  "ROH": "Rohini", "MRG": "Mrigashiras", "ARD": "Ardra",
                  "PUN": "Punarvasu", "PUS": "Pushya", "ASL": "Ashlesha",
                  "MGH": "Magha", "PPH": "Purva Phalguni",
                  "UPH": "Uttara Phalguni", "HST": "Hasta", "CHI": "Chitra",
                  "SWA": "Swati", "VSK": "Vishakha", "ANU": "Anuradha",
                  "JYE": "Jyeshtha", "MUL": "Mula", "PSD": "Purvashadha",
                  "USD": "Uttarashadha", "SHR": "Shravana", "DHA": "Dhanishtha",
                  "STB": "Shatabhisha", "PBD": "Purvabhadra",
                  "UBD": "Uttarabhadra", "REV": "Revati"}
TITHI_NAMES = ["Pratipada", "Dwithiya", "Tritiya", "Chaturthi", "Panchami",
               "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami",
               "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi"]
SPECIAL_CODE = {"SPR": "Shukla Pradosh", "KPR": "Krishna Pradosh",
                "EKA": "Ekadashi", "SKT": "Sankashti"}
SPECIAL_LABEL = {"Ekādashī": "Ekadashi", "Saṅkas̲h̲tī": "Sankashti",
                 "Shukla Prados̲h̲a": "Shukla Pradosh",
                 "Kṛs͟hṇa Prados̲h̲a": "Krishna Pradosh",
                 "Pūrṇimā": "Purnima", "Amāvasyā": "Amavasya",
                 "Amāvāsya": "Amavasya"}


_TRANSLIT = str.maketrans({
    "ṛ": "ri", "Ṛ": "Ri", "ṣ": "sh", "Ṣ": "Sh", "ś": "sh", "Ś": "Sh",
    "ṭ": "t", "ḍ": "d", "ṇ": "n", "ṃ": "m", "ṅ": "n", "ñ": "n",
    "ā": "a", "ī": "i", "ū": "u", "ḥ": "h", "ṁ": "m", "ḷ": "l",
})


def norm(s):
    s = (s or "").translate(_TRANSLIT)
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.replace("\u0332", "").replace("\u035f", "")
    return re.sub(r"[^a-z0-9 ]", "", s.lower()).strip()


NAK_KEY = {norm(n): n for n in NAKSHATRA}
NAK_KEY.update({norm(v): v for v in NAKSHATRA_ABBR.values()})
MASA_KEY = {norm(m): m for m in MASA}
RITU_KEY = {norm(r): r for r in RITU}


def tithi_name(paksha, num):
    if num >= 15:
        return "Purnima" if paksha == "Shukla" else "Amavasya"
    return TITHI_NAMES[num - 1]


def classify(token):
    t = token.strip()
    if not t:
        return None, None
    up = t.upper().replace(" ", "")
    if re.fullmatch(r"(SH|KṚ|KR)\d+(/(SH|KṚ|KR)\d+)*", up):
        return "tithi", up
    if up in SPECIAL_CODE:
        return "special", SPECIAL_CODE[up]
    k = norm(t)
    if "rtu" in k:
        for rk, rv in RITU_KEY.items():
            if rk in k:
                return "ritu", rv
        return None, None
    if "samvatsara" in k:
        return "samvatsara", re.sub(r"\s*Saṁvatsara.*", "", t, flags=re.I).strip()
    if "masa" in k:
        for mk, mv in MASA_KEY.items():
            if mk in k:
                return "masa", mv
        return None, None
    if k in MASA_KEY:
        return "masa", MASA_KEY[k]
    if k in NAK_KEY:
        return "nakshatra", NAK_KEY[k]
    for part in re.split(r"[/,]", t):
        if norm(part) in NAK_KEY:
            return "nakshatra", NAK_KEY[norm(part)]
    return None, None


def find_masa(tok):
    k = norm(tok)
    for mk, mv in MASA_KEY.items():
        if mk in k:
            return mv
    return None


def find_nak(tok):
    k = norm(tok)
    for nk, nv in NAK_KEY.items():
        if nk in k:
            return nv
    return None


def parse_line(line):
    """Positional parse of a panchang line:
    <tithi> [- <special>] - <masa> - <ritu> - <nakshatra> [- <samvatsara>]
    """
    out = {"specials": [], "all_tithis": [], "codes": []}
    if not line:
        return out
    toks = [t.strip() for t in re.split(r"\s*-\s*", line) if t.strip()]

    # ritu = first token naming a season
    ri = masa_i = None
    for i, t in enumerate(toks):
        rv = next((v for k, v in RITU_KEY.items() if k in norm(t)), None)
        if rv:
            ri, out["ritu"] = i, rv
            break
    if ri is not None:
        for j in range(ri - 1, -1, -1):          # masa sits before the ritu
            m = find_masa(toks[j])
            if m:
                out["masa"], masa_i = m, j
                break
        for j in range(ri + 1, len(toks)):        # nakshatra sits after it
            n = find_nak(toks[j])
            if n:
                out["nakshatra"] = n
                break

    for i, t in enumerate(toks):
        k = norm(t)
        up = t.upper().replace(" ", "")
        if re.fullmatch(r"(SH|KṚ|KR)\d+(/(SH|KṚ|KR)\d+)*", up):
            for code in up.split("/"):
                mm = re.match(r"(SH|KṚ|KR)(\d+)", code)
                pak = "Shukla" if mm.group(1) == "SH" else "Krishna"
                nn = int(mm.group(2))
                if nn > 15:
                    nn -= 15
                out["all_tithis"].append((pak, nn))
                out["codes"].append(("SH" if pak == "Shukla" else "KR") + str(nn))
        elif up in SPECIAL_CODE:
            out["specials"].append(SPECIAL_CODE[up])
        elif "samvatsara" in k:
            out.setdefault("samvatsara",
                           re.sub(r"\s*Saṁvatsara.*", "", t, flags=re.I).strip())
        else:
            for lab, short in SPECIAL_LABEL.items():
                if norm(lab) == k:
                    out["specials"].append(short)

    # fallbacks when there was no ritu token to anchor on
    if "masa" not in out:
        for j, t in enumerate(toks):
            m = find_masa(t)
            if m:
                out["masa"], masa_i = m, j
                break
    if "nakshatra" not in out:
        for j, t in enumerate(toks):
            if j == masa_i:
                continue
            n = find_nak(t)
            if n:
                out["nakshatra"] = n
                break

    if out["all_tithis"]:
        pak, n = out["all_tithis"][-1]
        out["paksha"], out["tithiNum"] = pak, n
        out["tithi"] = tithi_name(pak, n)
    out["specials"] = sorted(set(out["specials"]))
    return out


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "panchang-build/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def parse_ics(text):
    text = text.replace("\r\n", "\n").replace("\n ", "")
    events = []
    for blk in text.split("BEGIN:VEVENT")[1:]:
        d = {}
        for line in blk.split("\n"):
            if line.startswith("END:VEVENT"):
                break
            if ":" in line:
                k, v = line.split(":", 1)
                d[k.split(";")[0]] = v.strip()
        events.append(d)
    return events


def dt_of(ev):
    m = re.match(r"(\d{8})", ev.get("DTSTART", "") or "")
    return m.group(1) if m else None


def unesc(s):
    return (s or "").replace("\\,", ",").replace("\\;", ";").replace("\\n", " ").strip()


def iso(d):
    return f"{d[:4]}-{d[4:6]}-{d[6:]}"


def clean_samvatsara(s):
    """True when the text is just '<Name> Saṁvatsara' with no trailing marker."""
    return bool(re.fullmatch(r"[^-]*Saṁvatsara", s or ""))


def main():
    tithi_evs = parse_ics(fetch(FEEDS["tithis"]))
    almanac_evs = parse_ics(fetch(FEEDS["almanac"]))

    cand = {}          # date -> list of (parsed, other_text, is_summary)
    obs = {}           # date -> set of observance labels

    for ev in tithi_evs:
        d = dt_of(ev)
        if not d:
            continue
        s, desc = unesc(ev.get("SUMMARY", "")), unesc(ev.get("DESCRIPTION", ""))
        if re.match(r"\s*(SH|KṚ|KR)\d", s):
            line, other, is_sum = s, desc, True
        elif re.match(r"\s*(SH|KṚ|KR)\d", desc):
            line, other, is_sum = desc, s, False
        else:
            line = None
        if line:
            cand.setdefault(d, []).append((parse_line(line), other, is_sum))
        # observances from either field
        for txt in (s, desc):
            for lab in SPECIAL_LABEL:
                if txt.strip() == lab or txt.strip().endswith(" - " + lab):
                    obs.setdefault(d, set()).add(SPECIAL_LABEL[lab])
        for p in ([parse_line(line)] if line else []):
            for sp in p["specials"]:
                obs.setdefault(d, set()).add(sp)

    days = {}
    for d, lst in cand.items():
        # prefer the entry whose companion text is a clean samvatsara
        best = max(lst, key=lambda t: (clean_samvatsara(t[1]), t[2]))
        p, other, _ = best
        if not p.get("tithi"):
            continue
        also = []
        for (pp, _, _) in lst:
            for (pak, n) in pp["all_tithis"]:
                nm = tithi_name(pak, n)
                if nm != p["tithi"] and nm not in also:
                    also.append(nm)
        rec = {k: p[k] for k in ("tithi", "paksha", "tithiNum", "masa", "ritu",
                                 "nakshatra", "samvatsara") if p.get(k)}
        if p.get("codes"):
            rec["codes"] = p["codes"]
        if p.get("all_tithis"):
            rec["tithis"] = [[pk, n] for pk, n in p["all_tithis"]]
        if not rec.get("samvatsara"):
            for (pp, oth, _) in lst:                 # samvatsara often lives in
                mm = re.search(r"([A-Za-zĀ-ž]+)\s+Saṁvatsara", oth or "")   # the companion field
                if mm:
                    rec["samvatsara"] = mm.group(1)
                    break
        if also:
            rec["alsoTithi"] = also
        days[iso(d)] = rec

    for d, labels in obs.items():
        if iso(d) in days:
            days[iso(d)]["observances"] = sorted(labels)

    events = []
    for ev in almanac_evs:
        d = dt_of(ev)
        title = unesc(ev.get("SUMMARY", ""))
        if not d or not title:
            continue
        p = parse_line(unesc(ev.get("DESCRIPTION", "")))
        events.append({
            "date": iso(d),
            "title": title,
            "panchang": " ".join(x for x in [
                (p.get("paksha", "") + " " + p.get("tithi", "")).strip(),
                p.get("masa", ""), p.get("nakshatra", "")] if x),
        })
    events.sort(key=lambda x: (x["date"], x["title"]))

    out = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "Shri Chitrapur Math public calendar feeds (chitrapurmath.net)",
        "range": {"from": min(days), "to": max(days)} if days else {},
        "masa": MASA, "nakshatra": NAKSHATRA, "ritu": RITU,
        "days": days, "events": events,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    today = date.today().isoformat()
    print(f"days: {len(days)} (future {sum(1 for k in days if k >= today)})  "
          f"range {out['range']}")
    print(f"events: {len(events)} (future {sum(1 for e in events if e['date'] >= today)})")


if __name__ == "__main__":
    main()
