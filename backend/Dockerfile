# Dockerfile para a aplicação completa (Backend Express + Frontend em public/)
FROM node:24-alpine

WORKDIR /app

# Instala dependências
COPY package*.json ./
RUN npm install --production

# Copia código-fonte e pasta public com o frontend
COPY . .

# Expõe porta da aplicação
EXPOSE 3001
ENV PORT=3001

# Inicia a aplicação
CMD ["npm", "start"]
