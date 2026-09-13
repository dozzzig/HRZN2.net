#!/usr/bin/env bash
#
# HRZN2.net — установка лендинга на VPS (Ubuntu/Debian), вариант A.
# Фронт (собранный статикой) и бэкенд живут одним Node-процессом.
#
# ОСОБЕННОСТИ этого VPS (проверено):
#   - порт 443 занят xray (VLESS/Reality вход панели 3x-ui) — ЕГО НЕ ТРОГАЕМ,
#     иначе упадут все VPN-клиенты; поэтому сайт работает по HTTP на 80;
#   - nginx уже установлен и слушает 80 — НЕ ставим свой, а добавляем
#     server_name для нашего домена в существующий nginx.
#
# Запуск (на сервере, через Tabby):
#   sudo bash setup.sh <твой-домен>
# Пример:
#   sudo bash setup.sh hrzn2.top
#
set -euo pipefail

DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
  echo "❌ Укажи домен: sudo bash setup.sh hrzn2.top" >&2
  exit 1
fi

APP_DIR="/opt/hrzn2-net"
GIT_URL="https://github.com/dozzzig/HRZN2.net.git"
BACKEND_PORT="5000"
SERVICE="hrzn2-backend"
NGINX_SITE="hrzn2-net"

log()  { echo -e "\n\033[1;34m==> $*\033[0m"; }
ok()   { echo -e "\033[1;32m   ✓ $*\033[0m"; }
warn() { echo -e "\033[1;33m   ! $*\033[0m"; }
die()  { echo -e "\n\033[1;31m❌ $*\033[0m" >&2; exit 1; }

# ---------------------------------------------------------------- root
[ "$(id -u)" = "0" ] || die "Запусти через sudo: sudo bash setup.sh $DOMAIN"

# ---------------------------------------------------------------- порты
log "Проверяю порты 80/443 (чтобы НЕ сломать панель 3x-ui и VPN-клиентов)"
NGINX_EXISTS=0
HTTPS_OK=0

if command -v ss >/dev/null 2>&1; then
  P80=$(ss -ltnp | grep -E ':80\b' | head -3 || true)
  P443=$(ss -ltnp | grep -E ':443\b' | head -3 || true)

  if [ -n "$P443" ]; then
    warn "Порт 443 занят:"
    warn "$P443"
    warn "→ Это VPN-вход панели (xray/VLESS). НЕ трогаем. HTTPS на 443 невозможен."
    warn "→ Сайт развернём по HTTP на порту 80."
    HTTPS_OK=0
  else
    ok "Порт 443 свободен — можно будет HTTPS"
    HTTPS_OK=1
  fi

  if echo "$P80" | grep -q "nginx"; then
    ok "nginx уже работает на 80 — добавим наш сайт в него, ничего не сломав"
    NGINX_EXISTS=1
  elif [ -n "$P80" ]; then
    warn "Порт 80 занят НЕ nginx, а:"
    warn "$P80"
    die "Нужно решить конфликт на 80 вручную"
  else
    warn "nginx не слушает 80 — установим его"
    NGINX_EXISTS=0
  fi
fi

# ---------------------------------------------------------------- Node.js
log "Проверяю базовые утилиты (curl, ca-certificates)"
command -v curl >/dev/null 2>&1 || NO_CURL=1
command -v apt-get >/dev/null 2>&1 || die "apt-get не найден — это не Ubuntu/Debian?"
if [ -n "${NO_CURL:-}" ]; then
  apt-get update -y >/dev/null
  apt-get install -y curl ca-certificates >/dev/null
  ok "curl установлен"
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

# ---------------------------------------------------------------- nginx
if [ "$NGINX_EXISTS" = "0" ]; then
  if ! command -v nginx >/dev/null 2>&1; then
    apt-get update -y >/dev/null
    apt-get install -y nginx git >/dev/null
    ok "nginx установлен"
  fi
fi
if ! command -v git >/dev/null 2>&1; then
  apt-get install -y git >/dev/null
fi
if [ "$HTTPS_OK" = "1" ] && ! command -v certbot >/dev/null 2>&1; then
  apt-get install -y certbot python3-certbot-nginx >/dev/null || warn "certbot не поставился"
fi

# ---------------------------------------------------------------- код
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
  warn "  1) DATABASE_URL= — строку Neon"
  warn "  2) PANEL_URL= — адрес панели 3x-ui на СТАРОМ сервере (пример: https://1.2.3.4:2053)"
  warn "  3) PANEL_USERNAME / PANEL_PASSWORD — логин панели"
  warn "  4) VPN_SERVER_HOST= — IP/домен, который клиенты видят в vless-ссылках"
  warn "  Файл: $APP_DIR/server/.env"
fi

# ---------------------------------------------------------------- systemd
log "Настраиваю systemd-службу $SERVICE"
NODE_BIN="$(command -v node)"
cat > "/etc/systemd/system/${SERVICE}.service" <<UNIT
[Unit]
Description=HRZN2.net landing backend
After=network.target

[Service]
WorkingDirectory=$APP_DIR/server
ExecStart=$NODE_BIN index.js
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

# ---------------------------------------------------------------- nginx-конфиг
log "Добавляю наш сайт в nginx (domains: $DOMAIN)"
SITE_CONF="/etc/nginx/sites-available/${NGINX_SITE}"
mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled

cat > "$SITE_CONF" <<NGINX
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

# Включаем наш сайт, НЕ удаляя существующие (default и прочее трогать нельзя)
ln -sf "$SITE_CONF" "/etc/nginx/sites-enabled/${NGINX_SITE}"

# Проверяем, что nginx 100% понимает все свои конфиги, прежде чем перезагружать
if nginx -t; then
  systemctl reload nginx
  ok "nginx перезагружен, сайт добавлен ($DOMAIN)"
else
  warn "nginx -t не прошёл. Снимаю наш конфиг, чтобы не сломать существующие сайты."
  rm -f "/etc/nginx/sites-enabled/${NGINX_SITE}"
  die "Конфиг nginx повреждён — посмотри вывод выше"
fi

# ---------------------------------------------------------------- HTTPS
if [ "$HTTPS_OK" = "1" ]; then
  log "Выпускаю HTTPS-сертификат (Let's Encrypt)"
  if command -v certbot >/dev/null 2>&1; then
    if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect \
       --register-unsafely-without-email --no-eff-email ; then
      ok "HTTPS работает: https://$DOMAIN"
    else
      warn "certbot не смог выпустить сертификат. Проверь DNS домена."
    fi
  else
    warn "certbot не установлен — HTTPS позже"
  fi
else
  warn "Порт 443 занят xray (VPN) — HTTPS пропущен, сайт на http://$DOMAIN"
  warn "Для HTTPS позже: перенести VLESS-вход панели на другой порт или отдельный VPS."
fi

# ---------------------------------------------------------------- DNS проверка
log "Проверяю DNS домена $DOMAIN"
DNS_IP=$(getent hosts "$DOMAIN" | awk '{print $1}' | head -1 || true)
SERVER_IP=$(curl -s --max-time 5 https://api.ipify.org || true)
if [ -n "$DNS_IP" ] && [ -n "$SERVER_IP" ]; then
  if [ "$DNS_IP" = "$SERVER_IP" ]; then
    ok "DNS $DOMAIN → $DNS_IP совпадает с этим сервером"
  else
    warn "DNS $DOMAIN → $DNS_IP, а этот сервер: $SERVER_IP. Домен не указан на сервер — сайт может не открыться."
  fi
else
  warn "Не удалось проверить DNS (нет сети или домен не резолвится)."
fi

# ---------------------------------------------------------------- итог
log "═══════════════════ ГОТОВО ═══════════════════"
if [ "$HTTPS_OK" = "1" ]; then
  ok "Сайт:     https://$DOMAIN"
else
  ok "Сайт:     http://$DOMAIN  (HTTPS недоступен — порт 443 занят VPN-входом)"
fi
ok "Локальная проверка: curl http://localhost:${BACKEND_PORT}/api/health"
ok "Логи службы: journalctl -u $SERVICE -f"
warn "Сайт на этом VPS, панель 3x-ui и бот остались на СТАРОМ сервере — их не трогали."
warn "Дальше: впиши DATABASE_URL и PANEL_* в $APP_DIR/server/.env и перезапусти: sudo systemctl restart $SERVICE"
warn "Проверь, что со старого сервера панель доступна новому VPS (порт панели, напр. 2053, разрешён в файрволе)."