/* Google Analytics 4.
 *
 * ── To switch it on ───────────────────────────────────────────────
 *  1. Go to analytics.google.com → Admin → Create property.
 *  2. Add a Web data stream for https://akshaybangalorekar.github.io/chitrapur-panchang/
 *  3. Copy the Measurement ID (looks like G-ABCD1234XY).
 *  4. Paste it below, between the quotes, and commit.
 *
 * Until a valid ID is set, this file does nothing at all — no script is
 * fetched and no cookies are set.
 *
 * A note on IP addresses: GA4 never logs or stores them. It uses the IP
 * briefly to derive approximate location, then discards it. So GA4 can tell
 * you users / sessions / page views, but it cannot give you a raw unique-IP
 * count — that needs a server-side counter (see README).
 */
window.GA_MEASUREMENT_ID = "G-M7WVZYJLZ3";

(function () {
  "use strict";
  var id = (window.GA_MEASUREMENT_ID || "").trim();
  if (!/^G-[A-Z0-9]{4,}$/i.test(id)) return;   // not configured → do nothing

  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", id);
})();
