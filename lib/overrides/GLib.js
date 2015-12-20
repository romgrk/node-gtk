
exports.apply = function(GLib) {
    GLib.test_override = function() {
        return 1 + 1;
    };
};
