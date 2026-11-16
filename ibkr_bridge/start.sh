#!/bin/bash
# Startet die IBKR-Brücke. Beim ersten Start wird eine eigene Python-Umgebung mit ib_insync angelegt.
cd "$(dirname "$0")"
if [ ! -x .venv/bin/python ]; then
  echo "Erster Start: richte Python-Umgebung ein ..."
  python3 -m venv .venv && .venv/bin/pip install -q --upgrade pip && .venv/bin/pip install -q ib_insync==0.9.86 || exit 1
fi
exec .venv/bin/python bridge.py "$@"
