
#pragma once

#include <glib-object.h>

namespace GNodeJS {

/*
 * Defers toggle-state synchronization to the main context.
 *
 * "Synchronize" is meant as reconcile — bring the wrapper's V8 persistent
 * (weak or strong) in line with the GObject's current refcount — not as
 * synchronous execution: requests may come from any thread, and the
 * reconciliation itself always runs later, from an idle on the main context.
 *
 * A toggle notification runs on whatever thread crosses the 1<->2 refcount
 * boundary, but V8 global handles may only be touched from the JS thread
 * (see ToggleNotify in gobject.cc). Off-thread notifications land here.
 *
 * The queue stores no direction: by the time the idle runs, the notified
 * direction is stale (the refcount may have crossed the boundary again, in
 * either order). Each drained object is instead reconciled from its current
 * refcount (SynchronizeToggleState), which makes the deferral idempotent and
 * ordering-insensitive.
 *
 * Entries hold no reference (taking one from inside a toggle handler would
 * recursively fire the opposite toggle). A live wrapper's toggle ref keeps
 * the object's refcount >= 1, so a queued object cannot be finalized under
 * normal operation; as a safety net the GObjectFinalized weak callback and
 * the wrapper teardown Cancel() any pending entry.
 */
class ToggleQueue {
public:
    /* Request a deferred synchronization of the object's toggle state.
     * Callable from any thread. */
    void Synchronize (GObject *gobject);

    /* Drop the object's pending synchronization, if any. Callable from any
     * thread. Must be called before the object can be finalized, so the
     * drain never touches freed memory. */
    void Cancel (GObject *gobject);

private:
    static gboolean Drain (gpointer user_data);

    GMutex  lock;
    GSList *objects;
    guint   source;
};

extern ToggleQueue toggleQueue;

}; /* GNodeJS */
