# Telegram API proxy for Coolify

This is a dependency-free reverse proxy for `https://api.telegram.org`. It forwards the request path, query string, method, headers, and request/response body without storing bot tokens or Telegram data.

`GET /health` always returns `200 ok` and is intended for Coolify health checks.

## Deploy with Coolify

1. Create a **New Resource** from this repository and select **Dockerfile** as the build pack.
2. Set the exposed port to `3000`.
3. Attach your domain, for example `telegram-proxy.example.com`.
4. Set the health-check path to `/health`.
5. Deploy.

Coolify normally supplies `PORT`; if it does not, the app listens on port `3000`.

## Optional access protection

Because this service can be used by anyone who knows its domain to make requests to the Telegram API, set `PROXY_AUTH_TOKEN` in Coolify to restrict it. Clients must then send:

```http
Authorization: Bearer your-long-random-token
```

The `/health` endpoint remains public so Coolify can check it. If no `PROXY_AUTH_TOKEN` is set, no authorization header is required.

## Use from a Telegram client

Point the client at your proxy domain in place of `https://api.telegram.org` while keeping the rest of the path unchanged:

```text
https://telegram-proxy.example.com/bot<TELEGRAM_BOT_TOKEN>/getMe
```

For Telegram libraries, configure their Bot API base URL to `https://telegram-proxy.example.com` (or the library's required base URL form). Do not add `/bot` to the configured base URL unless that library explicitly requires it.

## Local run

```bash
docker build -t telegram-api-proxy .
docker run --rm -p 3000:3000 -e PROXY_AUTH_TOKEN=replace-me telegram-api-proxy
```

Then check `http://localhost:3000/health`.
