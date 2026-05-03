FROM node:24.15-alpine3.23

# Instalando o Git (essencial para o VS Code ler o histórico quando atachado)
# O --no-cache evita salvar arquivos temporários, mantendo a imagem leve
RUN apk add --no-cache git

# Instala o pnpm globalmente direto pelo npm (evitando bugs de corepack/chaves)
RUN npm install -g pnpm

# Criar um usuário que combine com o seu UID do host 1001 (NixOS/WSL2) antes de definir o WORKDIR
RUN addgroup -g 1001 nodeuser && \
    adduser -u 1001 -G nodeuser -s /bin/sh -D nodeuser

WORKDIR /app

# Garantir que a pnpm store e a pasta app pertencem ao usuário antes de entrar nela
RUN chown -R 1001:1001 /app

USER nodeuser

# Configura o pnpm para usar o store dentro da pasta node_modules
# Assim, o store e os pacotes ficam isolados no mesmo volume do Docker
RUN pnpm config set store-dir /app/node_modules/.pnpm-store

# Copia package.json e (se existir) o pnpm-lock.yaml
COPY --chown=nodeuser:nodeuser package.json pnpm-lock.yam[l] ./

RUN pnpm install

CMD ["pnpm", "run", "dev", "--host"]
