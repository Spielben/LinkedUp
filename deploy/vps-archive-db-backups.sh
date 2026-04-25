#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -eq 0 ]]; then
  echo "Run this script as a regular user with sudo rights, not as root."
  exit 1
fi

VOLUME_DB_DIR="${1:-/var/lib/docker/volumes/root_linkdup_data/_data}"
RETENTION_DAYS="${2:-7}"

if [[ ! -d "${VOLUME_DB_DIR}" ]]; then
  echo "Directory not found: ${VOLUME_DB_DIR}"
  exit 1
fi

echo "Scanning backup files in ${VOLUME_DB_DIR}"
mapfile -t backups < <(ls -1 "${VOLUME_DB_DIR}"/linkdup.db.bak-* 2>/dev/null || true)
if [[ "${#backups[@]}" -eq 0 ]]; then
  echo "No backup file found."
  exit 0
fi

echo "Found ${#backups[@]} backup file(s):"
for f in "${backups[@]}"; do
  stat -f "%Sm %N" -t "%Y-%m-%d %H:%M:%S" "${f}"
done

archive_dir="${VOLUME_DB_DIR}/archive-db-backups"
mkdir -p "${archive_dir}"

echo "Archiving current backup files to ${archive_dir}"
for f in "${backups[@]}"; do
  mv "${f}" "${archive_dir}/"
done

echo "Removing archived backups older than ${RETENTION_DAYS} days"
find "${archive_dir}" -type f -name "linkdup.db.bak-*" -mtime +"${RETENTION_DAYS}" -delete

echo "Done."
