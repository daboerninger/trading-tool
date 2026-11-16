"""Brücke Trading Tool → TWS (16.11.2026).

Nimmt eine Order aus dem Trading Tool entgegen und legt sie in TWS als
Bracket-Order an — mit transmit=False. Die Order erscheint im TWS-Orderfenster,
geht aber NICHT an die Börse. Übermitteln musst du selbst in TWS.

Start:   ./start.sh            (erkennt selbst, welches TWS läuft: Paper 7497 oder Live 7496)
         ./start.sh --port 7497  (nur diesen Port)
         ./start.sh --dry-run  (ohne TWS: prüft nur und zeigt, was angelegt würde)
Normalerweise startet sie automatisch mit dem Mac (install_autostart.sh).

PAPER oder LIVE wird am Konto erkannt (Paper-Konten beginnen mit „D“), nicht am Port.
Das Tool schickt mit, welchen Modus es angezeigt hat (expect_mode); passt der
nicht zum verbundenen TWS, wird abgelehnt.

Das Trading Tool schickt per POST an http://127.0.0.1:8765/order:
  {"ticker": "DOCU", "shares": 12, "trigger": 81.40, "limit": 81.60,
   "stop": 79.10, "stop_limit": null, "max_notional": 450}
"""
import argparse
import json
import math
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

HOST, HTTP_PORT = "127.0.0.1", 8765
# Seiten, die die Brücke ansprechen dürfen (Trading Tool + lokale Tests).
ALLOWED_ORIGINS = {
    "https://trading-tool-181ce.web.app", "https://trading-tool-181ce.firebaseapp.com",
    "https://daboerninger.github.io",
    "http://localhost:5000", "http://127.0.0.1:5000",
    "http://localhost:8080", "http://127.0.0.1:8080",
}

ap = argparse.ArgumentParser()
ap.add_argument("--port", type=int, help="nur diesen TWS-Port versuchen (sonst 7497, dann 7496)")
ap.add_argument("--dry-run", action="store_true", help="ohne TWS, nur prüfen")
ap.add_argument("--client-id", type=int, default=17)
ap.add_argument("--allow-origin", action="append", default=[], help="zusätzliche erlaubte Seite (Tests)")
args = ap.parse_args()
ALLOWED_ORIGINS |= set(args.allow_origin)
PORTS = [args.port] if args.port else [7497, 7496]

ib = None
ib_lock = threading.Lock()
if not args.dry_run:
    from ib_insync import IB, Stock, Order  # noqa: E402
    ib = IB()


def check(o):
    """Plausibilität — lieber ablehnen als eine falsche Order anlegen."""
    err = []
    t = str(o.get("ticker", "")).strip().upper()
    if not t.isalnum() or len(t) > 6:
        err.append("Ticker ungültig")
    try:
        n = int(o.get("shares"))
        trig, lim, stp = float(o["trigger"]), float(o["limit"]), float(o["stop"])
    except Exception:
        return None, ["Stück, Trigger, Limit und Stopp sind Pflicht"]
    sl = o.get("stop_limit")
    sl = float(sl) if sl not in (None, "", 0) else None
    if n <= 0:
        err.append("Stückzahl muss > 0 sein")
    if not (stp < trig <= lim):
        err.append("Reihenfolge muss Stopp < Trigger ≤ Limit sein")
    if trig > 0 and lim / trig > 1.01:
        err.append(f"Limit liegt {(lim / trig - 1) * 100:.2f} % über dem Trigger (max. 1 %)")
    if trig > 0 and (trig - stp) / trig > 0.08:
        err.append("Stopp mehr als 8 % unter dem Trigger")
    if sl is not None and sl > stp:
        err.append("Stopp-Limit liegt über dem Stopp")
    mx = o.get("max_notional")
    if mx not in (None, "") and n * lim > float(mx) * 1.001:
        err.append(f"Positionswert {n * lim:.0f} über der Kapitalgrenze {float(mx):.0f}")
    r = lambda x: round(x, 2) if x >= 1 else round(x, 4)
    return dict(ticker=t, shares=n, trigger=r(trig), limit=r(lim), stop=r(stp),
                stop_limit=r(sl) if sl else None), err


def ensure_connected():
    """Verbindet bei Bedarf mit dem TWS, das gerade läuft. Liefert (Modus, Port)."""
    if not ib.isConnected():
        last = None
        for port in PORTS:
            try:
                ib.connect("127.0.0.1", port, clientId=args.client_id, timeout=4)
                break
            except Exception as e:
                last = e
                try:
                    ib.disconnect()
                except Exception:
                    pass
        else:
            raise RuntimeError(f"TWS nicht erreichbar ({last.__class__.__name__})")
    accts = ib.managedAccounts()
    mode = "PAPER" if accts and all(a.startswith("D") for a in accts) else "LIVE"
    return mode, ib.client.port


def current_mode():
    if args.dry_run:
        return "TROCKENLAUF", None
    with ib_lock:
        return ensure_connected()


def place(o):
    """Bracket: Kauf STP LMT (DAY) + angehängter Stopp (GTC), alles transmit=False."""
    with ib_lock:
        ensure_connected()
        c = Stock(o["ticker"], "SMART", "USD")
        if not ib.qualifyContracts(c):
            raise RuntimeError(f"{o['ticker']} bei IBKR nicht gefunden")
        parent = Order(action="BUY", orderType="STP LMT", totalQuantity=o["shares"],
                       auxPrice=o["trigger"], lmtPrice=o["limit"], tif="DAY",
                       outsideRth=False, transmit=False)
        parent.orderId = ib.client.getReqId()
        if o["stop_limit"]:
            child = Order(action="SELL", orderType="STP LMT", auxPrice=o["stop"], lmtPrice=o["stop_limit"])
        else:
            child = Order(action="SELL", orderType="STP", auxPrice=o["stop"])
        child.totalQuantity = o["shares"]
        child.tif = "GTC"
        child.parentId = parent.orderId
        child.transmit = False
        t1 = ib.placeOrder(c, parent)
        t2 = ib.placeOrder(c, child)
        ib.sleep(1.0)
        return [t1.order.orderId, t2.order.orderId]


class H(BaseHTTPRequestHandler):
    def _cors(self):
        origin = self.headers.get("Origin", "")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path != "/status":
            return self._json(404, {"ok": False})
        try:
            mode, port = current_mode()
        except Exception as e:
            return self._json(200, {"ok": True, "mode": None, "tws": False, "error": str(e)[:200]})
        self._json(200, {"ok": True, "mode": mode, "tws": True if port else None, "port": port})

    def do_POST(self):
        if self.path != "/order":
            return self._json(404, {"ok": False})
        if self.headers.get("Origin", "") not in ALLOWED_ORIGINS:
            return self._json(403, {"ok": False, "error": "Herkunft nicht erlaubt"})
        try:
            n = int(self.headers.get("Content-Length", 0))
            raw = json.loads(self.rfile.read(min(n, 10000)) or b"{}")
        except Exception:
            return self._json(400, {"ok": False, "error": "kein gültiges JSON"})
        o, err = check(raw)
        if err:
            print("ABGELEHNT", raw, err, flush=True)
            return self._json(422, {"ok": False, "error": " · ".join(err)})
        try:
            mode, _ = current_mode()
        except Exception as e:
            return self._json(502, {"ok": False, "error": str(e)[:200]})
        exp = raw.get("expect_mode")
        if exp and exp != mode:
            print("ABGELEHNT Modus", exp, "erwartet, verbunden", mode, flush=True)
            return self._json(409, {"ok": False, "error": f"Tool zeigte {exp}, verbunden ist aber {mode} — Seite neu prüfen"})
        text = (f"{o['ticker']}: KAUF {o['shares']} STP LMT {o['trigger']}/{o['limit']} DAY"
                f" · STOPP {'STP LMT ' + str(o['stop']) + '/' + str(o['stop_limit']) if o['stop_limit'] else 'STP ' + str(o['stop'])} GTC")
        if args.dry_run:
            print("TROCKENLAUF", text, flush=True)
            return self._json(200, {"ok": True, "mode": mode, "order": o, "text": text, "ids": None})
        try:
            ids = place(o)
        except Exception as e:
            print("FEHLER", text, e, flush=True)
            return self._json(502, {"ok": False, "error": str(e)[:300]})
        print(f"ANGELEGT ({mode}, nicht übermittelt)", text, ids, flush=True)
        self._json(200, {"ok": True, "mode": mode, "order": o, "text": text, "ids": ids})


if __name__ == "__main__":
    print(f"IBKR-Brücke · {'TROCKENLAUF' if args.dry_run else 'TWS-Ports ' + '/'.join(map(str, PORTS))} · http://{HOST}:{HTTP_PORT}", flush=True)
    print("Orders werden NUR angelegt (transmit=False). Übermitteln in TWS selbst. Beenden: Ctrl+C", flush=True)
    try:
        # einthreadig: ib_insync braucht seinen Event-Loop im Hauptthread
        HTTPServer((HOST, HTTP_PORT), H).serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        if ib and ib.isConnected():
            ib.disconnect()
