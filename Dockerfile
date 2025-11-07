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

# Avvia l'applicazione con limiti di memoria ottimizzati per container con 512MB
# --max-old-space-size=384 limita l'heap a 384MB (lasciando ~128MB per il resto del sistema)
# --optimize-for-size riduce l'utilizzo di memoria
# --gc-interval=100 esegue il garbage collector più frequentemente
CMD ["node", "--max-old-space-size=384", "--optimize-for-size", "--gc-interval=100", "src/app-gocardless.js"]
