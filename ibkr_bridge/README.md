# IBKR-Brücke (Trading Tool → TWS)

Legt die Order aus dem Rechner („An TWS senden") in **TWS** als Bracket-Order an:
Kauf STP LMT (DAY) + angehängter Stopp STP (GTC). **transmit=False** — die Order
erscheint im TWS-Orderfenster, geht aber erst an die Börse, wenn du dort „Übermitteln" klickst.

## Einmalig in TWS
Datei → Globale Konfiguration → API → Einstellungen:
- ActiveX- und Socket-Clients aktivieren ✅
- Schreibgeschützte API ⬜
- Nur Verbindungen vom lokalen Host zulassen ✅
- Socket Port: Paper 7497 · Live 7496

## Start (Terminal, vor 15:40 MEZ)
    ~/Dev/Trading/Trading_Tool/ibkr_bridge/start.sh            # Paper Trading
    ~/Dev/Trading/Trading_Tool/ibkr_bridge/start.sh --live     # Live
    ~/Dev/Trading/Trading_Tool/ibkr_bridge/start.sh --dry-run  # ohne TWS, nur prüfen

Beim ersten Start wird `.venv` mit `ib_insync` angelegt. Beenden mit Ctrl+C.

## Sicherungen
Abgelehnt wird: Stopp ≥ Trigger, Limit > 1 % über Trigger, Stopp > 8 % unter Trigger,
Positionswert über der Kapitalgrenze aus dem Rechner, fremde Webseiten (nur Trading Tool).
