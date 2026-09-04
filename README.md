# Ghost Web VPN

A privacy-focused Chromium browser proxy client, built from scratch and inspired by the simple one-click experience of BiuBiu VPN. The reference project is a Manifest V3 browser extension using the Chrome proxy API; Ghost Web VPN does not copy its source code.

## What this build does

- One-click connect/disconnect
- HTTP, HTTPS, SOCKS4 and SOCKS5 proxy endpoints
- Persistent local configuration
- Proxy configuration applied through Chromium's `chrome.proxy` API
- Minimal, privacy-oriented UI
- No bundled third-party proxy servers

## Important architecture note

This is a **browser proxy client**, not a standalone network-level VPN service. A real VPN requires an independently operated VPN gateway/server (for example WireGuard/OpenVPN) and secure provisioning of its credentials. This extension intentionally does not route traffic through third-party infrastructure.

## Install locally

1. Clone this repository.
2. Open `chrome://extensions` (or the equivalent Chromium extensions page).
3. Enable Developer mode.
4. Choose **Load unpacked** and select the repository directory.
5. Enter the address and port of a proxy endpoint you control, then press **Connect**.

## Security direction

Do not put private keys, passwords, or long-lived credentials in source control. Production server provisioning should use authenticated configuration delivery and audited VPN/proxy software.

## Reference

The original BiuBiu repository documents a one-click browser-extension experience and Manifest V3 architecture. Ghost Web VPN uses that product direction as inspiration while implementing its own code and branding.
