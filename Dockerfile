FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json ./
COPY server.js ./

EXPOSE 3000
USER node
CMD ["node", "server.js"]
