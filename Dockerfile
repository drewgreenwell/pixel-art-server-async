FROM node:25 AS build-ui

WORKDIR /ui
COPY ./ui/package.json .
RUN npm install
COPY ./ui .
RUN npm run build

FROM node:25 AS build-server

WORKDIR /app
COPY ./src ./src
COPY ./package.json .
COPY ./tsconfig.json .
RUN npm install && npm run build && npm prune --production

FROM node:25

WORKDIR /app
COPY --from=build-server /app/node_modules ./node_modules
COPY --from=build-server /app/dist .
COPY --from=build-ui /ui/dist ./ui-dist
EXPOSE 80
ENTRYPOINT ["node","server.js"]
CMD ["--port","80"]

