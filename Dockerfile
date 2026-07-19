# Usa a imagem oficial do Node.js 20 baseada no Alpine Linux (mais leve)
FROM node:20-alpine

# Define o diretório de trabalho dentro do container
WORKDIR /app

# Copia os arquivos de configuração de pacotes (package.json e package-lock.json se existir)
COPY package*.json ./

# Instala todas as dependências do projeto
RUN npm install

# Copia todo o restante do código fonte para o diretório de trabalho do container
COPY . .

# Executa o build do frontend (Vite) para gerar a pasta /dist com os arquivos estáticos
RUN npm run build

# Define as variáveis de ambiente necessárias para produção
ENV NODE_ENV=production
ENV PORT=3000

# Expõe a porta que a aplicação vai rodar
EXPOSE 3000

# Comando de inicialização do servidor (usa o script start do package.json, que roda "tsx server.ts")
CMD ["npm", "run", "start"]
