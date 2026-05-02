FROM node:24.15-alpine3.23

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yam[l] ./
RUN pnpm install

CMD ["pnpm", "run", "dev", "--host"]
