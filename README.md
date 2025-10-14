# 🧩 NetSuite MCP Proxy (OAuth2) — EasyPanel Ready

Proxy delgado que permite conectar **AnythingLLM** o **OpenAI (Playground / Connectors)** con **NetSuite AI Connector (MCP)** usando **OAuth2 Authorization Code**.  
Autentica una sola vez y mantiene los tokens activos automáticamente.

---

## ✨ Características

- ✅ Compatible con **OAuth2 Authorization Code Grant** (Integration Record tipo *Public Client*).
- ✅ Administra `access_token` y `refresh_token` automáticamente.
- ✅ Expone endpoints MCP estándar: `/sse`, `/tools/list`, `/tools/call`.
- ✅ Listo para instalar en **EasyPanel** con variables de entorno.
- ✅ Puede ser usado desde AnythingLLM o el Playground de OpenAI como **MCP Server**.

---

## ⚙️ Endpoints disponibles

| Endpoint | Método | Descripción |
|-----------|---------|-------------|
| `/health` | GET | Verifica que el proxy esté en ejecución |
| `/oauth/start` | GET | Inicia el login con NetSuite |
| `/oauth/callback` | GET | Recibe el código OAuth2 y guarda los tokens |
| `/sse` | GET | Pipea el stream SSE del MCP oficial de NetSuite |
| `/tools/list` | POST | Lista las tools disponibles |
| `/tools/call` | POST | Ejecuta una tool en NetSuite |

---

## 🔧 Variables de entorno (configurar en EasyPanel)

```env
# --- NetSuite / Región ---
NS_ACCOUNT_ID=123456
NS_REGION_HOST_APP=app.netsuite.com
NS_REGION_HOST_API=suitetalk.api.netsuite.com

# --- OAuth2 ---
OAUTH_CLIENT_ID=__REPLACE__
OAUTH_CLIENT_SECRET=__REPLACE__
OAUTH_REDIRECT_URI=https://TU-DOMINIO/oauth/callback
OAUTH_SCOPES=openid offline_access ai_connector.mcp

# --- Objetivo MCP ---
MCP_TARGET_KIND=all
MCP_SUITEAPP_ID=com.netsuite.mcpstandardtools

# --- Servidor ---
PORT=8011
SESSION_SECRET=change-me
TOKEN_FILE=./tokens.json
