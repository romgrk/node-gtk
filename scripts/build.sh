#!/usr/bin/env bash

source ~/.nvm/nvm.sh

set -e -u

PUBLISH_BINARIES=false;
REPUBLISH_BINARIES=false;
SKIP_TESTS=false;

if [[ ${COMMIT_MESSAGE} =~ "[publish binary]" ]]; then
    PUBLISH_BINARIES=true;
fi;
if [[ ${COMMIT_MESSAGE} =~ "[republish binary]" ]]; then
    REPUBLISH_BINARIES=true;
fi;
if [[ ${COMMIT_MESSAGE} =~ "[skip tests]" ]]; then
    SKIP_TESTS=true;
fi;


function publish() {
    echo "### Publish ###"
    if [[ $PUBLISH_BINARIES == true ]]; then
        node-pre-gyp package testpackage;
        node-pre-gyp publish;
        node-pre-gyp info;
    elif [[ $REPUBLISH_BINARIES == true ]]; then
        node-pre-gyp package testpackage;
        node-pre-gyp unpublish;
        node-pre-gyp publish;
        node-pre-gyp info;
    fi;
}

function npm_test() {
    if [[ $SKIP_TESTS == true ]]; then
        return;
    fi;

    echo "### Running tests ###";

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
