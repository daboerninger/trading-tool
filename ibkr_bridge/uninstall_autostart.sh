#!/bin/bash
# Entfernt den Autostart der IBKR-Brücke wieder.
launchctl bootout "gui/$(id -u)/local.ibkr-bridge" 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/local.ibkr-bridge.plist"
echo "Autostart entfernt."
