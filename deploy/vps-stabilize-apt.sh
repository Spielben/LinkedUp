#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -eq 0 ]]; then
  echo "Run this script as a regular user with sudo rights, not as root."
  exit 1
fi

echo "Backing up APT sources..."
timestamp="$(date +%Y%m%d-%H%M%S)"
sudo cp /etc/apt/sources.list "/etc/apt/sources.list.bak-${timestamp}"
sudo mkdir -p /etc/apt/sources.list.d.bak-linkdup

if ls /etc/apt/sources.list.d/*.list >/dev/null 2>&1; then
  for list_file in /etc/apt/sources.list.d/*.list; do
    sudo cp "${list_file}" "/etc/apt/sources.list.d.bak-linkdup/$(basename "${list_file}").${timestamp}"
  done
fi

echo "Running APT health sequence..."
sudo apt-get update
sudo apt-get --fix-broken install -y
sudo apt-get install -y sqlite3
sudo apt-get autoremove -y
sudo apt-get clean

echo "APT is stabilized and sqlite3 is installed."
