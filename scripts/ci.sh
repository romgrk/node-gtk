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


# The Linux Release build embeds full DWARF debug info (binding.gyp passes -g so
# a local `pnpm run build` stays debuggable), which balloons the addon from
# ~0.5MB to ~5MB. Strip the packaged copy — and only that copy, right before
# `node-pre-gyp package` archives it — so every user's download shrinks ~90%
# while local builds keep their symbols.
function strip_binaries() {
    echo "### Stripping prebuilt ###"
    local os
    os=$(uname -s)
    for f in lib/binding/*/node_gtk.node; do
        [[ -e "$f" ]] || continue
        local before after
        before=$(wc -c < "$f")
        if [[ $os == 'Darwin' ]]; then
            strip -x "$f";
        else
            strip --strip-unneeded "$f";
        fi
        after=$(wc -c < "$f")
        echo "  $f: ${before} -> ${after} bytes"
    done

    # Stripping runs after the test job, so a strip that produced an unloadable
    # addon would otherwise ship unnoticed. Smoke-test the stripped binary here;
    # `set -e` aborts the publish if it can no longer be loaded.
    node -e "require('./lib/index.js').require('GLib', '2.0')"
    echo "  stripped addon loads OK"
}

function publish() {
    echo "### Publish ###"
    strip_binaries
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
        export GST_PLUGIN_SYSTEM_PATH=$(brew --prefix gstreamer)/lib/gstreamer-1.0;
        # This branch calls mocha directly (not `pnpm test`), so the pretest
        # fixture build does not run automatically; do it here. Best-effort:
        # marshalling tests skip if fixtures cannot be produced on macOS.
        pnpm run build:test-fixtures || true;
        NODE_GTK_TEST_SKIP=callback npx mocha tests/__run__.js
    else
        NODE_GTK_TEST_SKIP=callback xvfb-run -a pnpm test;
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
