#!/bin/bash -e

if [ -z "${APP_NAME}" ]; then
  echo "APP_NAME is not set. Exiting."
  exit 1
fi

if [ -z "${APP_ENV}" ]; then
  echo "APP_ENV is not set. Exiting."
  exit 1
fi

if [ -z "${PG_CONNECTION_STRING}" ]; then
  echo "PG_CONNECTION_STRING is not set. Exiting."
  exit 1
fi

if [ -z "${GITHUB_SHA}" ]; then
  echo "GITHUB_SHA is not set. Exiting."
  exit 1
fi

if [ -z "${GITHUB_TOKEN}" ]; then
  echo "GITHUB_TOKEN is not set. Exiting."
  exit 1
fi

if [ -z "${GITHUB_ACTOR}" ]; then
  echo "GITHUB_ACTOR is not set. Exiting."
  exit 1
fi


# #############################################################################
#
# login to ghcr
#
# #############################################################################

if [ "${1}" = "all" ] || [ "${1}" = "login" ]; then
  echo "${GITHUB_TOKEN}" | docker login ghcr.io -u "${GITHUB_ACTOR}" --password-stdin
fi

# #############################################################################
#
# publish docker image
#
# #############################################################################

if [ "${1}" = "all" ] || [ "${1}" = "publish" ]; then
  docker build . -t ghcr.io/relay-network/"${APP_NAME}":"${GITHUB_SHA}"
  docker push ghcr.io/relay-network/"${APP_NAME}":"${GITHUB_SHA}"
  docker tag ghcr.io/relay-network/"${APP_NAME}":"${GITHUB_SHA}" ghcr.io/relay-network/"${APP_NAME}":latest
  docker push ghcr.io/relay-network/"${APP_NAME}":latest
fi

# #############################################################################
#
# deploy database migrations
#
# #############################################################################

if [ "${1}" = "all" ] || [ "${1}" = "migrate" ]; then
  docker run \
    --env PG_CONNECTION_STRING="${PG_CONNECTION_STRING}" \
    --entrypoint "/usr/local/bin/npx" \
    ghcr.io/relay-network/"${APP_NAME}":"${GITHUB_SHA}" \
    prisma migrate deploy
fi

# #############################################################################
#
# create service (deploy image)
#
# #############################################################################

if [ "${1}" = "all" ] || [ "${1}" = "create" ]; then
  docker service create \
    --env PG_CONNECTION_STRING="${PG_CONNECTION_STRING}" \
    --env APP_NAME="${APP_NAME}" \
    --env APP_ENV="${APP_ENV}" \
    --env LETSENCRYPT_HOST="api.relay.network" \
    --env VIRTUAL_HOST="api.relay.network" \
    --env VIRTUAL_PATH="/${APP_NAME}/" \
    --env VIRTUAL_DEST="/" \
    --env VIRTUAL_PORT="8080" \
    --network "relay-network-primary" \
    --endpoint-mode dnsrr \
    --restart-max-attempts "3" \
    --name "${APP_NAME}-${APP_ENV}" \
    ghcr.io/relay-network/"${APP_NAME}":latest \
    ./build/src/app.js
fi

# #############################################################################
#
# update service (deploy image)
#
# #############################################################################

if [ "${1}" = "all" ] || [ "${1}" = "update" ]; then
  docker service update \
    --image ghcr.io/relay-network/"${APP_NAME}":"${GITHUB_SHA}" \
    --restart-max-attempts "3" \
    "${APP_NAME}-${APP_ENV}"
fi


# #############################################################################
#
# run some smoke tests
#
# #############################################################################

if [ "${1}" = "all" ] || [ "${1}" = "smoke" ]; then
  echo "NOT YET IMPLEMENTED"
fi