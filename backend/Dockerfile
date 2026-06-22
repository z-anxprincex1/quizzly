FROM node:18-slim
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install
COPY . .
RUN npm run build
EXPOSE 8080
ENV PORT=8080
CMD ["node", "dist/server.js"]