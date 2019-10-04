// TypeScript Type Definitions for https://github.com/romgrk/node-gtk
// TODO: move this file to ./ or ./lib

/**
 * Using public APIs example:
 * 
```ts
const * as ni = require('node-gtk');
const Gtk = ni.require('Gtk')
const GObject = ni.require('GObject')
ni.startLoop();
Gtk.init()
const win = new Gtk.Window()
console.log(GObject.typeName(win.__gtype__)) // "GtkWindow"
```
 */
declare module 'node-gtk' {

  /**
   * Represents a library's collection of objects. 
   */
   type GiRepository = any

/**
 * 
 * TODO: generic and build a type map of known/supported library names so automatically cast to a library "namespace"
 */
   function require(ns: string, ver: string): GiRepository
   function startLoop(): void

   function prependSearchPath(...TODO: TODO[]): TODO  //TODO
   function prependLibraryPath(...TODO: TODO[]): TODO  //TODO
   function _isLoaded(ns: string, ver?: string): boolean
   const System: TODO  //TODO

/**
 * This is not a public API and might change in the future. Use at your own risk.
 * 
 * @internal
 */
   const _c: TODO  //TODO

  // HEADS UP - from here typings are of protected/private APIs and still missing to complete


  /**
   * Heads up ! everything inside [_GIRepository] namespace is consider internal APIs and might not be supported in the future. 
   * 
   * Also notice that functions starting with upper-case need to be manually bind to [this] context instead of calling them directly. The following example function uses these functions to fetch all types from given library like `Gtk` and version like `3.0` and type metaata. Notice that some names might be actually referencing types belonging to other libraries like `Gdk`:
    
````
import {startLoop, _GIRepository as GI} from 'node-gtk'

 function extractLibrary(ns: string, ver: string) {
  gi.startLoop();
  const library: GI.GiInfo[] = [];
  // create an empty repository to load the objects and
  // load the library if not already loaded. Notice the use of `call`
  const repo = GI.Repository_get_default();
  if (!gi._isLoaded(ns, ver)) {
    GI.Repository_require.call(repo, ns, ver, 0);
  }
  const nInfos = GI.Repository_get_n_infos.call(repo, ns);
  for (let i = 0; i < nInfos; i++) {
    const info = GI.Repository_get_info.call(repo, ns, i);
    library.push(extractBasicInfo(info));
  }
  return library;
}
function extractBasicInfo(info: GI.GiInfo): BasicInfo {
  const typeId = GI.BaseInfo_get_type.call(info);
  return {
    name: GI.BaseInfo_get_name.call(info),
    ns: GI.BaseInfo_get_namespace.call(info),
    typeId,
    typeName: GI.info_type_to_string(typeId)
  };
}
interface BasicInfo {
  name:string
  ns: string
  typeId: number
  typeName: string
}
``` 
   * @internal
   */
   namespace _GIRepository {

  /**
   * Represents and primary information item within a library. It has a name and often a namespace name that uniquely identifies. 
   * 
   * Created by [Repository_get_info]. Notice that ths object is only a reference, all the data must be extracted using methods like [BaseInfo_get_name], [BaseInfo_get_name], etc.
   * 
   * @internal
   */
   interface GiInfo {
  }


    /**
     * Usage: 
  ```js
  if (!nodegtk._isLoaded(ns, ver))
    GI.Repository_require.call(repo, ns, ver, 0);
  ```
     * @internal
     */
     function Repository_require(this: GiRepository, ns: string, ver: string, n: number): void

    /**
     * Usage: 
```js
const nInfos = GI.Repository_get_n_infos.call(repo, ns);
for (let i = 0;i < nInfos;i++) 
  const info = GI.Repository_get_info.call(repo, ns, i);
```
   * @internal
   */
     function Repository_get_n_infos(this: GiRepository, ns: string): number

    /**
     * Usage: 
```js
const nInfos = GI.Repository_get_n_infos.call(repo, ns);
for (let i = 0;i < nInfos;i++) {
  const info = GI.Repository_get_info.call(repo, ns, i);
```
    * @internal
    */
     function Repository_get_info(this: GiRepository, ns: string, index: number): GiInfo | undefined

    /**
     * Usage: 
```js
GI.Repository_require.call(repo, ns);
```
    * @internal
    */
     function Repository_get_info(this: GiRepository, ns: string): void
     function Repository_get_default(): GiRepository
    //   function  Repository_get_default(): GiRepository
     function Repository_get_version(this: GiRepository, ns: string): string
     function BaseInfo_get_name(this: GiInfo): string | undefined
     function BaseInfo_get_namespace(this: GiInfo): string | undefined
     function BaseInfo_get_type(this: GiInfo): number
     function BaseInfo_is_deprecated(this: GiInfo): boolean

     function info_type_to_string(infotype: number): string | undefined
     function type_info_get_tag(i: GiInfo): number | undefined
     function type_tag_to_string(t: number): string | undefined
     function registered_type_info_get_type_name(i: GiInfo): string | undefined
     function registered_type_info_get_g_type(t: GiInfo): number
     function callable_info_get_n_args(info: GiInfo): number

    //TODO: in general form here to the bottom is all TODO. and there are some more signatures still...
     function GetTypeSize(...TODO: TODO[]): TODO
     function object_info_get_parent(...TODO: TODO[]): TODO
     function struct_info_get_method(...TODO: TODO[]): TODO
     function object_info_get_n_interfaces(...TODO: TODO[]): TODO
     function object_info_get_n_properties(...TODO: TODO[]): TODO
     function object_info_get_n_constants(...TODO: TODO[]): TODO
     function function_info_get_flags(info: GiInfo): number
     function union_info_get_n_methods(info: GiInfo): number
     function union_info_get_method(info: GiInfo, i: number): TODO
     function isNoArgsConstructor(fn_info: TODO): TODO
     function union_info_get_method(info: GiInfo, i: number): TODO
     function ustruct_info_get_n_methods(...TODO: TODO[]): TODO
     function utype_info_get_array_type(...TODO: TODO[]): TODO
     function utype_info_is_zero_terminated(...TODO: TODO[]): TODO
     function utype_info_get_array_fixed_size(...TODO: TODO[]): TODO
     function utype_info_is_pointer(...TODO: TODO[]): TODO

     function type_info_get_array_type(...TODO: TODO[]): TODO
     function type_info_is_zero_terminated(...TODO: TODO[]): TODO
     function type_info_get_array_fixed_size(...TODO: TODO[]): TODO
     function type_info_is_pointer(...TODO: TODO[]): TODO
     function type_info_get_interface(...TODO: TODO[]): TODO


     function value_info_get_value(...TODO: TODO[]): TODO
     function property_info_get_flags(...TODO: TODO[]): TODO
     function property_info_get_type(...TODO: TODO[]): TODO
     function property_info_get_ownership_transfer(...TODO: TODO[]): TODO


     function field_info_get_flags(...TODO: TODO[]): TODO
     function field_info_get_offset(...TODO: TODO[]): TODO
     function field_info_get_size(...TODO: TODO[]): TODO
     function field_info_get_type(...TODO: TODO[]): TODO


     function struct_info_get_size(...TODO: TODO[]): TODO
     function struct_info_get_alignment(...TODO: TODO[]): TODO
     function struct_info_is_gtype_struct(...TODO: TODO[]): TODO
     function struct_info_is_foreign(...TODO: TODO[]): TODO
     function union_info_get_size(...TODO: TODO[]): TODO
     function union_info_get_alignment(...TODO: TODO[]): TODO
     function union_info_is_discriminated(...TODO: TODO[]): TODO


     function struct_info_is_foreign(...TODO: TODO[]): TODO
     function findBoxedConstructor(...TODO: TODO[]): TODO
     function struct_info_get_n_methods(...TODO: TODO[]): TODO
     function struct_info_get_method(...TODO: TODO[]): TODO
     function struct_info_get_n_fields(...TODO: TODO[]): TODO
     function struct_info_get_field(...TODO: TODO[]): TODO



     const Transfer: TODO
     const FunctionInfoFlags: TODO //{      IS_CONSTRUCTOR: number,    }
     enum GIArrayType {
      GI_ARRAY_TYPE_C,
      GI_ARRAY_TYPE_ARRAY,
      GI_ARRAY_TYPE_PTR_ARRAY,
      GI_ARRAY_TYPE_BYTE_ARRAY
      
    }
     const FieldInfoFlags: TODO

     const InfoType: {
      UNION: TODO,
      TYPE: TODO
      ARRAY: TODO
      CALLBACK: TODO
    }
     const TypeTag: TODO
     const ArrayType: TODO
  }

type TODO = any
}
