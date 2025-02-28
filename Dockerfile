FROM node:20.18.1-alpine as development
ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/app

COPY package*.json .

RUN npm ci

COPY . .

RUN chmod +x /usr/app/entrypoint.sh
RUN npm run build

FROM node:20.18.1-alpine as production
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/app
COPY package*.json .
RUN npm ci --only=production

COPY --from=development /usr/app/dist ./dist
COPY --from=development /usr/app/entrypoint.sh ./
COPY --from=development /usr/app/.env ./.env

ENTRYPOINT ["/bin/sh", "-c", "/usr/app/entrypoint.sh"]