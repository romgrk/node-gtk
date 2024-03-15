#!/usr/bin/env bash
set -eu
set -o pipefail

node --version

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
        npx node-pre-gyp package testpackage;
        npx node-pre-gyp publish;
        npx node-pre-gyp info;
    elif [[ $REPUBLISH_BINARIES == true ]]; then
        npx node-pre-gyp package testpackage;
        npx node-pre-gyp unpublish;
        npx node-pre-gyp publish;
        npx node-pre-gyp info;
    fi;
}

function npm_test() {
    if [[ $SKIP_TESTS == true ]]; then
        return;
    fi;

    echo "### Running tests ###";

    if [[ $(uname -s) == 'Darwin' ]]; then
        export GST_PLUGIN_SYSTEM_PATH=/usr/local/lib/gstreamer-1.0;
        npx mocha                                 \
                  --skip=callback                 \
                  --skip=error                    \
                  tests/__run__.js
    else
        xvfb-run -a npm test -- --skip=callback;
    fi;
}

# test installing from source
if [[ $PUBLISH_BINARIES == false ]] && [[ $REPUBLISH_BINARIES == false ]]; then
    npm_test
else
    echo "### Building binaries for publishing ###"
    npm_test
    publish
fi
