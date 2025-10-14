# NetSuite MCP Proxy (OAuth2) — EasyPanel Ready

Proxy delgado que:
- Expone un **MCP endpoint** consumible por OpenAI / AnythingLLM (SSE + HTTP).
- Realiza **OAuth2 Authorization Code** con NetSuite AI Connector Service.
- Administra **access_token / refresh_token** y renueva automáticamente.
- Reenvía `tools.list` / `tools.call` y el **stream SSE** hacia el MCP oficial de NetSuite.

## Endpoints
- `GET  /health`            → OK si el proxy está vivo.
- `GET  /oauth/start`       → Inicia el login (redirige a NetSuite).
- `GET  /oauth/callback`    → Recibe `code` y guarda tokens.
- `GET  /sse`               → Pipea el stream SSE de NetSuite MCP al cliente.
- `POST /tools/list`        → Proxy a NetSuite MCP tools/list.
- `POST /tools/call`        → Proxy a NetSuite MCP tools/call.

> **Nota**: Debes completar el flujo `/oauth/start` una vez (en navegador) para almacenar tokens.

## Variables de entorno (.env)
```env
# Identidad/URLs NetSuite
NS_ACCOUNT_ID=123456
NS_REGION_HOST_APP=app.netsuite.com
NS_REGION_HOST_API=suitetalk.api.netsuite.com

# OAuth2 (Integration Record como Public Client + Authorization Code)
OAUTH_CLIENT_ID=xxxxx
OAUTH_CLIENT_SECRET=yyyyy
OAUTH_REDIRECT_URI=https://TU-DOMINIO/oauth/callback
OAUTH_SCOPES=openid offline_access ai_connector.mcp # ajusta con tus scopes

# Objetivo MCP (elige uno)
MCP_TARGET_KIND=all       # all | suiteapp
MCP_SUITEAPP_ID=com.netsuite.mcpstandardtools

# Servidor
PORT=8011
SESSION_SECRET=cadena-super-secreta
TOKEN_FILE=./tokens.json
