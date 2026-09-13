#!/usr/bin/env bash
#
# HRZN2.net — установка лендинга на VPS (Ubuntu/Debian), вариант A.
# Фронт (собранный статикой) и бэкенд живут одним Node-процессом,
# nginx отдаёт их по https + проксирует /api на внутренний порт.
#
# Запуск (на сервере, через Tabby):
#   sudo bash setup.sh <твой-домен>
# Пример:
#   sudo bash setup.sh hrzn2.net
#
# Скрипт безопасен и идемпотентен: панель 3x-ui НЕ трогает,
# только добавляет свой nginx-сайт и свою systemd-службу.
#
set -euo pipefail

DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
  echo "❌ Укажи домен: sudo bash setup.sh hrzn2.net" >&2
  exit 1
fi

APP_DIR="/opt/hrzn2-net"
GIT_URL="https://github.com/dozzzig/HRZN2.net.git"
BACKEND_PORT="5000"
SERVICE="hrzn2-backend"

log()  { echo -e "\n\033[1;34m==> $*\033[0m"; }
ok()   { echo -e "\033[1;32m   ✓ $*\033[0m"; }
warn() { echo -e "\033[1;33m   ! $*\033[0m"; }
die()  { echo -e "\n\033[1;31m❌ $*\033[0m" >&2; exit 1; }

# ---------------------------------------------------------------- root
[ "$(id -u)" = "0" ] || die "Запусти через sudo: sudo bash setup.sh $DOMAIN"

log "Проверяю порты 80/443 (чтобы не сломать панель)"
if command -v ss >/dev/null 2>&1; then
  P80=$(ss -ltn | awk '{print $4}' | grep -E ':80$' | head -1 || true)
  P443=$(ss -ltn | awk '{print $4}' | grep -E ':443$' | head -1 || true)
  if [ -n "$P80" ] || [ -n "$P443" ]; then
    warn "Порты 80/443 уже заняты ($P80 $P443). Это может быть веб-интерфейс 3x-ui или другой сайт."
    warn "Продолжаю, но добавлю наш сайт отдельным конфигом. Если конфликт — скажи мне."
    read -r -p "Продолжить? [y/N] " ans
    [[ "$ans" =~ ^[yY]$ ]] || die "Отменено пользователем"
  else
    ok "Порты 80/443 свободны"
  fi
fi

log "Проверяю Node.js"
if command -v node >/dev/null 2>&1; then
  ok "Node $(node -v)"
else
  warn "Node не найден — ставлю Node 20 LTS через NodeSource."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs >/dev/null
  ok "Node $(node -v)"
fi

log "Проверяю nginx и certbot"
if ! command -v nginx >/dev/null 2>&1; then
  apt-get update -y >/dev/null
  apt-get install -y nginx git >/dev/null
  ok "nginx установлен"
else
  ok "nginx уже есть"
fi
if ! command -v certbot >/dev/null 2>&1; then
  apt-get install -y certbot python3-certbot-nginx >/dev/null || warn "certbot не поставился — HTTPS сделаем позже"
fi

log "Клонирую/обновляю репозиторий в $APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --all 2>/dev/null || true
  git -C "$APP_DIR" reset --hard origin/main 2>/dev/null || true
  ok "Репозиторий обновлён"
else
  git clone "$GIT_URL" "$APP_DIR"
  ok "Репозиторий склонирован"
fi

log "Собираю фронтенд"
cd "$APP_DIR"
npm install --silent
npm run build
ok "Фронт собран (dist/)"

log "Ставлю зависимости бэкенда"
cd "$APP_DIR/server"
npm install --silent
ok "Зависимости бэкенда"

log "Создаю server/.env (если ещё нет)"
if [ -f ".env" ]; then
  ok ".env уже есть — не трогаю"
else
  cp .env.example .env
  warn "Создан .env из шаблона. СЕЙЧАС открой его и впиши:"
  warn "  1) DATABASE_URL= — строку Neon (обязательно после ротации)"
  warn "  2) PANEL_URL / PANEL_USERNAME / PANEL_PASSWORD — доступ к 3x-ui (когда дашь)"
  warn "  3) PORT=5000 — оставь"
  warn "  Файл: $APP_DIR/server/.env"
fi

log "Настраиваю systemd-службу $SERVICE"
cat > "/etc/systemd/system/${SERVICE}.service" <<UNIT
[Unit]
Description=HRZN2.net landing backend
After=network.target

[Service]
WorkingDirectory=$APP_DIR/server
ExecStart=/usr/bin/node index.js
Environment=NODE_ENV=production
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable "${SERVICE}" >/dev/null 2>&1 || true
systemctl restart "${SERVICE}" || warn "Служба не стартовала — проверь server/.env"
ok "Служба $SERVICE настроена"

log "Настраиваю nginx для $DOMAIN"
cat > "/etc/nginx/sites-available/hrzn2-net" <<NGINX
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX
ln -sf "/etc/nginx/sites-available/hrzn2-net" "/etc/nginx/sites-enabled/hrzn2-net"
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
ok "nginx настроен (домен $DOMAIN)"

log "Выпускаю HTTPS-сертификат (Let's Encrypt)"
if command -v certbot >/dev/null 2>&1; then
  if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect \
     --register-unsafely-without-email --no-eff-email ; then
    ok "HTTPS работает: https://$DOMAIN"
  else
    warn "certbot не смог выпустить сертификат. Проверь, что DNS домена указывает на IP этого сервера."
  fi
else
  warn "certbot не установлен — HTTPS настрой позже"
fi

log "══════ ГОТОВО ══════"
ok "Сайт:     http://$DOMAIN (или https://$DOMAIN)"
ok "Health:   curl http://localhost:$BACKEND_PORT/api/health"
warn "1) Не забудь вписать DATABASE_URL (Neon) в $APP_DIR/server/.env и перезапустить: sudo systemctl restart $SERVICE"
warn "2) Когда дашь доступ к панели — впиши PANEL_URL/PANEL_USERNAME/PANEL_PASSWORD туда же."
warn "3) Эта панель 3x-ui здесь же — на сервере. Сайт подключается к ней как localhost."