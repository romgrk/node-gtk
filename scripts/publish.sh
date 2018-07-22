#!/bin/bash
#
# publish.sh
# Copyright (C) 2018 romgrk <romgrk@arch>
#
# Distributed under terms of the MIT license.

if [ -f /usr/share/nvm/init-nvm.sh ]; then
    source /usr/share/nvm/init-nvm.sh
fi

## NodeJS versions
# We publish more than the versions we officially support, to be nice.
# Should be updated when a new NODE_MODULE_VERSION appears in https://nodejs.org/en/download/releases/
declare -a versions=("6.0.0" "7.0.0" "8.0.0" "9.0.0" "10.0.0")

## Publish each version
for version in "${versions[@]}"
do
    echo "##### Installing: $version ######"
    nvm install $version
    nvm use $version
    npm install
    ./node_modules/.bin/node-pre-gyp package publish
done
