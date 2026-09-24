#!/usr/bin/env bash
# Деплой сайта на VPS (82.115.43.151, /opt/dcbakery).
#
# Оборванный деплой больше не роняет сайт: рабочая сборка откладывается в .next.prev,
# после сборки скрипт ждёт 200 от /api/ping, и при любой ошибке, обрыве связи или
# молчании сайта возвращает прежний коммит и прежнюю сборку.
#
# Ставится на сервер так:
#   sudo -i
#   cd /opt/dcbakery && git pull --ff-only
#   cp docs/deploy/deploy.sh deploy.sh && chmod +x deploy.sh
# Запускается так (TERM нужен, иначе tmux не знает xterm-kitty):
#   cd /opt/dcbakery && TERM=xterm tmux new -s deploy './deploy.sh 2>&1 | tee /var/log/dcbakery-deploy.log'
set -euo pipefail
cd /opt/dcbakery

PREV="$(git rev-parse --short HEAD)"
echo "было: $PREV"

rm -rf .next.prev
if [ -d .next ]; then cp -a .next .next.prev; fi

restore() {
  trap - ERR
  echo "ОШИБКА: возвращаю $PREV"
  git reset --hard "$PREV" >/dev/null
  npm ci || true
  rm -rf .next
  if [ -d .next.prev ]; then mv .next.prev .next; fi
  pm2 restart dcbakery || true
  echo "откат выполнен, сайт на $PREV"
  exit 1
}
trap restore ERR INT TERM HUP

git pull --ff-only
npm ci
npm run build
pm2 reload dcbakery

code=""
for _ in $(seq 1 10); do
  sleep 3
  code="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/ping || true)"
  if [ "$code" = "200" ]; then break; fi
done
[ "$code" = "200" ] || restore

trap - ERR
rm -rf .next.prev
echo "deployed: $(git rev-parse --short HEAD)"
