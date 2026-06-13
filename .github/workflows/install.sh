#!/bin/bash
set -euf
set -o pipefail

# IMPORTANT:
# If you change the dependencies, you must
# also increase the package cache key in main.yaml

if [[ $(uname -s) == 'Darwin' ]]; then
    brew update
    brew install \
        gtk+3 \
        gobject-introspection \
        glib \
        libsoup \
        cairo \
        gstreamer \
        gst-plugins-base \
        gst-plugins-good \
        gst-plugins-bad \
        libnice \
        python-setuptools
fi;

if [[ $(uname -s) == 'Linux' ]]; then
    sudo apt update
    sudo apt install -y --fix-missing \
        xvfb \
        libgirepository1.0-dev \
        gobject-introspection \
        build-essential \
        g++ \
        libgtk-3-dev \
        gir1.2-gtk-3.0 \
        libsoup-3.0-0 \
        gir1.2-soup-3.0 \
        libcairo2 \
        libcairo2-dev \
        libgstreamer1.0-0 \
        gir1.2-gstreamer-1.0 \
        gstreamer1.0-plugins-base \
        gir1.2-gst-plugins-base-1.0 \
        gstreamer1.0-plugins-bad \
        gir1.2-gst-plugins-bad-1.0

    # Best-effort: prebuilt GObject-introspection test libraries
    # (Regress, GIMarshallingTests) consumed by the marshalling test suite.
    # If unavailable, scripts/build-test-fixtures.js falls back to compiling
    # them from the gobject-introspection sources, and the tests skip if even
    # that is not possible — so never fail the build over this.
    sudo apt install -y gobject-introspection-tests || true
fi;
