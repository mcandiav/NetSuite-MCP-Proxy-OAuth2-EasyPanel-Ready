FROM node:20-alpine

WORKDIR /app

# Copia manifest e instala dependencias SIN lockfile
COPY package.json ./
RUN npm install --omit=dev

# Copia el resto del código
COPY . .

# Puerto del proxy
EXPOSE 8011

# Inicio
CMD ["node", "server.js"]
