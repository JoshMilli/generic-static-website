# Simple container for the Basecamp webhook server
FROM node:20-alpine

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production || npm install --production --no-audit --no-fund

COPY . .
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["npm", "start"]