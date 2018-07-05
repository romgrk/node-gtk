#! /bin/sh
# install.sh
# Copyright (C) 2018 rgregoir <rgregoir@laurier>
#

if [ "$(uname)" = "Darwin" ] && [ "$(which brew)" != "" ]; then
    export PKG_CONFIG_PATH=$(brew --prefix libffi)/lib/pkgconfig
fi

node-pre-gyp install

if [ -n $? ]; then
    node-gyp configure
    node-gyp build
fi
