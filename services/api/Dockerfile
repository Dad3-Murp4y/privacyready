FROM node:22-alpine

RUN apk add --no-cache libc6-compat openssl curl

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src/

RUN npm run build

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

COPY start.sh ./
RUN chmod +x start.sh

CMD ["./start.sh"]
