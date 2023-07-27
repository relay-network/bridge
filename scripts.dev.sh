#!/bin/bash -e

# #############################################################################
#
# nuke previous artifacts
#
# #############################################################################

if [ -z "${1}" ] || [ "${1}" = "nuke" ]; then
  rm -rf node_modules

  rm -rf build

  docker rm --force rm-dev-postgres

  docker network rm rm-dev || true
fi

# #############################################################################
#
# install dependencies
#
# #############################################################################

if [ -z "${1}" ] || [ "${1}" = "deps" ]; then
  npm install
fi

# #############################################################################
#
# check for linter errors
#
# #############################################################################

if [ -z "${1}" ] || [ "${1}" = "lint" ]; then
  npx eslint --max-warnings=0 .
fi

# #############################################################################
#
# check formatting
#
# #############################################################################

if [ -z "${1}" ] || [ "${1}" = "format" ]; then
  npx prettier --check .
fi

# #############################################################################
#
# build the app (and typecheck)
#
# #############################################################################

if [ -z "${1}" ] || [ "${1}" = "build" ]; then
  npx prisma generate
  npx tsc
fi

# #############################################################################
#
# spin up database
#
# #############################################################################

if [ -z "${1}" ] || [ "${1}" = "deps" ]; then
  docker network create rm-dev

  docker run \
    --env POSTGRES_USER="postgres" \
    --env POSTGRES_PASSWORD="postgres" \
    --network rm-dev \
    --detach \
    -p "5432:5432" \
    --name rm-dev-postgres \
    ankane/pgvector

  sleep 3
fi

# #############################################################################
#
# migrate database
#
# #############################################################################

if [ -z "${1}" ] || [ "${1}" = "migrate" ]; then
  PG_CONNECTION_STRING="postgresql://postgres:postgres@localhost:5432/postgres" \
  npx prisma migrate dev
fi

# #############################################################################
#
# seed database
#
# #############################################################################

if [ -z "${1}" ] || [ "${1}" = "seed" ]; then
  PG_CONNECTION_STRING="postgresql://postgres:postgres@localhost:5432/postgres" \
  OPENAI_API_KEY="${OPENAI_API_KEY}" \
  APP_NAME="robot-maker" \
  APP_ENV="dev" \
  npx mocha ./build/mocha/seed.js
fi

# #############################################################################
#
# run app server
#
# #############################################################################

if [ "${1}" = "start" ]; then
  PG_CONNECTION_STRING='postgresql://postgres:postgres@localhost:5432/postgres' \
  APP_NAME="robot-maker" \
  APP_ENV="dev" \
  npx nodemon -w build ./build/src/app.js
fi

# #############################################################################
#
# run discord bot
#
# #############################################################################

if [ "${1}" = "discord" ]; then
  PG_CONNECTION_STRING='postgresql://postgres:postgres@localhost:5432/postgres' \
  APP_NAME="robot-maker" \
  APP_ENV="dev" \
  npx nodemon -w build ./build/src/discord.js
fi

# #############################################################################
#
# run typescript compiler
#
# #############################################################################

if [ "${1}" = "tsc" ]; then
  PG_CONNECTION_STRING='postgresql://postgres:postgres@localhost:5432/postgres' \
  npx prisma generate && npx tsc --watch
fi

# #############################################################################
#
# run e2e tests
#
# #############################################################################

if [ "${1}" = "test" ]; then
  PG_CONNECTION_STRING='postgresql://postgres:postgres@localhost:5432/postgres' \
  npx mocha build/scripts.dev.js
fi