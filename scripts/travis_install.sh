#! /bin/sh
#
# travis_install.sh
# Copyright (C) 2018 romgrk <romgrk@arch>
#
# Distributed under terms of the MIT license.
#

if [[ $(uname -s) == 'Darwin' ]]; then
    brew install git node gtk+3 gobject-introspection;
fi;

npm install --build-from-source
