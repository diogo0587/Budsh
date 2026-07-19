FROM node:22-alpine

# Define o diretório de trabalho
WORKDIR /app

# Instala as dependências
COPY package*.json ./
RUN npm install

# Copia o código da aplicação
COPY . .

# Expõe a porta 3000 e inicia o servidor
EXPOSE 3000
CMD ["npm", "start"]
