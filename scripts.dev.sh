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

if [ -z "${PG_CONNECTION_STRING}" ]; then
  echo "scripts.dev.sh :: ERROR :: PG_CONNECTION_STRING is not set. Exiting."
  exit 1
fi

if [ -z "${APP_NAME}" ]; then
  echo "scripts.dev.sh :: ERROR :: APP_NAME is not set. Exiting."
  exit 1
fi

if [ -z "${APP_ENV}" ]; then
  echo "scripts.dev.sh :: ERROR :: APP_ENV is not set. Exiting."
  exit 1
fi

if [ -z "${APP_INSTANCE}" ]; then
  echo "scripts.dev.sh :: ERROR :: APP_INSTANCE is not set. Exiting."
  exit 1
fi

# #############################################################################
#
# WORKFLOWS
#
# #############################################################################

function default () {
  on_exit
  deps::nuke
  deps
  compile::nuke
  compile
  compile::watch </dev/null &
  webhook </dev/null &
  canary </dev/null &
  bridge </dev/null &
  wait
}

function validate () {
  on_exit
  deps::nuke
  deps
  lint
  format
  typecheck
  compile::nuke
  compile
  webhook </dev/null >./build/"${APP_NAME}"-webhook.log 2>&1 &
  canary </dev/null >./build/"${APP_NAME}"-canary.log 2>&1 &
  bridge </dev/null >./build/"${APP_NAME}"-bridge.log 2>&1 &
  e2e
  build
}


# #############################################################################
#
# COMMANDS
#
# #############################################################################

function deps::nuke () {
  rm -rf node_modules
}

function deps () {
  npm install
}

function lint () {
  npx eslint --max-warnings=0 .
}

function format () {
  npx prettier --check .
}

function typecheck () {
  npx tsc --noEmit
}

function compile::nuke () {
  rm -rf build
}

function compile () {
  npx tsc
}

function build () {
  docker build .
}

function compile::watch () {
  npx tsc --watch --preserveWatchOutput
}

function webhook () {
  PG_CONNECTION_STRING="${PG_CONNECTION_STRING}" \
  APP_NAME="${APP_NAME}" \
  APP_ENV="${APP_ENV}" \
  APP_INSTANCE="${APP_INSTANCE}" \
  APP_SERVICE="webhook" \
  npx nodemon -w build ./build/src/webhook.js
}

function canary () {
  PG_CONNECTION_STRING="${PG_CONNECTION_STRING}" \
  APP_NAME="${APP_NAME}" \
  APP_ENV="${APP_ENV}" \
  APP_INSTANCE="${APP_INSTANCE}" \
  APP_SERVICE="canary" \
  npx nodemon -w build ./build/src/canary.js
}

function bridge () {
  PG_CONNECTION_STRING="${PG_CONNECTION_STRING}" \
  APP_NAME="${APP_NAME}" \
  APP_ENV="${APP_ENV}" \
  APP_INSTANCE="${APP_INSTANCE}" \
  APP_SERVICE="bridge" \
  npx nodemon -w build ./build/src/app.js
}

function e2e () {
  PG_CONNECTION_STRING="${PG_CONNECTION_STRING}" \
  APP_NAME="${APP_NAME}" \
  APP_ENV="${APP_ENV}" \
  APP_INSTANCE="${APP_INSTANCE}" \
  APP_SERVICE="end-to-end" \
  npx mocha --exit ./build/mocha/e2e.js
}

# #############################################################################
#
# HELPERS
#
# #############################################################################

function tlog () {
  on_exit

  for f in canary webhook bridge e2e; do
    tail -F "./build/${APP_NAME}-${f}.log" | sed -e "s/^/[${f}] /" &
  done

  wait
}

function terr () {
  on_exit

  for f in canary webhook bridge e2e; do
    tail -F "./build/${APP_NAME}-${f}.error.log"
  done

  wait
}

function on_exit () {
  trap 'trap - SIGTERM && kill -- -$$' SIGINT SIGTERM EXIT
}

# #############################################################################
#
# EXECUTE MAIN
#
# #############################################################################

[[ "${BASH_SOURCE[0]}" = "${0}" ]] && main "${@}"