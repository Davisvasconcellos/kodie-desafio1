# Dockerfile para a API Express
FROM node:24-alpine

WORKDIR /app

# Instala dependências
COPY package*.json ./
RUN npm install --production

# Copia código-fonte
COPY . .

# Expõe porta da API
EXPOSE 3001

# Inicia a aplicação
CMD ["npm", "start"]

