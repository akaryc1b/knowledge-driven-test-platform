FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY --chown=node:node . .
RUN npm ci --omit=dev --ignore-scripts \
    && npm install --no-save --package-lock=false --ignore-scripts pg@8.22.0 \
    && npm cache clean --force

USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.KDTP_HTTP_PORT||8080)+'/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "apps/read-only-governance-service/src/main.js"]
