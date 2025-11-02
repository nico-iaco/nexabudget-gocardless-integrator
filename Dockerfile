# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copia i file di dipendenze
COPY package*.json ./

# Installa tutte le dipendenze
RUN npm ci

# Copia il codice sorgente
COPY . .

# Compila solo i file TypeScript (se presenti)
RUN npm run build

# Stage 2: Production
FROM node:22-alpine AS production

# Crea un utente non-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copia i file di dipendenze
COPY package*.json ./

# Installa solo le dipendenze di produzione
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copia i file sorgente JavaScript e i file compilati TypeScript
COPY --from=builder /app/src ./src
COPY --from=builder /app/dist ./dist

# Cambia ownership dei file
RUN chown -R nodejs:nodejs /app

# Usa l'utente non-root
USER nodejs

# Esponi la porta
EXPOSE 3000

# Avvia l'applicazione dal file JavaScript
CMD ["node", "src/app-gocardless.js"]
