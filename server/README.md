# Ghost Web VPN endpoint

Self-hosted server side for Ghost Web VPN.

## Architecture

- **WireGuard** provides the encrypted VPN tunnel and generates the `ghost-web` peer configuration.
- **SOCKS5** runs in the WireGuard container network namespace.
- The SOCKS5 listener is bound to localhost on the VPS, so it is not an unauthenticated public proxy.
- The browser extension should reach the proxy through the trusted VPN/private path, or through a separately secured proxy gateway.

## Deploy on a VPS you control

1. Install Docker Engine and Docker Compose on a Linux VPS you own/control.
2. Copy `.env.example` to `.env`.
3. Set `SERVERURL` to the VPS public IP or DNS name.
4. Replace `PROXY_PASSWORD` with a long random secret. Never commit `.env`.
5. Open UDP `51820` in the VPS/cloud firewall.
6. Start the endpoint:

```sh
docker compose up -d
```

7. Check the service:

```sh
docker compose ps
docker compose logs --tail=100 ghost-vpn ghost-proxy
```

8. Keep generated WireGuard peer configuration below `server/wireguard` private.

## Security

The proxy listener is intentionally bound to `127.0.0.1`. Do not expose an anonymous SOCKS5 service to the Internet. If remote browser access is needed, use the WireGuard tunnel or an authenticated, access-controlled proxy gateway.

For production, restrict firewall access, rotate credentials, update images, and monitor the endpoint. Never commit `.env`, WireGuard private keys, generated peer configs, or proxy passwords.

## Full-tunnel WireGuard

For a full VPN tunnel, the generated peer should use `AllowedIPs = 0.0.0.0/0`, with server forwarding/NAT configured. Verify routing and DNS behavior before production use.

A real endpoint becomes operational only after this stack is deployed to a VPS/cloud server under your control.
