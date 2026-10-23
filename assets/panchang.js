/* panchang.js — compact pañchāṅga timing engine (no dependencies).
   Computes sunrise/sunset, Rāhu Kāla, Yamagaṇḍa, Gulika, Abhijit muhūrta,
   and the exact start/end of each tithi, for any date and location.

   Longitude series are Meeus (abridged); sun-times follow NOAA.
   Tithi boundaries are global instants; sunrise-based windows depend on place. */
(function (root) {
  "use strict";
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;
  const norm360 = x => ((x % 360) + 360) % 360;
  const J1970 = 2440587.5;

  const toJD = date => date.getTime() / 86400000 + J1970;
  const fromJD = jd => new Date((jd - J1970) * 86400000);

  /* ── apparent geocentric ecliptic longitudes ─────────────── */
  function sunLong(jd) {
    const T = (jd - 2451545.0) / 36525;
    const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * D2R;
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M)
      + (0.019993 - 0.000101 * T) * Math.sin(2 * M)
      + 0.000289 * Math.sin(3 * M);
    const om = (125.04 - 1934.136 * T) * D2R;
    return norm360(L0 + C - 0.00569 - 0.00478 * Math.sin(om));
  }

  function moonLong(jd) {
    const T = (jd - 2451545.0) / 36525;
    const T2 = T * T, T3 = T2 * T, T4 = T3 * T;
    const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000;
    const D = (297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000) * D2R;
    const M = (357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000) * D2R;
    const Mp = (134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000) * D2R;
    const F = (93.2720950 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000) * D2R;
    const lon = Lp
      + 6.288774 * Math.sin(Mp)
      + 1.274027 * Math.sin(2 * D - Mp)
      + 0.658314 * Math.sin(2 * D)
      + 0.213618 * Math.sin(2 * Mp)
      - 0.185116 * Math.sin(M)
      - 0.114332 * Math.sin(2 * F)
      + 0.058793 * Math.sin(2 * D - 2 * Mp)
      + 0.057066 * Math.sin(2 * D - M - Mp)
      + 0.053322 * Math.sin(2 * D + Mp)
      + 0.045758 * Math.sin(2 * D - M)
      - 0.040923 * Math.sin(M - Mp)
      - 0.034720 * Math.sin(D)
      - 0.030383 * Math.sin(M + Mp)
      + 0.015327 * Math.sin(2 * D - 2 * F)
      - 0.012528 * Math.sin(Mp + 2 * F)
      + 0.010980 * Math.sin(Mp - 2 * F)
      + 0.010675 * Math.sin(4 * D - Mp)
      + 0.010034 * Math.sin(3 * Mp)
      + 0.008548 * Math.sin(4 * D - 2 * Mp)
      - 0.007888 * Math.sin(2 * D + M - Mp)
      - 0.006766 * Math.sin(2 * D + M)
      - 0.005163 * Math.sin(D - Mp)
      + 0.004987 * Math.sin(D + M)
      + 0.004036 * Math.sin(2 * D - M + Mp)
      + 0.003994 * Math.sin(2 * D + 2 * Mp)
      + 0.003861 * Math.sin(4 * D)
      + 0.003665 * Math.sin(2 * D - 3 * Mp);
    return norm360(lon);
  }

  const elong = jd => norm360(moonLong(jd) - sunLong(jd));
  const tithiIndex = jd => Math.floor(elong(jd) / 12);   // 0..29

  /* ── tithi boundaries over a window ──────────────────────── */
  function tithiBoundaries(jdFrom, jdTo) {
    const out = [];
    let prev = tithiIndex(jdFrom);
    const step = 0.02;
    for (let jd = jdFrom + step; jd <= jdTo; jd += step) {
      const idx = tithiIndex(jd);
      if (idx !== prev) {
        let a = jd - step, b = jd;
        for (let i = 0; i < 45; i++) {
          const mid = (a + b) / 2;
          if (tithiIndex(mid) === prev) a = mid; else b = mid;
        }
        out.push({ at: fromJD(b), from: prev, to: idx });
        prev = idx;
      }
    }
    return out;
  }

  /* ── sunrise / sunset (NOAA) ─────────────────────────────── */
  function dayOfYear(y, m, d) {
    return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000) + 1;
  }
  function sunEvent(y, m, d, lat, lon, rising) {
    const N = dayOfYear(y, m, d), lngHour = lon / 15;
    const t = N + ((rising ? 6 : 18) - lngHour) / 24;
    const M = 0.9856 * t - 3.289;
    let L = norm360(M + 1.916 * Math.sin(M * D2R) + 0.020 * Math.sin(2 * M * D2R) + 282.634);
    let RA = norm360(Math.atan(0.91764 * Math.tan(L * D2R)) * R2D);
    RA = (RA + (Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90)) / 15;
    const sinDec = 0.39782 * Math.sin(L * D2R);
    const cosDec = Math.cos(Math.asin(sinDec));
    const cosH = (Math.cos(90.833 * D2R) - sinDec * Math.sin(lat * D2R)) / (cosDec * Math.cos(lat * D2R));
    if (cosH > 1 || cosH < -1) return null;
    let H = (rising ? 360 - Math.acos(cosH) * R2D : Math.acos(cosH) * R2D) / 15;
    let UT = ((H + RA - 0.06571 * t - 6.622 - lngHour) % 24 + 24) % 24;
    return new Date(Date.UTC(y, m - 1, d) + UT * 3600000);
  }

  // order of the 8 day-parts (1-based) ruled by Rāhu / Yama / Gulika
  const RAHU = [8, 2, 7, 5, 6, 4, 3];   // Sun..Sat
  const YAMA = [5, 4, 3, 2, 1, 7, 6];
  const GULI = [7, 6, 5, 4, 3, 2, 1];
  function part(sunrise, sunset, idx) {           // idx is 1-based
    const span = (sunset - sunrise) / 8;
    return [new Date(sunrise.getTime() + (idx - 1) * span),
            new Date(sunrise.getTime() + idx * span)];
  }

  /* ── public: everything for one civil day at a place ─────── */
  function day(y, m, d, lat, lon, tzMin) {
    tzMin = tzMin || 0;
    const sunrise = sunEvent(y, m, d, lat, lon, true);
    const sunset = sunEvent(y, m, d, lat, lon, false);
    const res = { sunrise, sunset, rahu: null, yamaganda: null, gulika: null, abhijit: null, tithis: [] };
    if (sunrise && sunset) {
      const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      res.rahu = part(sunrise, sunset, RAHU[wd]);
      res.yamaganda = part(sunrise, sunset, YAMA[wd]);
      res.gulika = part(sunrise, sunset, GULI[wd]);
      const muh = (sunset - sunrise) / 15;
      res.abhijit = [new Date(sunrise.getTime() + 7 * muh), new Date(sunrise.getTime() + 8 * muh)];
    }
    // tithis touching the civil day, in the given timezone
    const dayStart = Date.UTC(y, m - 1, d) - tzMin * 60000;
    const dayEnd = dayStart + 86400000;
    const a = dayStart - 86400000, b = dayEnd + 86400000;
    const bs = tithiBoundaries(toJD(new Date(a)), toJD(new Date(b)));
    const segs = [];
    let cur = tithiIndex(toJD(new Date(a))), curStart = a;
    for (const x of bs) {
      segs.push({ index: cur, start: curStart, end: x.at.getTime() });
      cur = x.to;
      curStart = x.at.getTime();
    }
    segs.push({ index: cur, start: curStart, end: b });
    for (const s of segs) {
      if (s.end <= dayStart || s.start >= dayEnd) continue;
      res.tithis.push({
        index: s.index,
        paksha: s.index < 15 ? "Shukla" : "Krishna",
        num: (s.index % 15) + 1,
        start: new Date(s.start),
        end: new Date(s.end),
        began: s.start >= dayStart && s.start < dayEnd,   // starts during this day
        endsToday: s.end > dayStart && s.end <= dayEnd,   // ends during this day
      });
    }
    return res;
  }

  root.Panchang = { day, sunLong, moonLong, tithiIndex, toJD, fromJD };
})(typeof globalThis !== "undefined" ? globalThis : this);
