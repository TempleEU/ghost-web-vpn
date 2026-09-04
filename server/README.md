# Ghost Web VPN endpoint

This directory is the self-hosted server side of Ghost Web VPN.

## Architecture

`WireGuard` provides the encrypted VPN tunnel. The SOCKS5 service shares the VPN network namespace. The browser extension can use the SOCKS5 endpoint after it is deliberately exposed on a trusted interface.

WireGuard uses public-key cryptography and supports a simple `wg-quick` style configuration. See the official WireGuard documentation for protocol and deployment details.

## Deploy on a VPS you control

1. Install Docker Engine and Docker Compose on a Linux VPS you control.
2. Copy `.env.example` to `.env` and set `SERVERURL` to the VPS public IP or DNS name.
3. Open UDP `51820` in the VPS/cloud firewall.
4. Start the stack:

```sh
docker compose up -d
```

5. The WireGuard peer configuration is generated under `server/wireguard` by the container. Keep those files private.
6. Do not publish generated private keys or peer configurations to GitHub.

## Proxy exposure

The compose file binds TCP 1080 to `127.0.0.1` on the server host. This intentionally prevents an unauthenticated public SOCKS5 service. To use the proxy from the browser, route access through the WireGuard tunnel or put an authenticated proxy in front of it. Never expose an open SOCKS5 port to the Internet.

## DNS and routing

For a full-tunnel client, the WireGuard peer should use `AllowedIPs = 0.0.0.0/0` and the server must have IPv4 forwarding/NAT configured. The LinuxServer WireGuard image handles the standard server-side setup; verify the generated configuration before production use.

## Current limitation

GitHub can build and configure the server software, but it cannot provision a public VPS on your behalf. A real endpoint becomes "controlled by Ghost" only after you deploy this server stack to a VPS/cloud host under your account and supply its public address to the extension.
