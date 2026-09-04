#!/usr/bin/env bash
set -euo pipefail

# Free self-hosted endpoint option for Ghost Web VPN.
# Run this on a Linux machine you control (home PC, mini-PC, Raspberry Pi, etc.).
# It turns the machine into a Tailscale exit node. No cloud VPS is required.
# Authentication is intentionally interactive; never commit an auth key.

if [[ $EUID -ne 0 ]]; then
  echo 'Run as root: sudo bash tailscale-exit-node.sh'
  exit 1
fi

apt-get update
apt-get install -y curl ca-certificates

if ! command -v tailscale >/dev/null 2>&1; then
  curl -fsSL https://tailscale.com/install.sh | sh
fi

cat >/etc/sysctl.d/99-ghost-vpn.conf <<'EOF'
net.ipv4.ip_forward = 1
net.ipv6.conf.all.forwarding = 1
EOF
sysctl --system

echo
printf '%s\n' 'Starting Tailscale authentication. Complete login in the browser when prompted.'
tailscale up --advertise-exit-node

echo
printf '%s\n' 'Endpoint setup complete.'
printf '%s\n' 'Approve this machine as an exit node in the Tailscale admin console, then select it from the client.'
tailscale status
