#! /bin/sh
#
# travis_install.sh
# Copyright (C) 2018 romgrk <romgrk@arch>
#
# Distributed under terms of the MIT license.
#

if [[ $(uname -s) == 'Darwin' ]]; then
    brew install git node gtk+3 gobject-introspection glib libffi;

    brew test -v libffi
    pkg-config --cflags glib-2.0 gobject-introspection-1.0;
fi;

npm install --build-from-source
