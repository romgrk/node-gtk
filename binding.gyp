{
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
                "src/gi.cc",
                "src/gobject.cc",
                "src/loop.cc",
                "src/param_spec.cc",
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
            "cflags": [
                "<!@(pkg-config --cflags gobject-introspection-1.0 cairo) -Wall -g",
            ],
            "ldflags": [
                "-Wl,-no-as-needed",
                "<!@(pkg-config --libs gobject-introspection-1.0 cairo)",
            ],
            "conditions": [
                ['OS != "linux"', {
                    "defines": [
                        "ulong=unsigned long",
                        "PLATFORM_LINUX=1",
                    ]
                }],
                ['OS == "mac"', {
                    "defines": [
                        "ulong=unsigned long",
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
                        "uint=unsigned int",
                        "PLATFORM_WIN=1",
                    ],
                    "include_dirs": [
                        "include",
                        "/msys64/mingw64/include/gobject-introspection-1.0",
                        "/msys64/mingw64/lib/libffi-3.2.1/include",
                        "/msys64/mingw64/include/glib-2.0",
                        "/msys64/mingw64/lib/glib-2.0/include",
                        "/msys64/mingw64/include/cairo"
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
