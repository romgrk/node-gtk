#include <gtksourceview/gtksource.h>

#include <stdio.h>

int main (int argc, char *argv) {
    GtkSourceStyleSchemeManager *manager = gtk_source_style_scheme_manager_get_default();
    gchar * const *ids;
    ids = (gchar * const *)gtk_source_style_scheme_manager_get_scheme_ids(manager);
    for (int i = 0; ids[i] != NULL; i++) {
        printf("%s\n", ids[i]);
    }
    return 0;
}
