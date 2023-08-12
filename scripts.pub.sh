#!/bin/bash -e

function main () {
  if [ -z "${1}" ]; then
    default
  else
    for fn in "${@}"; do
      if [ "$(type -t "${fn}")" = "function" ]; then
        "${fn}"
      else 
        echo "scripts.dev.sh :: ERROR :: function ${fn} does not exist. Exiting."
        exit 1
      fi
    done
  fi
}

# #############################################################################
#
# VARIABLES
#
# #############################################################################

if [ -z "${APP_NAME}" ]; then
  echo "scripts.dev.sh :: ERROR :: APP_NAME is not set. Exiting."
  exit 1
fi

if [ -z "${GITHUB_SHA}" ]; then
  echo "scripts.publish.sh :: ERROR :: GITHUB_SHA is not set. Exiting."
  exit 1
fi

if [ -z "${GITHUB_TOKEN}" ]; then
  echo "scripts.publish.sh :: ERROR :: GITHUB_TOKEN is not set. Exiting."
  exit 1
fi

if [ -z "${GITHUB_ACTOR}" ]; then
  echo "scripts.publish.sh :: ERROR :: GITHUB_ACTOR is not set. Exiting."
  exit 1
fi

# #############################################################################
#
# WORKFLOWS
#
# #############################################################################

function default () {
  build
  login
  push
}

# #############################################################################
#
# COMMANDS
#
# #############################################################################

function build () {
  docker build . -t ghcr.io/relay-network/"${APP_NAME}":"${GITHUB_SHA}"
}

function login () {
  echo "${GITHUB_TOKEN}" | docker login ghcr.io -u "${GITHUB_ACTOR}" --password-stdin
}

function push () {
  docker push ghcr.io/relay-network/"${APP_NAME}":"${GITHUB_SHA}"
  docker tag ghcr.io/relay-network/"${APP_NAME}":"${GITHUB_SHA}" ghcr.io/relay-network/"${APP_NAME}":latest
  docker push ghcr.io/relay-network/"${APP_NAME}":latest
}

# #############################################################################
#
# EXECUTE
#
# #############################################################################

[[ "${BASH_SOURCE[0]}" = "${0}" ]] && main "${@}"