{
    # Node 26's official Windows binary is built with ClangCL + ThinLTO, so its
    # common.gypi injects `-flto=thin` and `/opt:lldltojobs=N` into the MSVC
    # AdditionalOptions of every target. MSVC's link.exe rejects those
    # Clang/lld-only options (LNK1117), which breaks the build on Windows +
    # Node 26. Strip them with gyp's list-exclusion filter. This lives under
    # msvs_settings, so it is inert on the make/xcode generators (Linux/macOS).
    "target_defaults": {
        "configurations": {
            "Release": {
                # Compile out the DEBUG()/LOG() tracing macros (src/macros.h).
                # Neither node-gyp nor Node's common.gypi defines NDEBUG, so
                # without this, debug tracing ends up in published prebuilts.
                "defines": [ "NDEBUG" ],
                "msvs_settings": {
                    "VCCLCompilerTool": {
                        "AdditionalOptions/": [ ["exclude", "flto"] ]
                    },
                    "VCLinkerTool": {
                        "AdditionalOptions/": [ ["exclude", "flto"], ["exclude", "lldltojobs"] ]
                    }
                }
            }
        }
    },
    "targets": [
        {
            "target_name": "node_gtk",
            "sources": [
                "src/async_call_environment.cc",
                "src/async_call_wrapper.cc",
                "src/boxed.cc",
                "src/callback.cc",
                "src/closure.cc",
                "src/debug.cc",
                "src/error.cc",
                "src/function.cc",
                "src/fundamental.cc",
                "src/gi.cc",
                "src/gobject.cc",
                "src/loop.cc",
                "src/param_spec.cc",
                "src/toggle_queue.cc",
                "src/type.cc",
                "src/util.cc",
                "src/value.cc",
                "src/modules/system.cc",
                "src/modules/cairo/cairo.cc",
                "src/modules/cairo/context.cc",
                "src/modules/cairo/font-extents.cc",
                "src/modules/cairo/font-face.cc",
                "src/modules/cairo/font-options.cc",
                "src/modules/cairo/glyph.cc",
                "src/modules/cairo/matrix.cc",
                "src/modules/cairo/path.cc",
                "src/modules/cairo/pattern.cc",
                "src/modules/cairo/rectangle-int.cc",
                "src/modules/cairo/rectangle.cc",
                "src/modules/cairo/region.cc",
                "src/modules/cairo/scaled-font.cc",
                "src/modules/cairo/surface.cc",
                "src/modules/cairo/text-cluster.cc",
                "src/modules/cairo/text-extents.cc",
            ],
            "include_dirs" : [
                "<!(node -e \"require('nan')\")"
            ],
            "conditions": [
                ['OS == "linux"', {
                    "defines": [
                        "PLATFORM_LINUX=1",
                    ],
                    "cflags": [
                        "<!@(pkg-config --cflags gobject-introspection-1.0 cairo)",
                        "-Wall",
                        "-g",
                    ],
                    "ldflags": [
                        "-Wl,-no-as-needed",
                        "<!@(pkg-config --libs gobject-introspection-1.0 cairo)",
                    ],
                }],
                ['OS == "mac"', {
                    "defines": [
                        "PLATFORM_MAC=1",
                    ],
                    "xcode_settings": {
                        "OTHER_CFLAGS": [
                            "<!@(pkg-config --cflags glib-2.0 gobject-introspection-1.0 cairo)",
                        ],
                        "OTHER_LDFLAGS": [
                            "<!@(pkg-config --libs gobject-introspection-1.0 cairo)",
                        ]
                    },
                }],
                ['OS == "win"', {
                    "defines": [
                        "PLATFORM_WIN=1",
                    ],
                    "variables": {
                        # If MSYS2 is NOT installed in C:/msys64 run:
                        # $ export MINGW_WINDOWS_PATH=$(./windows/mingw_windows_path.sh)
                        # before compiling
                        "MINGW_PREFIX": "<!(bash -c 'echo ${MINGW_WINDOWS_PATH:-/msys64}')",
                    },
                    "include_dirs": [
                        # Don't include /mingw64/include directly.
                        # To make extra include dir run:
                        # $ ./windows/mingw_include_extra.sh
                        # before compiling
                        "<(MINGW_PREFIX)/mingw64/include/__extra__",

                        "<(MINGW_PREFIX)/mingw64/include/gobject-introspection-1.0",
                        "<(MINGW_PREFIX)/mingw64/include/glib-2.0",
                        "<(MINGW_PREFIX)/mingw64/lib/glib-2.0/include",
                        "<(MINGW_PREFIX)/mingw64/include/cairo",
                        "<(MINGW_PREFIX)/mingw64/include/freetype2",
                    ],
                    "libraries": [
                        "<(MINGW_PREFIX)/mingw64/lib/libglib-2.0.dll.a",
                        "<(MINGW_PREFIX)/mingw64/lib/libgmodule-2.0.dll.a",
                        "<(MINGW_PREFIX)/mingw64/lib/libgobject-2.0.dll.a",
                        "<(MINGW_PREFIX)/mingw64/lib/libffi.dll.a",
                        "<(MINGW_PREFIX)/mingw64/lib/libgirepository-1.0.dll.a",
                        "<(MINGW_PREFIX)/mingw64/lib/libcairo.dll.a",
                    ]
                }]
            ]
        },
        {
            "target_name": "action_after_build",
            "type": "none",
            "dependencies": [ "<(module_name)" ],
            "copies": [
                {
                    "files": [ "<(PRODUCT_DIR)/<(module_name).node" ],
                    "destination": "<(module_path)"
                }
            ]
        }
    ]
}
