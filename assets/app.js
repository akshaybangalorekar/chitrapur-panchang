/* Shri Chitrapur Math Panchang — static site logic.
   Data: data/panchang.json (rebuilt daily from the Math's public feeds). */
(() => {
  "use strict";

  const TITHI_NAMES = ["Pratipada", "Dwithiya", "Tritiya", "Chaturthi", "Panchami",
    "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami", "Ekadashi",
    "Dwadashi", "Trayodashi", "Chaturdashi", "Purnima"];
  const STORE = "chitrapur.people.v1";
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];

  let DATA = null, KEYS = [], dayMap = null;

  /* ── date helpers (all local-time) ───────────────────────── */
  const pad = n => String(n).padStart(2, "0");
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromISO = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = fromISO(s); d.setDate(d.getDate() + n); return iso(d); };
  const todayISO = () => iso(new Date());
  const daysBetween = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 86400000);
  const prettyDate = s => { const d = fromISO(s);
    return `${DOW[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`; };
  const prettyShort = s => { const d = fromISO(s); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`; };
  const inWords = n => n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`;
  const nakAbbr = n => (n || "").slice(0, 3).toUpperCase();
  const tithiLabel = (pak, n) => n >= 15
    ? (pak === "Shukla" ? "Purnima" : "Amavasya") : TITHI_NAMES[n - 1];
  function codeLabel(codes) {
    if (!codes || !codes.length) return "";
    if (codes.length === 1) return codes[0];
    const pak = codes[0].slice(0, 2);
    return codes.every(c => c.slice(0, 2) === pak)
      ? pak + codes.map(c => c.slice(2)).join("/") : codes.join("/");
  }
  const dayTithis = r => (r.tithis && r.tithis.length) ? r.tithis : [[r.paksha, r.tithiNum]];

  /* ── data ────────────────────────────────────────────────── */
  async function boot() {
    try {
      const res = await fetch("data/panchang.json", { cache: "no-cache" });
      if (!res.ok) throw new Error(res.status);
      DATA = await res.json();
    } catch (e) {
      document.getElementById("t-tithi").textContent = "Could not load pañchāṅga data";
      document.getElementById("data-note").textContent =
        "Run scripts/build_data.py to generate data/panchang.json.";
      return;
    }
    dayMap = DATA.days;
    KEYS = Object.keys(dayMap).sort();
    initHeader();
    initSelects();
    renderToday(todayISO());
    renderReminders();
    renderPeople();
    monthCursor = (todayISO() in dayMap ? todayISO() : KEYS[KEYS.length - 1]).slice(0, 7);
    renderMonth();
    initControls();
    const r = DATA.range || {};
    document.getElementById("data-note").textContent =
      `Pañchāṅga data covers ${prettyDate(r.from)} – ${prettyDate(r.to)} · updated ${(DATA.generated || "").slice(0, 10)}`;
  }

  function rec(date) { return dayMap[date] || null; }

  function eventsOn(date) { return (DATA.events || []).filter(e => e.date === date); }

  /* ── header ──────────────────────────────────────────────── */
  function initHeader() {
    const t = new Date();
    document.getElementById("hd-weekday").textContent = DOW[t.getDay()];
    document.getElementById("hd-date").textContent = `${t.getDate()} ${MONTHS[t.getMonth()]} ${t.getFullYear()}`;
  }

  /* ── today card ──────────────────────────────────────────── */
  function renderToday(date) {
    const r = rec(date);
    const set = (id, v) => document.getElementById(id).textContent = v || "—";
    document.getElementById("t-date").textContent =
      prettyDate(date) + (date === todayISO() ? " · today" : "");

    if (!r) {
      set("t-tithi", "Not in the calendar data");
      ["t-paksha", "t-masa", "t-ritu", "t-nak", "t-samvatsara"].forEach(i => set(i, "—"));
      document.getElementById("t-obs").innerHTML = "";
      document.getElementById("t-alt").hidden = true;
      return;
    }
    const chip = document.getElementById("t-paksha");
    chip.textContent = r.paksha + " paksha";
    chip.className = "paksha-chip" + (r.paksha === "Krishna" ? " krishna" : "");
    const names = [...new Set(dayTithis(r).map(([pk, n]) => tithiLabel(pk, n)))];
    set("t-tithi", names.join(" / "));
    set("t-masa", r.masa);
    set("t-ritu", r.ritu);
    set("t-nak", r.nakshatra);
    set("t-samvatsara", r.samvatsara);

    const alt = document.getElementById("t-alt");
    const cl = codeLabel(r.codes);
    alt.hidden = !cl || r.codes.length < 2;
    alt.textContent = cl;

    const obs = document.getElementById("t-obs");
    obs.innerHTML = "";
    (r.observances || []).forEach(o => {
      const s = document.createElement("span");
      s.className = "chip" + (/purnima|amavasya/i.test(o) ? " gold" : "");
      s.textContent = o;
      obs.appendChild(s);
    });
    eventsOn(date).forEach(e => {
      const s = document.createElement("span");
      s.className = "chip gold";
      s.textContent = e.title;
      obs.appendChild(s);
    });
  }

  /* ── reminders ───────────────────────────────────────────── */
  function collectUpcoming(windowDays) {
    const t = todayISO(), end = addDays(t, windowDays), items = [];
    for (const e of DATA.events || []) {
      if (e.date >= t && e.date <= end)
        items.push({ date: e.date, title: e.title, kind: "event", meta: e.panchang });
    }
    for (let d = t, i = 0; i <= windowDays; d = addDays(d, 1), i++) {
      const r = rec(d);
      if (r) for (const o of r.observances || [])
        items.push({ date: d, title: o, kind: "obs", meta: `Tithi: ${codeLabel(r.codes) || r.tithi}` });
    }
    for (const p of loadPeople()) {
      const nd = nextBirthday(p, t);
      if (nd && nd <= end) {
        const r = rec(nd);
        items.push({ date: nd, title: p.name, kind: "birthday", person: p,
          meta: r ? `${r.paksha} ${r.tithi} · ${r.masa}` : "birthday" });
      }
    }
    items.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    return items;
  }

  function renderReminders() {
    const win = +(document.getElementById("window-days").value || 10);
    const items = collectUpcoming(win);
    const list = document.getElementById("reminder-list");
    list.innerHTML = "";
    document.getElementById("rem-empty").hidden = items.length > 0;
    const t = todayISO();
    const seen = new Set();

    for (const it of items) {
      const key = it.date + "|" + it.title;
      if (seen.has(key)) continue;
      seen.add(key);
      const n = daysBetween(t, it.date);
      const li = document.createElement("li");

      const when = document.createElement("div");
      when.className = "when" + (n <= 2 ? " soon" : "");
      when.innerHTML = `<span class="d">${prettyShort(it.date)}</span><span class="in">${inWords(n)}</span>`;

      const body = document.createElement("div");
      const tag = it.kind === "obs" ? `<span class="tag obs">Observance</span>`
        : it.kind === "birthday" ? `<span class="tag mine">Birthday</span>`
        : `<span class="tag">Mat͟h</span>`;
      const extra = it.meta ? `<div class="ev-meta">${esc(it.meta)}</div>` : "";
      body.innerHTML = `<div class="ev-title">${tag}${esc(it.title)}</div>${extra}`;

      li.append(when, body);
      list.appendChild(li);
    }
    renderBanner(items, t);
  }

  function renderBanner(items, t) {
    const b = document.getElementById("alert-banner");
    if (!items.length) { b.hidden = true; return; }
    const next = items[0];
    const n = daysBetween(t, next.date);
    if (n > 3) { b.hidden = true; return; }
    b.hidden = false;
    b.innerHTML = n === 0
      ? `<b>Today:</b> ${esc(next.title)}`
      : `<b>${n === 1 ? "Tomorrow" : "In " + n + " days"} (${prettyShort(next.date)}):</b> ${esc(next.title)}`;
  }

  /* ── people (localStorage) ───────────────────────────────── */
  function loadPeople() {
    try { return JSON.parse(localStorage.getItem(STORE)) || []; } catch { return []; }
  }
  function savePeople(list) { localStorage.setItem(STORE, JSON.stringify(list)); }

  function nextBirthday(p, from) {
    const end = addDays(from, 800);
    for (const k of KEYS) {
      if (k < from || k > end) continue;
      const r = dayMap[k];
      if (p.masa && r.masa !== p.masa) continue;
      if (p.basis === "tithi" || p.basis === "both") {
        if (!dayTithis(r).some(([pk, n]) => pk === p.paksha && n === p.tithiNum)) continue;
      }
      if (p.basis === "nakshatra" || p.basis === "both") {
        if (r.nakshatra !== p.nak) continue;
      }
      return k;
    }
    return null;
  }

  function describe(p) {
    const bits = [];
    if (p.basis !== "nakshatra") bits.push(`${p.paksha} ${tithiLabel(p.paksha, p.tithiNum)}`);
    if (p.basis !== "tithi") bits.push(p.nak);
    if (p.masa) bits.push(p.masa + " māsa");
    return bits.join(" · ");
  }

  function renderPeople() {
    const list = loadPeople();
    const ul = document.getElementById("ppl-list");
    ul.innerHTML = "";
    document.getElementById("ppl-empty").hidden = list.length > 0;
    const t = todayISO();

    list.map(p => ({ p, nd: nextBirthday(p, t) }))
      .sort((a, b) => (a.nd || "9999") < (b.nd || "9999") ? -1 : 1)
      .forEach(({ p, nd }) => {
        const li = document.createElement("li");
        const left = document.createElement("div");
        left.innerHTML = `<div class="p-name">${esc(p.name)}</div><div class="p-desc">${esc(describe(p))}</div>`;
        const right = document.createElement("div");
        right.className = "p-when";
        right.innerHTML = nd
          ? `<span class="d">${prettyShort(nd)}</span><span class="in">${inWords(daysBetween(t, nd))}</span>`
          : `<span class="in">outside data range</span>`;
        const acts = document.createElement("div");
        acts.className = "p-actions";
        acts.innerHTML = `<button class="icon-btn" data-edit="${p.id}" title="Edit">✎</button>
                          <button class="icon-btn" data-del="${p.id}" title="Remove">✕</button>`;
        const wrap = document.createElement("div");
        wrap.style.cssText = "display:flex;align-items:center;gap:12px";
        wrap.append(right, acts);
        li.append(left, wrap);
        ul.appendChild(li);
      });
  }

  /* ── form ────────────────────────────────────────────────── */
  function initSelects() {
    fill("ppl-masa", ["", ...DATA.masa], ["Any māsa", ...DATA.masa]);
    fill("ppl-nak", ["", ...DATA.nakshatra], ["Select nakshatra", ...DATA.nakshatra]);
    const tithi = document.getElementById("ppl-tithi");
    tithi.innerHTML = "";
    for (let i = 1; i <= 15; i++) {
      const o = document.createElement("option");
      o.value = i; o.textContent = i === 15 ? "Purnima / Amavasya" : TITHI_NAMES[i - 1];
      tithi.appendChild(o);
    }
  }
  function fill(id, values, labels) {
    const el = document.getElementById(id);
    el.innerHTML = "";
    values.forEach((v, i) => {
      const o = document.createElement("option");
      o.value = v; o.textContent = labels ? labels[i] : v;
      el.appendChild(o);
    });
  }

  function syncBasis() {
    const b = document.getElementById("ppl-basis").value;
    document.getElementById("f-tithi").classList.toggle("hidden-field", b === "nakshatra");
    document.getElementById("f-paksha").classList.toggle("hidden-field", b === "nakshatra");
    document.getElementById("f-nak").classList.toggle("hidden-field", b === "tithi");
  }

  function resetForm() {
    document.getElementById("ppl-form").reset();
    document.getElementById("ppl-id").value = "";
    document.getElementById("ppl-submit").textContent = "Add";
    document.getElementById("ppl-cancel").hidden = true;
    syncBasis();
  }

  function onSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("ppl-id").value;
    const p = {
      id: id || "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: document.getElementById("ppl-name").value.trim(),
      basis: document.getElementById("ppl-basis").value,
      masa: document.getElementById("ppl-masa").value,
      paksha: document.getElementById("ppl-paksha").value,
      tithiNum: +document.getElementById("ppl-tithi").value,
      nak: document.getElementById("ppl-nak").value,
    };
    if (!p.name) return;
    const list = loadPeople();
    const i = list.findIndex(x => x.id === p.id);
    if (i >= 0) list[i] = p; else list.push(p);
    savePeople(list);
    resetForm();
    renderPeople();
    renderReminders();
  }

  function editPerson(id) {
    const p = loadPeople().find(x => x.id === id);
    if (!p) return;
    document.getElementById("ppl-id").value = p.id;
    document.getElementById("ppl-name").value = p.name;
    document.getElementById("ppl-basis").value = p.basis;
    document.getElementById("ppl-masa").value = p.masa || "";
    document.getElementById("ppl-paksha").value = p.paksha;
    document.getElementById("ppl-tithi").value = p.tithiNum;
    document.getElementById("ppl-nak").value = p.nak || "";
    document.getElementById("ppl-submit").textContent = "Save";
    document.getElementById("ppl-cancel").hidden = false;
    syncBasis();
    document.getElementById("ppl-form").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function delPerson(id) {
    if (!confirm("Remove this person?")) return;
    savePeople(loadPeople().filter(x => x.id !== id));
    renderPeople();
    renderReminders();
  }

  /* ── month view ──────────────────────────────────────────── */
  let monthCursor = null;

  function renderMonth() {
    const [y, m] = monthCursor.split("-").map(Number);
    document.getElementById("mo-label").textContent = `${MONTHS[m - 1]} ${y}`;
    const grid = document.getElementById("month-grid");
    grid.innerHTML = "";
    DOW.forEach(d => { const c = document.createElement("div"); c.className = "dow"; c.textContent = d; grid.appendChild(c); });

    const first = new Date(y, m - 1, 1);
    for (let i = 0; i < first.getDay(); i++) {
      const b = document.createElement("div"); b.className = "day blank"; grid.appendChild(b);
    }
    const dim = new Date(y, m, 0).getDate();
    for (let day = 1; day <= dim; day++) {
      const ds = `${y}-${pad(m)}-${pad(day)}`;
      const r = rec(ds);
      const cell = document.createElement("button");
      cell.className = "day" + (ds === todayISO() ? " today" : "");
      cell.type = "button";
      let html = `<span class="num">${day}</span>`;
      if (r) {
        const kr = r.paksha === "Krishna";
        html += `<span class="t${kr ? " kr" : ""}">${codeLabel(r.codes) || ((kr ? "KR" : "SH") + r.tithiNum)}</span>`;
        html += `<span class="nk">${nakAbbr(r.nakshatra)}</span>`;
        const marks = [];
        const obs = (r.observances || []).join(" ");
        if (/Purnima/.test(obs) || r.tithi === "Purnima") marks.push('<span class="mk purnima"></span>');
        if (/Amavasya/.test(obs) || r.tithi === "Amavasya") marks.push('<span class="mk amavasya"></span>');
        if ((r.observances || []).some(o => /Ekadashi|Pradosh|Sankashti/.test(o))) marks.push('<span class="mk obs"></span>');
        if (eventsOn(ds).length) marks.push('<span class="mk event"></span>');
        if (marks.length) html += `<span class="marks">${marks.join("")}</span>`;
      }
      cell.innerHTML = html;
      cell.addEventListener("click", () => showDayDetail(ds));
      grid.appendChild(cell);
    }
  }

  function showDayDetail(ds) {
    const r = rec(ds), box = document.getElementById("day-detail");
    box.hidden = false;
    if (!r) { box.innerHTML = `<h4>${prettyDate(ds)}</h4><p class="muted">Not in the calendar data.</p>`; return; }
    const evs = eventsOn(ds);
      const obs = (r.observances || []);
      const nm = [...new Set(dayTithis(r).map(([pk, n]) => tithiLabel(pk, n)))].join(" / ");
      let html = `<h4>${prettyDate(ds)}</h4>
      <p style="margin:0"><strong>${r.paksha} ${nm}</strong> · ${r.masa} māsa · ${r.nakshatra} · ${r.samvatsara || ""}</p>`;
    if (obs.length) html += `<p style="margin:6px 0 0"><span class="muted">Observances:</span> ${obs.map(esc).join(", ")}</p>`;
    if (evs.length) html += `<ul>${evs.map(e => `<li><strong>${esc(e.title)}</strong>${e.panchang ? ` — <span class="muted">${esc(e.panchang)}</span>` : ""}</li>`).join("")}</ul>`;
    const ppl = loadPeople().filter(p => nextBirthday(p, ds) === ds);
    if (ppl.length) html += `<p style="margin:6px 0 0"><span class="muted">Birthdays:</span> ${ppl.map(p => esc(p.name)).join(", ")}</p>`;
    box.innerHTML = html;
  }

  /* ── controls ────────────────────────────────────────────── */
  function initControls() {
    let cursor = todayISO();
    const step = n => { cursor = addDays(cursor, n); renderToday(cursor); };
    document.getElementById("prev-day").onclick = () => step(-1);
    document.getElementById("next-day").onclick = () => step(1);
    document.getElementById("today-btn").onclick = () => { cursor = todayISO(); renderToday(cursor); };

    document.getElementById("window-days").onchange = renderReminders;

    document.getElementById("ppl-basis").onchange = syncBasis;
    document.getElementById("ppl-form").addEventListener("submit", onSubmit);
    document.getElementById("ppl-cancel").onclick = resetForm;
    document.getElementById("ppl-list").addEventListener("click", e => {
      const ed = e.target.closest("[data-edit]"), dl = e.target.closest("[data-del]");
      if (ed) editPerson(ed.dataset.edit);
      if (dl) delPerson(dl.dataset.del);
    });

    document.getElementById("ppl-export").onclick = () => {
      const blob = new Blob([JSON.stringify(loadPeople(), null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "my-people.json"; a.click();
      URL.revokeObjectURL(a.href);
    };
    document.getElementById("ppl-import").onclick = () => document.getElementById("ppl-file").click();
    document.getElementById("ppl-file").onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const arr = JSON.parse(rd.result);
          if (Array.isArray(arr)) { savePeople(arr); renderPeople(); renderReminders(); }
        } catch { alert("That file could not be read."); }
      };
      rd.readAsText(f);
    };

    document.getElementById("mo-prev").onclick = () => shiftMonth(-1);
    document.getElementById("mo-next").onclick = () => shiftMonth(1);
    syncBasis();
  }

  function shiftMonth(n) {
    let [y, m] = monthCursor.split("-").map(Number);
    m += n; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; }
    monthCursor = `${y}-${pad(m)}`;
    document.getElementById("day-detail").hidden = true;
    renderMonth();
  }

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  document.addEventListener("DOMContentLoaded", boot);
})();
