import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import cookieSession from "cookie-session";

const {
  NS_ACCOUNT_ID,
  NS_REGION_HOST_APP = "app.netsuite.com",
  NS_REGION_HOST_API = "suitetalk.api.netsuite.com",

  OAUTH_CLIENT_ID,
  OAUTH_CLIENT_SECRET,
  OAUTH_REDIRECT_URI,
  // Ajusta scopes en ENV si tu cuenta usa nombres distintos
  OAUTH_SCOPES = "openid offline_access ai_connector.mcp",

  // all = todas las tools habilitadas; suiteapp = restringe a una SuiteApp
  MCP_TARGET_KIND = "all", // "all" | "suiteapp"
  MCP_SUITEAPP_ID = "com.netsuite.mcpstandardtools",

  PORT = 8011,
  SESSION_SECRET = "change-me",
  TOKEN_FILE = "./tokens.json"
} = process.env;

// Validación mínima de ENV
if (!NS_ACCOUNT_ID || !OAUTH_CLIENT_ID || !OAUTH_CLIENT_SECRET || !OAUTH_REDIRECT_URI) {
  console.error("❌ Faltan variables obligatorias: NS_ACCOUNT_ID, OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REDIRECT_URI");
  process.exit(1);
}

// URLs de OAuth2 y MCP (según región/cuenta)
const AUTH_URL  = `https://${NS_ACCOUNT_ID}.${NS_REGION_HOST_APP}/app/login/secure/authorize.ssp`;
const TOKEN_URL = `https://${NS_ACCOUNT_ID}.${NS_REGION_HOST_API}/services/rest/auth/oauth2/v1/token`;

const MCP_BASE =
  MCP_TARGET_KIND === "suiteapp"
    ? `https://${NS_ACCOUNT_ID}.${NS_REGION_HOST_API}/services/mcp/v1/suiteapp/${MCP_SUITEAPP_ID}`
    : `https://${NS_ACCOUNT_ID}.${NS_REGION_HOST_API}/services/mcp/v1/all`;

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(cookieSession({ name: "sid", secret: SESSION_SECRET, sameSite: "lax" }));

// ---- Persistencia simple de tokens en archivo -------------------------------
const tokensPath = path.resolve(TOKEN_FILE);
let tokenStore = null;

function loadTokens() {
  try {
    if (fs.existsSync(tokensPath)) tokenStore = JSON.parse(fs.readFileSync(tokensPath, "utf8"));
  } catch {
    tokenStore = null;
  }
}
function saveTokens() {
  try {
    fs.writeFileSync(tokensPath, JSON.stringify(tokenStore || {}, null, 2));
  } catch (e) {
    console.error("No se pudo guardar tokens:", e.message);
  }
}
loadTokens();

const nowSec = () => Math.floor(Date.now() / 1000);
const expiresSoon = () => !tokenStore?.access_token || !tokenStore?.expires_at || (tokenStore.expires_at - nowSec() < 60);

async function exchangeCodeForTokens(code) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: OAUTH_REDIRECT_URI,
    client_id: OAUTH_CLIENT_ID,
    client_secret: OAUTH_CLIENT_SECRET
  });

  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Token exchange failed: ${r.status} ${t}`);
  }

  const tok = await r.json();
  tokenStore = {
    ...tok,
    obtained_at: nowSec(),
    expires_at: nowSec() + (tok.expires_in || 1800)
  };
  saveTokens();
}

async function refreshIfNeeded() {
  if (!tokenStore?.refresh_token || !expiresSoon()) return;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokenStore.refresh_token,
    client_id: OAUTH_CLIENT_ID,
    client_secret: OAUTH_CLIENT_SECRET
  });

  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Refresh failed: ${r.status} ${t}`);
  }

  const tok = await r.json();
  tokenStore = {
    ...tokenStore,
    ...tok,
    obtained_at: nowSec(),
    expires_at: nowSec() + (tok.expires_in || 1800)
  };
  saveTokens();
}

// ---- Rutas -------------------------------------------------------------------
app.get("/health", (_req, res) => res.json({ ok: true, mcp: MCP_TARGET_KIND }));

app.get("/oauth/start", (_req, res) => {
  const url = new URL(AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", OAUTH_CLIENT_ID);
  url.searchParams.set("redirect_uri", OAUTH_REDIRECT_URI);
  url.searchParams.set("scope", OAUTH_SCOPES);
  res.redirect(url.toString());
});

app.get("/oauth/callback", async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) return res.status(400).send("No 'code' en callback.");
    await exchangeCodeForTokens(code);
    res.send("OK. Tokens guardados.");
  } catch (e) {
    console.error(e);
    res.status(500).send("Callback error: " + e.message);
  }
});

// SSE passthrough del stream MCP de NetSuite
app.get("/sse", async (req, res) => {
  try {
    if (!tokenStore?.access_token) return res.status(401).send("Sin access_token. Visita /oauth/start primero.");
    await refreshIfNeeded();

    const upstreamUrl = `${MCP_BASE}/stream`;
    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${tokenStore.access_token}` }
    });

    if (!upstream.ok || !upstream.body) {
      const txt = await upstream.text().catch(() => "");
      return res.status(upstream.status).send(txt || "Upstream stream error");
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    upstream.body.on("error", (err) => {
      console.error("SSE upstream error:", err?.message);
      try { res.end(); } catch {}
    });

    upstream.body.pipe(res);
  } catch (e) {
    console.error(e);
    res.status(500).send("SSE proxy error: " + e.message);
  }
});

// Passthrough de tools MCP
async function proxyJson(req, res, path) {
  try {
    if (!tokenStore?.access_token) return res.status(401).send("Sin access_token. Visita /oauth/start primero.");
    await refreshIfNeeded();

    const r = await fetch(`${MCP_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenStore.access_token}`
      },
      body: JSON.stringify(req.body || {})
    });

    const txt = await r.text();
    res.status(r.status).send(txt);
  } catch (e) {
    console.error(e);
    res.status(500).send("Proxy error: " + e.message);
  }
}

app.post("/tools/list", (req, res) => proxyJson(req, res, "/tools/list"));
app.post("/tools/call", (req, res) => proxyJson(req, res, "/tools/call"));

app.listen(+PORT, () => {
  console.log(`✅ NetSuite MCP Proxy escuchando en :${PORT}`);
  console.log(`Auth URL:  ${AUTH_URL}`);
  console.log(`Token URL: ${TOKEN_URL}`);
  console.log(`MCP Base:  ${MCP_BASE}`);
});
