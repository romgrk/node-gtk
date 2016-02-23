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
            ],
            "cflags": [
                "<!@(pkg-config --cflags gobject-introspection-1.0) -Wall -Werror",
            ],
            "ldflags": [
                "-Wl,-no-as-needed",
                "<!@(pkg-config --libs gobject-introspection-1.0)",
            ],
        }
    ]
}
