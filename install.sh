#! /bin/sh
# install.sh
# Copyright (C) 2018 romgrk <romgrk.cc@gmail.com>
#

if [ "$(uname)" = "Darwin" ] && [ "$(which brew)" != "" ]; then
    export PKG_CONFIG_PATH=$(brew --prefix libffi)/lib/pkgconfig
fi

node-pre-gyp install --fallback-to-build
