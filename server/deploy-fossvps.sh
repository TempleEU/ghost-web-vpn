#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"
if [[ $EUID -ne 0 ]]; then echo 'Run as root (sudo -i).'; exit 1; fi
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl docker.io docker-compose-plugin wireguard-tools qrencode
systemctl enable --now docker
install -d -m 700 wireguard
cat >/etc/sysctl.d/99-ghost-web-vpn.conf <<'EOF'
net.ipv4.ip_forward=1
net.ipv6.conf.all.forwarding=1
EOF
sysctl --system
if [[ ! -f .env ]]; then
  cp .env.example .env
  SERVER_IP="$(curl -4 -fsS https://api.ipify.org || true)"
  [[ -n "$SERVER_IP" ]] || { echo 'Set SERVERURL manually in .env.'; exit 1; }
  sed -i "s/^SERVERURL=.*/SERVERURL=${SERVER_IP}/" .env
  chmod 600 .env
fi
chmod 600 .env
if grep -q '^PROXY_USER=$\|^PROXY_PASSWORD=$' .env; then echo 'Set PROXY_USER and PROXY_PASSWORD in server/.env.'; exit 1; fi
docker compose up -d
docker compose ps
echo 'Ghost Web VPN FOSSVPS endpoint started.'
echo 'Keep ./wireguard and .env private.'
