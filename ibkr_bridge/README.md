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

## Startzeit („Kauf gültig ab")
Im Rechner über dem Knopf „An TWS senden" — Eingabe in **US-Ostküstenzeit (ET)**, z. B. `09:40`
(Knöpfe +10′ = 09:40, +30′ = 10:00). Die Brücke setzt daraus an der Kauforder das TWS-Feld
**Good After Time** (`YYYYMMDD HH:MM:SS US/Eastern`), der Kauf ist vorher inaktiv. Der Stopp hängt
am Kauf und wird ohnehin erst nach dessen Ausführung scharf. Leer = sofort ab Börseneröffnung.
Warum ET und nicht MEZ: Europa und die USA stellen die Uhr an verschiedenen Tagen um — „Open + 10 Min"
ist immer 09:40 ET, aber nicht immer 15:40 MEZ. Datum = heutiger US-Handelstag (nach 16:00 ET bzw.
am Wochenende der nächste Wochentag; US-Feiertage kennt die Brücke nicht).

## Sicherungen
Abgelehnt wird: Stopp ≥ Trigger, Limit > 1 % über Trigger, Stopp > 8 % unter Trigger,
Positionswert über der Kapitalgrenze aus dem Rechner, Modus im Tool ≠ verbundenes TWS, fremde Webseiten (nur Trading Tool).
