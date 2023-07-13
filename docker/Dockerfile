FROM node:18.15.0 AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run static:tsc

FROM node:18.15.0 AS run

ARG GIT_HASH 
ENV GIT_HASH=$GIT_HASH

WORKDIR /app
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules

CMD ["npm", "run", "up"]