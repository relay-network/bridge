#!/bin/bash -e

# #############################################################################
#
# nuke previous test cluster
#
# #############################################################################

if [ -z "${1}" ] || [ "${1}" = "nuke" ]; then
  docker rm --force \
    rmkr-test-postgres \
    rmkr-test-app \
    rmkr-test-migrate \
    rmkr-test-seed \
    rmkr-test-e2e || true

  docker network rm rmkr-test || true
fi

# #############################################################################
#
# install dependencies
#
# #############################################################################

if [ -z "${1}" ] || [ "${1}" = "deps" ]; then
  rm -rf node_modules
  npm ci
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
# validate types
#
# #############################################################################

if [ -z "${1}" ] || [ "${1}" = "typecheck" ]; then
  npx prisma generate
  npx tsc --noEmit
fi

# #############################################################################
#
# build docker image
#
# #############################################################################

if [ -z "${1}" ] || [ "${1}" = "image" ]; then
  docker build . -t rmkr-test-image
fi

# #############################################################################
#
# spin up test cluster
#
# #############################################################################

if [ -z "${1}" ] || [ "${1}" = "up" ]; then
  docker network create rmkr-test

  docker run \
    --env POSTGRES_USER="postgres" \
    --env POSTGRES_PASSWORD="postgres" \
    --network rmkr-test \
    --detach \
    --name rmkr-test-postgres \
    ankane/pgvector

  sleep 3

  docker run \
    --env PG_CONNECTION_STRING="postgresql://postgres:postgres@rmkr-test-postgres:5432/postgres" \
    --network rmkr-test \
    --entrypoint "/usr/local/bin/npx" \
    --name rmkr-test-migrate \
    rmkr-test-image \
    prisma migrate dev

  docker run \
    --env PG_CONNECTION_STRING="postgresql://postgres:postgres@rmkr-test-postgres:5432/postgres" \
    --env OPENAI_API_KEY="${OPENAI_API_KEY}" \
    --env APP_NAME="robot-maker" \
    --env APP_ENV="test" \
    --network rmkr-test \
    --entrypoint "/usr/local/bin/npx" \
    --name rmkr-test-seed \
    rmkr-test-image \
    mocha ./build/mocha/seed.js

  docker run \
    --env PG_CONNECTION_STRING="postgresql://postgres:postgres@rmkr-test-postgres:5432/postgres" \
    --env APP_NAME="robot-maker" \
    --env APP_ENV="test" \
    --network rmkr-test \
    --detach \
    --name rmkr-test-app \
    rmkr-test-image \
    ./build/src/app.js
fi

# #############################################################################
#
# run end-to-end tests
#
# #############################################################################

if [ -z "${1}" ] || [ "${1}" = "e2e" ]; then
  docker run \
    --network rmkr-test \
    --entrypoint "/usr/local/bin/npx" \
    --name rmkr-test-e2e \
    rmkr-test-image \
    mocha ./build/scripts.test.js
fi