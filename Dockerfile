FROM node:20-alpine

WORKDIR /app

# Copia dependencias y las instala
COPY package*.json ./
RUN npm ci --omit=dev

# Copia el resto del código
COPY . .

# Expone el puerto estándar del proxy
EXPOSE 8011

# Comando de inicio
CMD ["node", "server.js"]
