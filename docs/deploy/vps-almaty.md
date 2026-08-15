# Переезд сайта на свой VPS (Ubuntu 24.04, Алматы) — пошагово

Для владельца, по шагам. VPS: 4 CPU / 8 ГБ / Ubuntu 24.04, Алматы. Домен **dc-bakery.kz**
остаётся — меняется только куда он указывает. Значит бот, Telegram и оплаты продолжат
работать без перенастройки. Supabase (Сеул) не трогаем.

Стек: **Node 22 + pm2** (держит сайт живым) за **Caddy** (сам делает HTTPS). Пишем всё как
**root**. Где нужно зайти в веб-панель — помечено 🌐, где выполнить в терминале VPS — 💻.

Что подготовить заранее:
- **IP вашего VPS** и пароль root (из панели провайдера VPS).
- Доступ в **Render** (скопировать переменные).
- Доступ в **GitHub** к репозиторию secretuum/dcbakery (добавить ключ).
- Доступ в **панель ps.kz** (сменить DNS).

---

## Шаг 1. Зайти на VPS по SSH (с вашего Windows)

💻 Откройте **PowerShell** (Пуск → наберите «PowerShell»). Введите (свой IP вместо `<IP>`):
```
ssh root@<IP>
```
Первый раз спросит «Are you sure… yes/no» — напишите `yes`. Введите пароль root (при вводе
пароль не отображается — это норма). Увидели приглашение вида `root@…:~#` — вы на сервере.

## Шаг 2. Система + Node 22 + pm2

💻 Скопируйте блок целиком, вставьте в терминал (в Windows Terminal вставка — правая кнопка
мыши), Enter:
```bash
apt update && apt -y upgrade
apt -y install git curl ufw
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt -y install nodejs
npm i -g pm2
timedatectl set-timezone Asia/Almaty
node -v
```
Успех: последняя строка показывает `v22.x.x`.

## Шаг 3. Ключ доступа к коду (GitHub deploy key)

💻 Создать ключ и показать его:
```bash
ssh-keygen -t ed25519 -C "dcbakery-vps" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```
Скопируйте всю выведенную строку (начинается с `ssh-ed25519 …`).

🌐 В браузере: GitHub → репозиторий **secretuum/dcbakery** → **Settings** → слева **Deploy keys**
→ **Add deploy key**. Title: `vps-almaty`. Key: вставьте строку. Галочку «Allow write access»
**НЕ** ставьте. Нажмите **Add key**.

💻 Забрать код на сервер:
```bash
mkdir -p /opt && cd /opt
GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=accept-new" git clone git@github.com:secretuum/dcbakery.git dcbakery
cd /opt/dcbakery
```
Успех: папка `/opt/dcbakery` с кодом (проверить: `ls`).

## Шаг 4. Переменные окружения (перенести с Render)

🌐 В браузере: **Render** → ваш сервис сайта → вкладка **Environment**. Там список переменных.
Их нужно перенести все. Удобно: у каждой переменной значок «показать значение».

💻 На сервере открыть пустой файл:
```bash
nano /opt/dcbakery/.env.local
```
Вписывайте построчно в формате `ИМЯ=значение` (по одной на строку), например:
```
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
GREEN_API_INSTANCE_ID=...
TELEGRAM_BOT_TOKEN=...
OPENAI_API_KEY=...
```
…и так все переменные с Render. **Обязательно добавьте в конец три строки:**
```
NEXT_PUBLIC_SITE_URL=https://dc-bakery.kz
NODE_ENV=production
PORT=3000
```
Сохранить и выйти из nano: **Ctrl+O**, Enter (записать), затем **Ctrl+X** (выход).

💻 Закрыть файл от посторонних (в нём секреты):
```bash
chmod 600 /opt/dcbakery/.env.local
```
> Без чего сайт не поднимется: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
> `SUPABASE_SERVICE_ROLE_KEY`, `CLIENT_SESSION_SECRET`, `DOCUMENT_TOKEN_SECRET`,
> `GREEN_API_*`, `TELEGRAM_BOT_TOKEN` (+ `*_WEBHOOK_SECRET`), `OPENAI_API_KEY`, а также
> роли `ADMIN_EMAILS`/`SUPERADMIN_EMAILS`/`MANAGER_EMAILS`/`TELEGRAM_MARKETER_IDS`.
> Проще перенести всё, чем гадать.

## Шаг 5. Сборка сайта

💻
```bash
cd /opt/dcbakery
npm ci
npm run build
```
Идёт пару минут. Успех: в конце таблица маршрутов и нет строки `Failed`. 8 ГБ RAM хватает.

## Шаг 6. Запуск + автозапуск при перезагрузке

💻
```bash
pm2 start npm --name dcbakery -- start
pm2 save
pm2 startup systemd -u root --hp /root
```
Если последняя команда напечатает готовую команду (`sudo env PATH=…`) — **скопируйте её и
выполните**. Проверка, что сайт отвечает локально:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/ping
```
Успех: `200`.

## Шаг 7. Caddy — HTTPS, сжатие, кэш статики

💻 Установить Caddy:
```bash
apt -y install debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt -y install caddy
```
💻 Записать конфиг (вставьте блок целиком):
```bash
cat > /etc/caddy/Caddyfile <<'EOF'
dc-bakery.kz, www.dc-bakery.kz {
    encode zstd gzip
    @static path /_next/static/*
    header @static Cache-Control "public, max-age=31536000, immutable"
    reverse_proxy localhost:3000
}
EOF
systemctl restart caddy
```
Сертификат Caddy получит сам, **как только домен будет указывать на VPS** (Шаг 9).

## Шаг 8. Файрвол

💻
```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

## Шаг 9. Переключить домен на VPS (в панели ps.kz)

🌐 Сначала в **Render** гляньте вкладку **Cron Jobs** (если есть) — запишите, какие URL и с
каким интервалом дёргаются (понадобится в Шаге 10).

🌐 В **панели ps.kz** → управление доменом **dc-bakery.kz** → DNS-записи:
1. У записи типа **A** для `dc-bakery.kz` снизьте **TTL** до `300` (чтобы переключение прошло быстро). Сохраните, подождите ~старый TTL.
2. **Render пока НЕ выключайте.**
3. Поменяйте значение A-записи `dc-bakery.kz` (и `www`, если есть) на **IP вашего VPS**. Сохраните.

💻 Через несколько минут проверьте на сервере:
```bash
curl -sI https://dc-bakery.kz | head -1
```
Успех: `HTTP/2 200` (или 308-редирект на /kk). Значит домен уже с VPS и HTTPS работает.

## Шаг 10. Плановые задачи (cron) на VPS

💻 Открыть расписание:
```bash
crontab -e
```
(если спросит редактор — выберите `nano`, номер 1). Вставьте, подставив реальные секреты из
вашего `.env.local` (интервалы сверьте с Render из Шага 9):
```
0 7 * * * curl -fsS "https://dc-bakery.kz/api/cron/overdue?secret=ВАШ_CRON_SECRET" >/dev/null
0 8 * * * curl -fsS "https://dc-bakery.kz/api/reminders/operations?secret=ВАШ_OPERATIONS_REMINDER_SECRET" >/dev/null
*/15 * * * * curl -fsS "https://dc-bakery.kz/api/payments/halyk/reconcile?secret=ВАШ_PAYMENTS_RECONCILE_SECRET" >/dev/null
```
(последнюю строку — только если оплаты Halyk включены). Сохранить: Ctrl+O, Enter, Ctrl+X.

## Шаг 11. Проверка (пройдите по списку)

- [ ] `https://dc-bakery.kz` открывается, замочек TLS зелёный.
- [ ] Каталог, карточка товара, корзина — работают.
- [ ] Тестовый заказ создаётся, уведомление приходит в Telegram.
- [ ] WhatsApp-бот отвечает.
- [ ] Вход в `/admin` (суперадмин), счёт/накладная открываются.
- [ ] `/admin/products/promo` → умная загрузка «Проанализировать» работает.

Всё зелёное → 🌐 в **Render** можно **остановить/удалить** сервис сайта. Готово, вы на своём VPS.

## Обновлять сайт потом (одной командой)

💻 Один раз создать скрипт:
```bash
cat > /opt/dcbakery/deploy.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
cd /opt/dcbakery
git pull --ff-only
npm ci
npm run build
pm2 reload dcbakery
echo "deployed: $(git rev-parse --short HEAD)"
EOF
chmod +x /opt/dcbakery/deploy.sh
```
Дальше после моих правок в GitHub вы просто заходите по SSH и запускаете:
```bash
/opt/dcbakery/deploy.sh
```

## Если что-то пошло не так (откат)

Пока Render не выключен — 🌐 верните в ps.kz A-запись на прежний IP Render, и сайт снова с
Render. Данные не теряются (всё в Supabase). Затем разберём ошибку по логам: `pm2 logs dcbakery`.

## Полезное

- Логи приложения: `pm2 logs dcbakery` (выход — Ctrl+C). Ротация логов: `pm2 install pm2-logrotate`.
- Перезапуск сайта вручную: `pm2 restart dcbakery`.
- Обновления ОС раз в пару недель: `apt update && apt -y upgrade`.
