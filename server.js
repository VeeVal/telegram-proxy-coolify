const http = require("node:http");
const { pipeline } = require("node:stream");
const { promisify } = require("node:util");

const pipe = promisify(pipeline);
const port = Number(process.env.PORT || 3000);
const upstreamOrigin = "https://api.telegram.org";
const authToken = process.env.PROXY_AUTH_TOKEN;

// These headers apply only to a single network hop and must not be forwarded.
const hopByHopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function filteredHeaders(headers) {
  const result = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (
      value !== undefined &&
      name.toLowerCase() !== "host" &&
      !hopByHopHeaders.has(name.toLowerCase())
    ) {
      result.set(name, Array.isArray(value) ? value.join(", ") : value);
    }
  }
  return result;
}

function isAuthorized(request) {
  return !authToken || request.headers.authorization === `Bearer ${authToken}`;
}

const server = http.createServer(async (request, response) => {
  // Extract only a path and query from the request target. This keeps the
  // destination fixed even if a client sends an absolute-form HTTP target.
  const incoming = new URL(request.url, "http://proxy.local");

  if (incoming.pathname === "/health") {
    response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    response.end("ok");
    return;
  }

  if (!isAuthorized(request)) {
    response.writeHead(401, {
      "content-type": "text/plain; charset=utf-8",
      "www-authenticate": "Bearer",
    });
    response.end("Unauthorized");
    return;
  }

  const controller = new AbortController();
  request.on("aborted", () => controller.abort());
  response.on("close", () => {
    if (!response.writableEnded) controller.abort();
  });

  const upstreamUrl = new URL(`${incoming.pathname}${incoming.search}`, upstreamOrigin);
  const hasBody = !["GET", "HEAD"].includes(request.method);

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers: filteredHeaders(request.headers),
      body: hasBody ? request : undefined,
      duplex: hasBody ? "half" : undefined,
      redirect: "manual",
      signal: controller.signal,
    });

    const headers = Object.fromEntries(upstreamResponse.headers);
    response.writeHead(upstreamResponse.status, headers);
    if (!upstreamResponse.body) {
      response.end();
      return;
    }
    await pipe(upstreamResponse.body, response);
  } catch (error) {
    if (controller.signal.aborted) return;
    console.error("Telegram upstream request failed:", error);
    if (!response.headersSent) {
      response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      response.end("Telegram upstream request failed");
    } else {
      response.destroy(error);
    }
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Telegram API proxy listening on port ${port}`);
});
