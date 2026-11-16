#!/bin/bash
# Startet die IBKR-Brücke automatisch bei jeder Mac-Anmeldung (LaunchAgent, Neustart bei Absturz).
# Entfernen: ./uninstall_autostart.sh
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST="$HOME/Library/LaunchAgents/local.ibkr-bridge.plist"
[ -x "$DIR/.venv/bin/python" ] || { python3 -m venv "$DIR/.venv"; "$DIR/.venv/bin/pip" install -q ib_insync==0.9.86; }
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>local.ibkr-bridge</string>
  <key>ProgramArguments</key><array>
    <string>$DIR/.venv/bin/python</string><string>-u</string><string>$DIR/bridge.py</string>
  </array>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>15</integer>
  <key>StandardOutPath</key><string>$DIR/bridge.log</string>
  <key>StandardErrorPath</key><string>$DIR/bridge.log</string>
</dict></plist>
PL
launchctl bootout "gui/$(id -u)/local.ibkr-bridge" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Autostart eingerichtet. Log: $DIR/bridge.log"
