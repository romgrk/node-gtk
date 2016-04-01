{
    "targets": [
        {
            "target_name": "node-gtk",
            "sources": [
                "src/loop.cc",
                "src/gi.cc",
                "src/value.cc",
                "src/function.cc",
                "src/gobject.cc",
                "src/closure.cc",
                "src/boxed.cc",
                "src/debug.cc",
            ],
            "cflags": [
                "<!@(pkg-config --cflags gobject-introspection-1.0) -Wall -g",
            ],
            "ldflags": [
                "-Wl,-no-as-needed",
                "<!@(pkg-config --libs gobject-introspection-1.0)",
            ],
            "conditions": [
                ['OS != "linux"', {
                    "defines": [
                        "ulong=unsigned long",
                    ]
                }],
                ['OS == "mac"', {
                    "xcode_settings": {
                        "OTHER_CFLAGS": [
                            "<!@(pkg-config --cflags glib-2.0 gobject-introspection-1.0)",
                        ],
                        "OTHER_LDFLAGS": [
                            "<!@(pkg-config --libs gobject-introspection-1.0)",
                        ]
                    },
                }],
                ['OS == "win"', {
                    "defines": [
                        "uint=unsigned int",
                    ],
                    "include_dirs": [
                        "include",
                        "/msys64/mingw64/include/gobject-introspection-1.0",
                        "/msys64/mingw64/lib/libffi-3.2.1/include",
                        "/msys64/mingw64/include/glib-2.0",
                        "/msys64/mingw64/lib/glib-2.0/include",
                    ]
                }]
            ]
        }
    ]
}
