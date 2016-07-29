'use strict';

const util = require('util');

const nodegtk = require('../lib/index');
nodegtk.startLoop();

global.g = nodegtk.require('GObject');

const GI           = nodegtk.GIRepository;
const InfoType     = GI.InfoType;
const TypeTag      = GI.TypeTag;

function def(obj, name, data) {
    Object.defineProperty(obj, name, {
        enumerable: false,
        configurable: true,
        value: data
    });
}

const obj         = ()          => Object.create(null);
const name        = (info)      => GI.BaseInfo_get_name.call(info);
const namespace   = (info)      => GI.BaseInfo_get_namespace.call(info);
const type        = (info)      => GI.BaseInfo_get_type.call(info);
const type_string = (infotype)  => GI.info_type_to_string(infotype);
const tag         = (type_info) => GI.type_info_get_tag(type_info);
const tag_string  = (type_tag)  => GI.type_tag_to_string(type_tag);

function gtype(info) {
    var type_name = GI.registered_type_info_get_type_name(info);
    if (type_name === '')
        return null;
    else
        return GI.registered_type_info_get_g_type(info);
}


function BaseInfo(info) {
    def(this, "_info", info);
    def(this, "_type", type(info)); // info_type
    def(this, "_ns",   namespace(info));
    this.type = GI.info_type_to_string(this._type);
    if (this._type != InfoType.TYPE)
        this.name = name(info);
}

function TypeInfo(info) {
    BaseInfo.call(this, info);
    def(this, "_tag",  tag(info));
    if (this._tag == GI.TypeTag.ARRAY) {
        this.type = tag_string(this._tag);

        var a = GI.type_info_get_array_type(info);
        this.array_type = GI.ArrayType[a];

        this.zero_terminated = GI.type_info_is_zero_terminated(info);
        this.fixed_size = GI.type_info_get_array_fixed_size(info);
        this.elem_type = new TypeInfo(GI.type_info_get_param_type(info, 0));

    } else if (this._tag == GI.TypeTag.INTERFACE) {
        def(this, "_interface", GI.type_info_get_interface(info));
        def(this, "_i_type", type(this._interface));
        this.type = name(this._interface);
    } else {
        this.type = tag_string(this._tag);
    }
}

function ConstantInfo(info) {
    BaseInfo.call(this, info);
    this.value = nodegtk.c.GetConstantValue(info);
}
ConstantInfo.prototype.valueOf = function () { return this.value };

function ValueInfo (info) {
    BaseInfo.call(this, info);
    def(this, '_value', GI.value_info_get_value(info));
}
ValueInfo.prototype.valueOf = function () { return this._value };

function PropInfo(info) {
    // BaseInfo.call(this, info);
    def(this, '_flags', GI.property_info_get_flags(info));
    def(this, '_type', GI.property_info_get_type(info));
    def(this, '_tag', tag(this._type));
    if (this._tag == InfoType.INTERFACE) {
        this.type = new TypeInfo(this._type);
    } else {
        this.type = tag_string(this._tag);
    }
    var transfer = GI.property_info_get_ownership_transfer(info);
    this.transfer = GI.Transfer[transfer];
}

function FieldInfo(info) {
    // BaseInfo.call(this, info);
    def(this, '_flags', GI.field_info_get_flags(info));
    def(this, '_offset', GI.field_info_get_offset(info));
    def(this, '_size', GI.field_info_get_size(info));
    def(this, '_type', GI.field_info_get_type(info));
    def(this, '_tag', tag(this._type));
    if (this._tag == GI.TypeTag.INTERFACE) {
        // var gtype = GI.registered_type_info_get_g_type(this._type);
        this.type = new TypeInfo(this._type);
    } else {
        this.type = tag_string(this._tag);
    }

    var readable = this._flags & GI.FieldInfoFlags.READABLE;
    if (readable == 0)
        this.readable = false;

    var writable = this._flags & GI.FieldInfoFlags.WRITABLE;
    if (writable == 0)
        this.writable = false;
}

function StructInfo(info) {
    BaseInfo.call(this, info);
    this.gtype     = gtype(info);
    this.size      = GI.struct_info_get_size(info);
    this.alignment = GI.struct_info_get_alignment(info);

    this.methods = obj();
    this.fields  = obj();

    var n_methods = GI.struct_info_get_n_methods(info);
    for (var i = 0; i < n_methods; i++) {
        var method = GI.struct_info_get_method(info, i);
        var methodName = name(method);
        this.methods[methodName] = new FunctionInfo(method);
    }

    var n_fields = GI.struct_info_get_n_fields(info);
    for (var i = 0; i < n_fields; i++) {
        var field = GI.struct_info_get_field(info, i);
        var fieldName = name(field);
        this.fields[fieldName] = new FieldInfo(field);
    }
}
StructInfo.prototype.is_gtype_struct = function () {
    return GI.struct_info_is_gtype_struct(this._info);
}
StructInfo.prototype.is_foreign =  function () {
    return GI.struct_info_is_foreign(this._info);
}


function UnionInfo(info) {
    BaseInfo.call(this, info);
    this.gtype = gtype(info);
    this.size = GI.union_info_get_size(info);
    this.alignment = GI.union_info_get_alignment(info);
    var is_discriminated = GI.union_info_is_discriminated(info);
    if (is_discriminated) {
        this.discriminator_type = new TypeInfo(GI.union_info_get_discriminator_type(info));
        this.discriminator_offset = GI.union_info_get_discriminator_offset(info);
    }

    this.methods = {};
    this.fields  = {};

    var n_methods = GI.union_info_get_n_methods(info);
    for (var i = 0; i < n_methods; i++) {
        var method = GI.union_info_get_method(info, i);
        var methodName = name(method);
        this.methods[methodName] = new FunctionInfo(method);
    }

    var n_fields = GI.union_info_get_n_fields(info);
    for (var i = 0; i < n_fields; i++) {
        var field = GI.union_info_get_field(info, i);
        var fieldName = name(field);
        this.fields[fieldName] = new FieldInfo(field);
        if (is_discriminated) {
            var d = GI.union_info_get_discriminator(info, i);
            this.fields[fieldName].discriminator = nodegtk.c.GetConstantValue(d);
        }
    }
}

function EnumInfo(info) {
    BaseInfo.call(this, info);
    this.gtype = gtype(info);

    this.values  = obj();
    this.methods = obj();

    var n_values = GI.enum_info_get_n_values(info);
    for (var i = 0; i < n_values; i++) {
        var valueInfo  = GI.enum_info_get_value(info, i);
        var valueName  = name(valueInfo);
        this.values[valueName] = new ValueInfo(valueInfo);
    }

    var n_methods = GI.enum_info_get_n_methods(info);
    for (var i = 0; i < n_methods; i++) {
        var method = GI.enum_info_get_method(info, i);
        var methodName = name(method);
        this.methods[methodName] = new FunctionInfo(method);
    }
}

function InterfaceInfo(info) {
    BaseInfo.call(this, info);
    this.gtype = gtype(info);
    this.iface_struct = GI.interface_info_get_iface_struct(info);
    this.prerequisites = obj();
    this.properties    = obj();
    this.methods       = obj();
    this.signals       = obj();
    this.vfuncs        = obj();
    this.constants     = obj();

    var n_prerequisites = GI.interface_info_get_n_prerequisites(info);
    for (var i = 0; i < n_prerequisites; i++) {
        var prerequisite = GI.interface_info_get_prerequisite(info, i);
        var prerequisiteName = name(prerequisite);
        this.prerequisites[prerequisiteName] = prerequisite;
    }

    var n_properties = GI.interface_info_get_n_properties(info);
    for (var i = 0; i < n_properties; i++) {
        var property = GI.interface_info_get_property(info, i);
        var propertyName = name(property);
        this.properties[propertyName] = property;
    }

    var n_methods = GI.interface_info_get_n_methods(info);
    for (var i = 0; i < n_methods; i++) {
        var method = GI.interface_info_get_method(info, i);
        var methodName = name(method);
        this.methods[methodName] = method;
    }

    var n_signals = GI.interface_info_get_n_signals(info);
    for (var i = 0; i < n_signals; i++) {
        var signal = GI.interface_info_get_signal(info, i);
        var signalName = name(signal);
        this.signals[signalName] = signal;
    }

    var n_vfuncs = GI.interface_info_get_n_vfuncs(info);
    for (var i = 0; i < n_vfuncs; i++) {
        var vfunc = GI.interface_info_get_vfunc(info, i);
        var vfuncName = name(vfunc);
        this.vfuncs[vfuncName] = vfunc;
    }

    var n_constants = GI.interface_info_get_n_constants(info);
    for (var i = 0; i < n_constants; i++) {
        var constant = GI.interface_info_get_constant(info, i);
        var constantName = name(constant);
        this.constants[constantName] = constant;
    }
}

function ObjectInfo(info) {
    // BaseInfo.call(this, info)
    this.gtype = gtype(info);
    def(this, '_parent', GI.object_info_get_parent(info));
    this.constants  = obj();
    this.fields     = obj();
    this.interfaces = obj();
    this.methods    = obj();
    this.properties = obj();
    this.signals    = obj();
    this.vfuncs     = obj();

    var n_properties = GI.object_info_get_n_properties(info);
    for (var i = 0; i < n_properties; i++) {
        var propertyInfo = GI.object_info_get_property(info, i);
        var propertyName = name(propertyInfo);
        this.properties[propertyName] = getInfo(propertyInfo);
    }

    var n_constants = GI.object_info_get_n_constants(info);
    for (var i = 0; i < n_constants; i++) {
        var constantInfo = GI.object_info_get_constant(info, i);
        var constantName = name(constantInfo);
        this.constants[constantName] = getInfo(constantInfo);
    }

    var n_interfaces = GI.object_info_get_n_interfaces(info);
    for (var i = 0; i < n_interfaces; i++) {
        var i_info = GI.object_info_get_interface(info, i);
        var i_name = name(i_info);
        this.interfaces[i_name] = new InterfaceInfo(i_info);
    }

    var n_methods = GI.object_info_get_n_methods(info);
    for (var i = 0; i < n_methods; i++) {
        var methodInfo = GI.object_info_get_method(info, i);
        var methodName = name(methodInfo);
        this.methods[methodName] = new FunctionInfo(methodInfo);
    }

    var n_properties = GI.object_info_get_n_properties(info);
    for (var i = 0; i < n_properties; i++) {
        var propertyInfo = GI.object_info_get_property(info, i);
        var propertyName = name(propertyInfo);
        this.properties[propertyName] = new PropInfo(propertyInfo);
    }

    var n_signals = GI.object_info_get_n_signals(info);
    for (var i = 0; i < n_signals; i++) {
        var signalInfo = GI.object_info_get_signal(info, i);
        var signalName = name(signalInfo);
        this.signals[signalName] = getInfo(signalInfo);
    }

    var n_vfuncs = GI.object_info_get_n_vfuncs(info);
    for (var i = 0; i < n_vfuncs; i++) {
        var vfuncInfo = GI.object_info_get_vfunc(info, i);
        var vfuncName = name(vfuncInfo);
        this.vfuncs[vfuncName] = vfuncInfo;
    }
}

function ArgInfo(info) {
    BaseInfo.call(this, info);
    def(this, "_type", GI.arg_info_get_type(info));
    def(this, "_tag", tag(this._type));
    this.tag = tag_string(this._tag);
    this.type = new TypeInfo(this._type);
    this.name = name(info);

    var dir = GI.arg_info_get_direction(info);
    this.direction = GI.Direction[dir];

    var transfer = GI.arg_info_get_ownership_transfer(info);
    this.transfer = GI.Transfer[transfer];
    var may_be_null = GI.arg_info_may_be_null(info);
    if (may_be_null)
        this.nullable = true;
    var is_caller_allocates = GI.arg_info_is_caller_allocates(info);
    if (is_caller_allocates)
        this.caller_allocates = true;
    var is_return_value = GI.arg_info_is_return_value(info);
    if (is_return_value)
        this.return_value = true;
    var is_skip = GI.arg_info_is_skip(info);
    if (is_skip)
        this.skip = true;
}

function CallableInfo(info) {
    this.n_args = GI.callable_info_get_n_args(info);
    this.args = [ ];
    for (var i = 0; i < this.n_args; i++) {
        var arg_info = GI.callable_info_get_arg(info, i);
        this.args[i] = new ArgInfo(arg_info);
    }
    var transfer = GI.callable_info_get_caller_owns(info);
    this.transfer = GI.Transfer[transfer];

    var return_type = GI.callable_info_get_return_type(info);
    var return_tag = tag(return_type);

    this.return_type = new TypeInfo(return_type);

    var may_return_null = GI.callable_info_may_return_null(info);
    if (may_return_null) this.may_return_null = true;

    var skip_return = GI.callable_info_skip_return(info)
    if (skip_return) this.skip_return = true;
}

function SignalInfo(info) {
    BaseInfo.call(this, info);
    CallableInfo.call(this, info);
    def(this, '_flags', GI.signal_info_get_flags(info));
}

function VFuncInfo(info) {
    BaseInfo.call(this, info);
    CallableInfo.call(this, info);
    var invoker = GI.vfunc_info_get_invoker(info);
    if (invoker)
        this.invoker = new FunctionInfo(invoker);
    var signal = GI.vfunc_info_get_invoker(info);
    if (signal)
        this.signal = new SignalInfo(signal);
}

function FunctionInfo(info) {
    BaseInfo.call(this, info);
    CallableInfo.call(this, info);
    def(this, '_flags',          GI.function_info_get_flags(info));
    def(this, '_is_method',      this.flags & GI.FunctionInfoFlags.IS_METHOD);
    def(this, '_is_constructor', this.flags & GI.FunctionInfoFlags.IS_CONSTRUCTOR);
    def(this, '_is_getter',      this.flags & GI.FunctionInfoFlags.IS_GETTER);
    def(this, '_is_setter',      this.flags & GI.FunctionInfoFlags.IS_SETTER);
}

function parseNamespace(ns, ver) {
    var module = Object.create(null);
    var repo = GI.Repository_get_default();
    GI.Repository_require.call(repo, ns, ver, 0);
    var nInfos = GI.Repository_get_n_infos.call(repo, ns);
    for (var i = 0; i < nInfos; i++) {
        var info = GI.Repository_get_info.call(repo, ns, i);
        var baseinfo = getInfo(info);
        var basename = name(info);
        module[basename] = baseinfo;
    }
    return module;
}

function getInfo (info) {
    switch (type(info)) {
        case InfoType.INVALID:
            return null;

        // CALLBACK
        case InfoType.FUNCTION:
            return new FunctionInfo(info);

        case InfoType.OBJECT:
            return new ObjectInfo(info);

        case InfoType.ENUM:
        case InfoType.FLAGS:
            return new EnumInfo(info);

        case InfoType.BOXED:
        case InfoType.STRUCT:
            return new StructInfo(info);

        case InfoType.UNION:
            return new UnionInfo(info);

        case InfoType.INTERFACE:
            return new InterfaceInfo(info);

        case InfoType.CONSTANT:
            return new ConstantInfo(info);

        case InfoType.FIELD:
            return new FieldInfo(info);

        case InfoType.PROPERTY:
            return new PropInfo(info);

        case InfoType.ARG:
            return new ArgInfo(info);

        case InfoType.TYPE:
            return new TypeInfo(info);

        case InfoType.VALUE:
            return new ValueInfo(info);

        case InfoType.SIGNAL:
            return new SignalInfo(info);
        case InfoType.VFUNC:
            return new VFuncInfo(info);

        case InfoType.UNRESOLVED:
            return undefined;
    }
    return new BaseInfo(info);
}

function getLibs() {
    let paths =
        GI.Repository_get_search_path()
        .map(p => require('fs').readdirSync(p));
    let files = [].concat(...paths)
        .filter(f => f.endsWith('.typelib'))
        .map(f => f.replace(/\.typelib/, ''))
        .map(f => [f].concat(f.split('-')));
    return files;
}

global.gi  = parseNamespace('GIRepository', '2.0');
global.gtk = parseNamespace('Gtk', '3.0');
global.gdk = parseNamespace('Gdk', '3.0');

module.exports = {
    BaseInfo, TypeInfo,
    ConstantInfo, ValueInfo, EnumInfo, ObjectInfo,
    CallableInfo, SignalInfo, FunctionInfo, VFuncInfo,
    nodegtk, parseNamespace, getLibs
};
