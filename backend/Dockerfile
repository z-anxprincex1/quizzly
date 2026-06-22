FROM node:18-slim
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install
COPY . .
RUN npm run build
EXPOSE 8080
ENV PORT=8080
CMD ["node", "dist/server.js"]