# Ghost Web VPN

A privacy-focused Chromium browser proxy client, built from scratch as a Manifest V3 browser extension using the Chrome proxy API.

> **New here? Follow the [Quick Start](QUICKSTART.md)** — from clone to a working free endpoint in about 10 minutes.

## What this build does

- One-click connect/disconnect with a **live connectivity check** — the popup probes the endpoint through the proxy and reports a real connected/unreachable status instead of failing silently
- **Auto-reconnect** — the last endpoint is remembered and re-applied when the browser restarts, with a keep-alive that restores the proxy if Chrome ever drops it
- HTTP, HTTPS, SOCKS4 and SOCKS5 proxy endpoints
- Persistent local configuration
- Proxy configuration applied through Chromium's `chrome.proxy` API
- HTTP(S) proxy authentication via `onAuthRequired` (credentials stay in extension storage)
- Minimal, privacy-oriented UI
- No bundled third-party proxy servers

### A note on SOCKS5

Chrome **cannot authenticate SOCKS5 proxies**, so for SOCKS4/SOCKS5 the extension
connects without credentials (the username/password fields are disabled). Secure
the endpoint instead by binding it to a private address such as a Tailscale IP —
which is exactly what the free endpoint below does.

## Free endpoint in about 10 minutes

A working, genuinely free endpoint is a Linux machine you already own (home PC,
mini-PC, Raspberry Pi) running the provided installer, which uses Tailscale's
free tier:

```sh
cd server/free-self-hosted
sudo bash setup-free-endpoint.sh
```

It joins the machine to your private tailnet and starts a SOCKS5 proxy that is
reachable only by devices on that tailnet. You then enter the printed `100.x.y.z`
address and port `1080` in the popup and press **Connect**. Full instructions and
troubleshooting are in [`server/free-self-hosted/README.md`](server/free-self-hosted/README.md).

## Install locally

1. Clone this repository.
2. Open `chrome://extensions` (or the equivalent Chromium extensions page).
3. Enable Developer mode.
4. Choose **Load unpacked** and select the repository directory.
5. Enter the address and port of a proxy endpoint you control, then press **Connect** — the popup runs a connectivity check and shows whether the endpoint is reachable.

## Architecture note

This is a **browser proxy client**, not a standalone network-level VPN service.
A real VPN requires an independently operated VPN gateway/server (for example
WireGuard/OpenVPN) and secure provisioning of its credentials. This extension
routes browser traffic only, through an endpoint you operate.

## Security direction

Do not put private keys, passwords, or long-lived credentials in source control. Production server provisioning should use authenticated configuration delivery and audited VPN/proxy software.

## Contact

Questions, feedback, or support requests: [ghostweb@ghostbin.cfd](mailto:ghostweb@ghostbin.cfd)
