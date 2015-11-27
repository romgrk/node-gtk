{
    "targets": [
        {
            "target_name": "gi",
            "sources": [
                "src/loop.cc",
                "src/gi.cc",
                "src/value.cc",
                "src/function.cc",
                "src/gobject.cc",
            ],
            "cflags": [
                "<!@(pkg-config --cflags gobject-introspection-1.0) -Wall -Werror",
            ],
            "ldflags": [
                "<!@(pkg-config --libs gobject-introspection-1.0)",
            ],
        }
    ]
}
