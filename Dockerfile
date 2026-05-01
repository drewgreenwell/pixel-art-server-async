FROM node:25 AS build

WORKDIR /app
COPY ./src ./src
COPY ./public ./public
COPY ./package.json .
COPY ./tsconfig.json .
RUN npm install && yarn && npm run build && npm prune --production

FROM node:25

WORKDIR /app
#RUN npm install && yarn && npm prune --production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist .
COPY --from=build /app/public ./public
EXPOSE 80
ENTRYPOINT ["node","server.js"]
CMD ["--port","80"]

