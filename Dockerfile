# Placeholder — Compose references this path.
# Prefer native `npm run setup && npm run build && npm run start` until a real image is needed.
#
# Minimal sketch (uncomment / expand when shipping containers):
# FROM node:20-bookworm-slim
# WORKDIR /app
# COPY package.json package-lock.json* ./
# COPY src ./src
# COPY modules ./modules
# COPY config ./config
# COPY scripts ./scripts
# COPY models ./models
# RUN npm ci && npm run build
# ENV NODE_ENV=production ASI_AMS_SKILL_RUN=0 ASI_USE_POSTGRES=0
# EXPOSE 3445
# CMD ["npm", "run", "start"]

FROM node:20-bookworm-slim
WORKDIR /app
COPY . .
RUN npm install && npm run build
ENV NODE_ENV=production
ENV ASI_AMS_SKILL_RUN=0
ENV ASI_USE_POSTGRES=0
ENV ASI_SERVER_HOST=0.0.0.0
EXPOSE 3445
CMD ["npm", "run", "start"]
