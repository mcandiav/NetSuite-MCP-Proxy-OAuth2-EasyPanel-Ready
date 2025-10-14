FROM node:20-alpine

WORKDIR /app

# ------- Defaults para variables de entorno (sobrescribibles en EasyPanel) -------
ENV NS_ACCOUNT_ID="__REQUIRED__" \
    NS_REGION_HOST_APP="app.netsuite.com" \
    NS_REGION_HOST_API="suitetalk.api.netsuite.com" \
    OAUTH_CLIENT_ID="__REQUIRED__" \
    OAUTH_CLIENT_SECRET="__REQUIRED__" \
    OAUTH_REDIRECT_URI="https://mcp-proxy.example.com/oauth/callback" \
    OAUTH_SCOPES="openid offline_access ai_connector.mcp" \
    MCP_TARGET_KIND="all" \
    MCP_SUITEAPP_ID="com.netsuite.mcpstandardtools" \
    PORT="8011" \
    SESSION_SECRET="change-me" \
    TOKEN_FILE="./tokens.json"

# Copia manifest e instala dependencias SIN lockfile
COPY package.json ./
RUN npm install --omit=dev

# Copia el resto del código
COPY . .

EXPOSE 8011

CMD ["node", "server.js"]
