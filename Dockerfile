# Dockerfile unificado para deploy no Dokploy a partir da raiz do repositório
FROM node:24-alpine

WORKDIR /app

# Instala dependências
COPY backend/package*.json ./
RUN npm install --production

# Copia código do backend e frontend
COPY backend/ ./
COPY frontend/ ./public/

EXPOSE 3001
ENV PORT=3001

CMD ["npm", "start"]
