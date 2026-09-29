FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=10000
COPY package.json server.js zugang.js olymp.js index.html datenschutz.html ./
COPY js ./js
COPY vendor ./vendor
COPY fonts ./fonts
EXPOSE 10000
CMD ["node", "server.js"]
