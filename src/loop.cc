
#include "loop.h"

#include <glib.h>
#include <uv.h>

/* Integration for the GLib main loop and UV's main loop */

namespace GNodeJS {

struct uv_loop_source {
    GSource source;
    uv_loop_t *loop;
};

static gboolean uv_loop_source_prepare (GSource *base, int *timeout) {
    struct uv_loop_source *source = (struct uv_loop_source *) base;
    uv_update_time (source->loop);

    bool loop_alive = uv_loop_alive (source->loop);

    /* If the loop is dead, we can simply sleep forever until a GTK+ source
     * (presumably) wakes us back up again. */
    if (!loop_alive)
        return FALSE;

    /* Otherwise, check the timeout. If the timeout is 0, that means we're
     * ready to go. Otherwise, keep sleeping until the timeout happens again. */
    int t = uv_backend_timeout (source->loop);
    *timeout = t;

    if (t == 0)
        return TRUE;
    else
        return FALSE;
}

static gboolean uv_loop_source_dispatch (GSource *base, GSourceFunc callback, gpointer user_data) {
    struct uv_loop_source *source = (struct uv_loop_source *) base;
    uv_run (source->loop, UV_RUN_NOWAIT);
    return G_SOURCE_CONTINUE;
}

static GSourceFuncs uv_loop_source_funcs = {
    uv_loop_source_prepare,
    NULL,
    uv_loop_source_dispatch,
    NULL,

    NULL, NULL,
};

static GSource *uv_loop_source_new (uv_loop_t *loop) {
    struct uv_loop_source *source = (struct uv_loop_source *) g_source_new (&uv_loop_source_funcs, sizeof (*source));
    source->loop = loop;
    g_source_add_unix_fd (&source->source,
                          uv_backend_fd (loop),
                          (GIOCondition) (G_IO_IN | G_IO_OUT | G_IO_ERR));
    return &source->source;
}

void StartLoop() {
    GSource *source = uv_loop_source_new (uv_default_loop ());
    g_source_attach (source, NULL);
}

};
