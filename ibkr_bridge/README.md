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

## Start
Läuft automatisch ab der Mac-Anmeldung (LaunchAgent `local.ibkr-bridge`, Log `bridge.log`).
Sie erkennt selbst, welches TWS läuft (Port 7497 oder 7496) und ob es Paper oder Live ist
(Paper-Konten beginnen mit „D"). Das Tool zeigt den Modus unter dem Knopf und in der Rückfrage.

    ./install_autostart.sh     # Autostart einrichten
    ./uninstall_autostart.sh   # Autostart entfernen (z. B. bei Workflow-Wechsel)
    ./start.sh --dry-run       # manuell, ohne TWS, nur prüfen (Autostart vorher beenden)

## Sicherungen
Abgelehnt wird: Stopp ≥ Trigger, Limit > 1 % über Trigger, Stopp > 8 % unter Trigger,
Positionswert über der Kapitalgrenze aus dem Rechner, Modus im Tool ≠ verbundenes TWS, fremde Webseiten (nur Trading Tool).
