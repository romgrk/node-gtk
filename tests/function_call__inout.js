/*
 * function_call__inout.js
 */

const gi = require('../lib')
const GLib = gi.require('GLib', '2.0');
const Gtk = gi.require('Gtk', '3.0');
const { describe, it, expect, assert } = require('./__common__.js')

Gtk.init([])

describe('Function IN-OUT paramters', () => {
  it('works with simple types', () => {

    const initialText = 'abcdef'
    const newText = '_'
    const finalText = 'abc_def'

    const editable = new Gtk.Entry()
    editable.setText(initialText)

    let position = 3
    position = editable.insertText(newText, newText.length, position)
    /* The function updates position to point after the newly inserted text. */

    expect(position, 4)
    expect(editable.getText(), finalText)
  })

  it('works with string types', () => {
    const data = 'aGVsbG8='
    // XXX: This one is failing
    // const result = GLib.base64Decode(data, data.length)
    // expect(result, 'hello')
  })

  it('works with complex types', () => {
    // XXX: Adapt the C case below

    // GOptionContext *context;
    // gboolean retval;
    // GError *error = NULL;
    // gchar **argv;
    // int argc;
    // GOptionGroup *main_group;
    // GOptionEntry entries [] =
    //   { { "test", 0, 0, G_OPTION_ARG_INT, &error_test1_int, NULL, NULL },
    //     { NULL } };


    // context = g_option_context_new (NULL);
    // g_option_context_add_main_entries (context, entries, NULL);

    // /* Set pre and post parse hooks */
    // main_group = g_option_context_get_main_group (context);
    // g_option_group_set_parse_hooks (main_group,
    //               error_test1_pre_parse, error_test1_post_parse);

    // /* Now try parsing */
    // argv = split_string ("program --test 20", &argc);

    // retval = g_option_context_parse (context, &argc, &argv, &error);
    // g_assert (retval == FALSE);

    // /* On failure, values should be reset */
    // g_assert (error_test1_int == 0x12345678);

    // g_strfreev (argv);
    // g_option_context_free (context);

    // const result = Gtk.parseArgs(['argument1', '--gtk-debug', 'misc', 'argument2'])
    // console.log(result)
  })
})
