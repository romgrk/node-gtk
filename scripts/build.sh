#!/usr/bin/env bash

source ~/.nvm/nvm.sh

set -e -u

PUBLISH_BINARIES=false;
REPUBLISH_BINARIES=false;

if [[ ${COMMIT_MESSAGE} =~ "[publish binary]" ]]; then
    PUBLISH_BINARIES=true;
fi;
if [[ ${COMMIT_MESSAGE} =~ "[republish binary]" ]]; then
    REPUBLISH_BINARIES=true;
fi;


function publish() {
    echo "### Publish ###"
    if [[ $PUBLISH_BINARIES == true ]]; then
        node-pre-gyp package testpackage;
        node-pre-gyp publish;
        node-pre-gyp info;
    elif [[ $REPUBLISH_BINARIES == true ]]; then
        node-pre-gyp package testpackage;
        node-pre-gyp republish;
        node-pre-gyp info;
    fi;
}

function npm_test() {
    echo "### Running tests ###";

    node ./tests/conversion__callback.js

    if [[ $(uname -s) == 'Darwin' ]]; then
        npm test;
    else
        xvfb-run -a npm test;
    fi;
}

# test installing from source
if [[ $PUBLISH_BINARIES == false ]] && [[ $REPUBLISH_BINARIES == false ]]; then
    npm install --build-from-source
    npm_test
else
    echo "### Building binaries for publishing ###"
    npm install --build-from-source
    npm_test
    publish
fi
