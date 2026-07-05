# Trading Tool

Persönliches Trading-Tool (Positions-Tracking, Stats, Journal, Rechner) für Daniel.
Live: https://trading-tool-181ce.web.app · Firebase-Projekt `trading-tool-181ce`.

---

## ⚠️ Wichtigste Regel für Änderungen

**Der gesamte App-Code ist inline in `index.html`** — ein großes `<script type="module">` (~2000 Zeilen).
Änderungen an der App IMMER in `index.html` machen.

### Tote Dateien — NICHT verwenden, NICHT als Referenz lesen
Diese werden von der laufenden App **nicht** geladen und sind veraltet. Sie lesen teils die **falschen** Firestore-Collections (leere top-level Collections) und führen in die Irre:

- `js/` (alle Dateien: app.js, calculator.js, firebase-config.js, ibkr.js, journal.js, positions.js, stats.js) — alte modulare Version, durch das Inline-`index.html` ersetzt.
- `css/style.css` — nicht referenziert (index.html nutzt inline CSS + Google-Fonts-CDN).
- `trading_tool_v1.html` — allererste Version.

Aktiv sind nur: **`index.html`** (die App) und **`redirect.html`** (OAuth-Redirect-Ziel, referenziert in index.html).

---

## Firestore-Struktur (verifiziert)

**Auth-UID (Daniel):** `OPfY8xdywLTU9wqWFwmtLRl7YFr2` · Google-Auth (`signInWithPopup`).

Alle Collections liegen als **Subcollections unter `users/{uid}/`** — NIE top-level (die sind leer!):

```
users/OPfY8xdywLTU9wqWFwmtLRl7YFr2/positions/{docId}   status: 'offen' | 'closed_partial'
users/OPfY8xdywLTU9wqWFwmtLRl7YFr2/trades/{docId}      status: 'closed'   (abgeschlossenes Archiv)
users/OPfY8xdywLTU9wqWFwmtLRl7YFr2/kandidaten/{docId}
users/OPfY8xdywLTU9wqWFwmtLRl7YFr2/passes/{docId}
users/OPfY8xdywLTU9wqWFwmtLRl7YFr2/settings/{depot|review_notes}
```

**Status-Konvention:** offene Positionen = `positions` mit `status:'offen'` (deutsch). Geschlossene Trades = `trades` mit `status:'closed'` (englisch). Nicht verwechseln.

### Storage-Architektur
- **localStorage** (`tt_positions`, `tt_trades`, …) = primärer Lese-Cache der App.
- **Firestore** = autoritativer Sync-Speicher; bei App-Start Firestore → localStorage gespiegelt.
- Der Stats-Tab rechnet aus localStorage (`LS.get(KEY_TRADES)`).

---

## Daten-Schema (Kernfelder)

**positions / trades** teilen sich weitgehend die Felder:
`ticker, entry, kaufdatum, aktien, stopp_hard, stopp_066r, stopp_033r, stopp_breakeven, stopp_aktuell, oneR, risk_pct, risk_eur, edge_count, setup_grad, theme, fomo, modus, kurs_aktuell, teilverkäufe[], status, updated_at`

Bei geschlossenen `trades` zusätzlich: `exit_datum, exit_kurs, exit_grund, pnl_abs, pnl_r, haltedauer, lernpunkt`.

### ⚠️ Feld-Gotcha
- **`oneR` ist NICHT R in $** — es ist der **+1R-Kurszielpreis** (= entry + R). Das echte R = `entry − stopp_hard`.
- `modus` (A/B) = Trail-Modus für den Stop-Trail-Prozess (von `/setupanalyse` gesetzt, von `/trail` gelesen).

---

## Admin-SDK-Zugriff (Skripte / Skills)

Service Account: `/Users/dgaubinger/Dev/Trading/trading-tool-181ce-firebase-adminsdk-fbsvc-e37af9bb04.json`

```js
const admin = require('.../node_modules/firebase-admin');
const sa = require('.../trading-tool-181ce-firebase-adminsdk-fbsvc-e37af9bb04.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const UID = 'OPfY8xdywLTU9wqWFwmtLRl7YFr2';
await db.collection('users').doc(UID).collection('positions').get();   // offene Positionen
```

## Zugehörige Claude-Skills
`/trail` (Stop nachziehen), `/entryline` & `/exitline` (TV-Linien), `/review` (Post-Trade-Analyse) — alle lesen die Subcollection oben. Details im Memory `reference_trading_skills`.

## Deploy
`firebase deploy` (Hosting). Braucht echtes Terminal-Login. no-cache-Header sind in `firebase.json` gesetzt.
