#!/bin/bash
# Daily pg_dump into /backups, keeping the newest $KEEP_DAYS days. Restore:
#   gunzip -c salmon-YYYYmmdd-HHMMSS.sql.gz | psql -h <host> -U salmon salmon
set -euo pipefail
while true; do
  stamp=$(date +%Y%m%d-%H%M%S)
  tmp="/backups/.salmon-$stamp.sql.gz.part"
  if pg_dump --no-owner --clean --if-exists | gzip -9 > "$tmp"; then
    mv "$tmp" "/backups/salmon-$stamp.sql.gz"
    echo "backup ok: salmon-$stamp.sql.gz"
    find /backups -name 'salmon-*.sql.gz' -mtime +"${KEEP_DAYS:-14}" -delete
  else
    rm -f "$tmp"
    echo "backup FAILED" >&2
  fi
  sleep 86400
done
