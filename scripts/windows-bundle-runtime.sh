#!/bin/bash
#
# windows-bundle-runtime.sh
#
# Make a freshly-built Windows prebuilt self-contained so it can be used WITHOUT
# MSYS2/MinGW or any compiler on the target machine. We copy the addon's entire
# transitive MinGW DLL closure next to the .node, plus the GObject-Introspection
# typelibs it needs at runtime.
#
# Run inside the MINGW64 shell, after building.
#
#   ./scripts/windows-bundle-runtime.sh lib/binding/node-v127-win32-x64
#
set -euo pipefail

BINDING_DIR="${1:?usage: windows-bundle-runtime.sh <binding-dir>}"
NODE_FILE="$BINDING_DIR/node_gtk.node"

if [ ! -f "$NODE_FILE" ]; then
  echo "error: $NODE_FILE not found"
  ls -la "$BINDING_DIR" || true
  exit 1
fi

echo "## Computing recursive DLL closure for $NODE_FILE"
# ntldd -R prints every transitive dependency with its resolved Windows path:
#   libgtk-3-0.dll => C:\msys64\mingw64\bin\libgtk-3-0.dll (0x...)
# We keep only the MinGW-provided DLLs (skip C:\Windows\System32 OS DLLs).
copied=0
ntldd -R "$NODE_FILE" \
  | sed -n 's/.* => \(.*\) (0x.*/\1/p' \
  | while IFS= read -r winpath; do
      [ -z "$winpath" ] && continue
      u=$(cygpath -u "$winpath" 2>/dev/null || echo "$winpath")
      case "$u" in
        *mingw64*)
          if [ -f "$u" ]; then
            cp -f "$u" "$BINDING_DIR/"
            echo "  + $(basename "$u")"
            copied=$((copied + 1))
          fi
          ;;
      esac
    done
echo "## DLLs bundled into $BINDING_DIR"

echo "## Bundling GObject-Introspection typelibs"
TYPELIB_SRC=$(pkg-config --variable=typelibdir gobject-introspection-1.0 2>/dev/null || true)
if [ -z "$TYPELIB_SRC" ] || [ ! -d "$TYPELIB_SRC" ]; then
  TYPELIB_SRC=/mingw64/lib/girepository-1.0
fi
TYPELIB_DST="$BINDING_DIR/girepository-1.0"
mkdir -p "$TYPELIB_DST"
# Copy the full typelib set; it is small and guarantees every transitive
# namespace dependency (Gdk, Pango, cairo, GdkPixbuf, Atk, HarfBuzz, ...) is present.
cp -f "$TYPELIB_SRC"/*.typelib "$TYPELIB_DST/"
echo "## Typelibs bundled from $TYPELIB_SRC -> $TYPELIB_DST"

echo
echo "## Bundle contents:"
ls -la "$BINDING_DIR"
echo "## du:"
du -sh "$BINDING_DIR"
