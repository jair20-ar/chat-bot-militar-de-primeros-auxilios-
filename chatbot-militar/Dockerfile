FROM node:18.19.0-alpine

WORKDIR /app

RUN apk add --no-cache ffmpeg

COPY backend/package*.json ./
RUN npm ci --only=production

COPY backend/ ./
COPY frontend/ ../frontend/

RUN mkdir -p uploads logs

EXPOSE 3001

CMD ["node", "server.js"]
