
#include "toggle_queue.h"
#include "gobject.h"

namespace GNodeJS {

ToggleQueue toggleQueue;

void ToggleQueue::Synchronize (GObject *gobject) {
    g_mutex_lock (&lock);
    if (g_slist_find (objects, gobject) == NULL)
        objects = g_slist_prepend (objects, gobject);
    if (source == 0)
        source = g_idle_add (ToggleQueue::Drain, this);
    g_mutex_unlock (&lock);
}

void ToggleQueue::Cancel (GObject *gobject) {
    g_mutex_lock (&lock);
    objects = g_slist_remove (objects, gobject);
    g_mutex_unlock (&lock);
}

/* Runs on the main context. The lock is held across the drain so a (buggy,
 * over-unreffed) off-thread finalize cancelling its entry cannot race the
 * entry being processed. SynchronizeToggleState never re-enters the queue,
 * so this cannot deadlock. */
gboolean ToggleQueue::Drain (gpointer user_data) {
    auto *self = static_cast<ToggleQueue *> (user_data);

    g_mutex_lock (&self->lock);
    GSList *objects = self->objects;
    self->objects = NULL;
    self->source = 0;

    for (GSList *l = objects; l != NULL; l = l->next)
        SynchronizeToggleState ((GObject *) l->data);

    g_slist_free (objects);
    g_mutex_unlock (&self->lock);
    return G_SOURCE_REMOVE;
}

}; /* GNodeJS */
