FROM node:18.15.0 AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npx tsc

FROM node:18.15.0 AS run

WORKDIR /app
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma

RUN npx playwright install
RUN npx playwright install-deps

EXPOSE 8080