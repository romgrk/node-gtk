
const chalk = require('chalk')

const nodegtk = require('../lib/index');
nodegtk.startLoop();

const infos = []

const GI = nodegtk._GIRepository;

function def(obj, name, data) {
    Object.defineProperty(obj, name, {
        enumerable: false,
        configurable: true,
        value: data
    });
}

const obj          = ()          => Object.create(null);
const name         = (info)      => GI.BaseInfo_get_name.call(info);
const namespace    = (info)      => GI.BaseInfo_get_namespace.call(info);
const getInfoType  = (info)      => GI.BaseInfo_get_type.call(info);
const type_string  = (infotype)  => GI.info_type_to_string(infotype);
const tag          = (type_info) => GI.type_info_get_tag(type_info);
const tag_string   = (type_tag)  => GI.type_tag_to_string(type_tag);
const isDeprecated = (info)      => GI.BaseInfo_is_deprecated.call(info)

function gtype(info) {
    const type_name = GI.registered_type_info_get_type_name(info);
    if (type_name === '')
        return null;
    else
        return GI.registered_type_info_get_g_type(info);
}

function isNoArgsConstructor(info) {
    const flags = GI.function_info_get_flags(info)
    return ((flags & GI.FunctionInfoFlags.IS_CONSTRUCTOR) != 0
        && GI.callable_info_get_n_args(info) == 0)
}

function isConstructor(info) {
    const flags = GI.function_info_get_flags(info)
    return (flags & GI.FunctionInfoFlags.IS_CONSTRUCTOR) != 0
}

function findBoxedConstructor(info, parent) {
    const type = getInfoType(info)
    let result = null

    if (type === GI.InfoType.UNION) {
        const n_methods = GI.union_info_get_n_methods (info);
        for (let i = 0; i < n_methods; i++) {
            const fn_info = GI.union_info_get_method (info, i);
            if (isNoArgsConstructor (fn_info)) {
                result = fn_info;
                break;
            }
        }

        if (!result) {
            for (let i = 0; i < n_methods; i++) {
                const fn_info = GI.union_info_get_method (info, i);
                if (name(fn_info) === 'new') {
                    result = fn_info;
                    break;
                }
            }
        }

        if (!result) {
            for (let i = 0; i < n_methods; i++) {
                const fn_info = GI.union_info_get_method (info, i);
                if (isConstructor (fn_info)) {
                    result = fn_info;
                    break;
                }
            }
        }

    }
    else {
        const n_methods = GI.struct_info_get_n_methods (info);
        for (let i = 0; i < n_methods; i++) {
            const fn_info = GI.struct_info_get_method (info, i);
            if (isNoArgsConstructor (fn_info)) {
                result = fn_info;
                break;
            }
        }

        if (!result) {
            for (let i = 0; i < n_methods; i++) {
                const fn_info = GI.struct_info_get_method (info, i);
                if (name(fn_info) === 'new') {
                    result = fn_info;
                    break;
                }
            }
        }

        if (!result) {
            for (let i = 0; i < n_methods; i++) {
                const fn_info = GI.struct_info_get_method (info, i);
                if (isConstructor (fn_info)) {
                    result = fn_info;
                    break;
                }
            }
        }
    }

    if (result)
        return new FunctionInfo(result, parent)

    return null
}

function BaseInfo(info, parent) {
    def(this, '_info', info);
    def(this, '_type', getInfoType(info)); // info_type
    def(this, '_ns',   namespace(info));

    this.infoType = GI.info_type_to_string(this._type);

    if (this._type != GI.InfoType.TYPE)
        this.name = name(info);

    if (parent)
        this.parent = parent

    if (isDeprecated(info))
        this.isDeprecated = true

    infos.push(this)
}

function TypeInfo(info) {
    BaseInfo.call(this, info)

    def(this, '_tag',  tag(info));

    if (this._tag == GI.TypeTag.ARRAY) {
        this.type = tag_string(this._tag);
        this.array_type = GI.ArrayType[GI.type_info_get_array_type(info)];
        this.zero_terminated = GI.type_info_is_zero_terminated(info);
        this.fixed_size = GI.type_info_get_array_fixed_size(info);
        this.size = nodegtk._c.GetTypeSize(info);
        const isPointer = GI.type_info_is_pointer(info)
        if (isPointer)
            this.isPointer = isPointer
        this.elementType = new TypeInfo(GI.type_info_get_param_type(info, 0));
    }
    else if (this._tag == GI.TypeTag.GLIST || this._tag == GI.TypeTag.GSLIST) {
        this.type = tag_string(this._tag);
        const isPointer = GI.type_info_is_pointer(info)
        if (isPointer)
            this.isPointer = isPointer
        this.elementType = new TypeInfo(GI.type_info_get_param_type(info, 0));
    }
    else if (this._tag == GI.TypeTag.GHASH) {
        this.type = tag_string(this._tag);
        const isPointer = GI.type_info_is_pointer(info)
        if (isPointer)
            this.isPointer = isPointer
        this.elementType = new TypeInfo(GI.type_info_get_param_type(info, 0));
    }
    else if (this._tag == GI.TypeTag.INTERFACE) {
        const interface = GI.type_info_get_interface(info)
        const infoType = GI.BaseInfo_get_type.call(interface)

        this.type = type_string(infoType) + '.' + name(interface)

        const isPointer = GI.type_info_is_pointer(info)
        if (isPointer)
            this.isPointer = isPointer

        if (infoType === GI.InfoType.CALLBACK) {
            this.callback = new FunctionInfo(interface, this)
        }
    }
    else {
        this.type = tag_string(this._tag);
        this.size = nodegtk._c.GetTypeSize(info);
        const isPointer = GI.type_info_is_pointer(info)
        if (isPointer)
            this.isPointer = isPointer
    }
}

function ConstantInfo(info, parent) {
    BaseInfo.call(this, info, parent)
    this.value = nodegtk._c.GetConstantValue(info);
}

function ValueInfo (info, parent) {
    BaseInfo.call(this, info)
    this.value = GI.value_info_get_value(info)
}

function PropInfo(info, parent) {
    BaseInfo.call(this, info, parent)
    def(this, '_flags', GI.property_info_get_flags(info));
    def(this, '_typeInfo', GI.property_info_get_type(info));
    def(this, '_tag', tag(this._typeInfo));
    if (this._tag == GI.InfoType.INTERFACE) {
        this.type = new TypeInfo(this._typeInfo);
    } else {
        this.type = tag_string(this._tag);
    }
    const transfer = GI.property_info_get_ownership_transfer(info);
    this.transfer = GI.Transfer[transfer];
}

function FieldInfo(info, parent) {
    BaseInfo.call(this, info, parent)
    def(this, '_flags', GI.field_info_get_flags(info));
    def(this, '_offset', GI.field_info_get_offset(info));
    def(this, '_size', GI.field_info_get_size(info));
    def(this, '_typeInfo', GI.field_info_get_type(info));
    def(this, '_tag', tag(this._typeInfo));

    if (this._tag == GI.TypeTag.INTERFACE) {
        // const gtype = GI.registered_type_info_get_g_type(this._type);
        this.type = new TypeInfo(this._typeInfo);
    } else {
        this.type = tag_string(this._tag);
    }

    const readable = this._flags & GI.FieldInfoFlags.READABLE;
    if (readable == 0)
        this.readable = false;

    const writable = this._flags & GI.FieldInfoFlags.WRITABLE;
    if (writable == 0)
        this.writable = false;
}

function StructInfo(info, parent) {
    BaseInfo.call(this, info, parent)
    this.gtype     = gtype(info);
    this.size      = GI.struct_info_get_size(info);
    this.alignment = GI.struct_info_get_alignment(info);
    this.is_gtype_struct = GI.struct_info_is_gtype_struct(this._info)
    this.is_foreign = GI.struct_info_is_foreign(this._info)

    this.constructor = findBoxedConstructor(info, this)
    this.methods = obj();
    this.fields  = obj();

    const n_methods = GI.struct_info_get_n_methods(info);
    for (let i = 0; i < n_methods; i++) {
        const method = GI.struct_info_get_method(info, i);
        const methodName = name(method);
        this.methods[methodName] = new FunctionInfo(method, this);
    }

    const n_fields = GI.struct_info_get_n_fields(info);
    for (let i = 0; i < n_fields; i++) {
        const field = GI.struct_info_get_field(info, i);
        const fieldName = name(field);
        this.fields[fieldName] = new FieldInfo(field, this);
    }
}

function UnionInfo(info, parent) {
    BaseInfo.call(this, info, parent)
    this.gtype = gtype(info);
    this.size = GI.union_info_get_size(info);
    this.alignment = GI.union_info_get_alignment(info);
    let is_discriminated = GI.union_info_is_discriminated(info);
    if (is_discriminated) {
        this.discriminator_type = new TypeInfo(GI.union_info_get_discriminator_type(info));
        this.discriminator_offset = GI.union_info_get_discriminator_offset(info);
    }

    this.constructor = findBoxedConstructor(info, this)
    this.methods = {};
    this.fields  = {};

    const n_methods = GI.union_info_get_n_methods(info);
    for (let i = 0; i < n_methods; i++) {
        const method = GI.union_info_get_method(info, i);
        const methodName = name(method);
        this.methods[methodName] = new FunctionInfo(method, this);
    }

    const n_fields = GI.union_info_get_n_fields(info);
    for (let i = 0; i < n_fields; i++) {
        const field = GI.union_info_get_field(info, i);
        const fieldName = name(field);
        this.fields[fieldName] = new FieldInfo(field, this);
        if (is_discriminated) {
            const d = GI.union_info_get_discriminator(info, i);
            this.fields[fieldName].discriminator = nodegtk._c.GetConstantValue(d);
        }
    }
}

function EnumInfo(info, parent) {
    BaseInfo.call(this, info, parent)
    this.gtype = gtype(info);

    this.values  = obj();
    this.methods = obj();

    const n_values = GI.enum_info_get_n_values(info);
    for (let i = 0; i < n_values; i++) {
        const valueInfo  = GI.enum_info_get_value(info, i);
        const valueName  = name(valueInfo);
        this.values[valueName] = new ValueInfo(valueInfo, this);
    }

    const n_methods = GI.enum_info_get_n_methods(info);
    for (let i = 0; i < n_methods; i++) {
        const method = GI.enum_info_get_method(info, i);
        const methodName = name(method);
        this.methods[methodName] = new FunctionInfo(method, this);
    }
}

function InterfaceInfo(info, parent) {
    BaseInfo.call(this, info, parent)
    this.gtype = gtype(info);
    const structInfo = GI.interface_info_get_iface_struct(info)
    if (structInfo !== null)
        this.iface_struct = new StructInfo(structInfo, this);
    this.prerequisites = obj();
    this.properties    = obj();
    this.methods       = obj();
    this.signals       = obj();
    this.vfuncs        = obj();
    this.constants     = obj();

    const n_prerequisites = GI.interface_info_get_n_prerequisites(info);
    for (let i = 0; i < n_prerequisites; i++) {
        const prerequisite = GI.interface_info_get_prerequisite(info, i);
        const prerequisiteName = name(prerequisite);
        this.prerequisites[prerequisiteName] = getInfo(prerequisite);
    }

    const n_properties = GI.interface_info_get_n_properties(info);
    for (let i = 0; i < n_properties; i++) {
        const property = GI.interface_info_get_property(info, i);
        const propertyName = name(property);
        this.properties[propertyName] = getInfo(property, this);
    }

    const n_methods = GI.interface_info_get_n_methods(info);
    for (let i = 0; i < n_methods; i++) {
        const method = GI.interface_info_get_method(info, i);
        const methodName = name(method);
        this.methods[methodName] = getInfo(method, this);
    }

    const n_signals = GI.interface_info_get_n_signals(info);
    for (let i = 0; i < n_signals; i++) {
        const signal = GI.interface_info_get_signal(info, i);
        const signalName = name(signal);
        this.signals[signalName] = signal;
    }

    const n_vfuncs = GI.interface_info_get_n_vfuncs(info);
    for (let i = 0; i < n_vfuncs; i++) {
        const vfunc = GI.interface_info_get_vfunc(info, i);
        const vfuncName = name(vfunc);
        this.vfuncs[vfuncName] = vfunc;
    }

    const n_constants = GI.interface_info_get_n_constants(info);
    for (let i = 0; i < n_constants; i++) {
        const constant = GI.interface_info_get_constant(info, i);
        const constantName = name(constant);
        this.constants[constantName] = getInfo(constant);
    }
}

function ObjectInfo(info, parent) {
    BaseInfo.call(this, info, parent)
    this.gtype = gtype(info);
    def(this, '_parent', GI.object_info_get_parent(info));
    this.constants  = obj();
    this.fields     = obj();
    this.interfaces = obj();
    this.methods    = obj();
    this.properties = obj();
    this.signals    = obj();
    this.vfuncs     = obj();

    const n_properties = GI.object_info_get_n_properties(info);
    for (let i = 0; i < n_properties; i++) {
        const propertyInfo = GI.object_info_get_property(info, i);
        const propertyName = name(propertyInfo);
        this.properties[propertyName] = getInfo(propertyInfo, this);
    }

    const n_constants = GI.object_info_get_n_constants(info);
    for (let i = 0; i < n_constants; i++) {
        const constantInfo = GI.object_info_get_constant(info, i);
        const constantName = name(constantInfo);
        this.constants[constantName] = getInfo(constantInfo, this);
    }

    const n_interfaces = GI.object_info_get_n_interfaces(info);
    for (let i = 0; i < n_interfaces; i++) {
        const i_info = GI.object_info_get_interface(info, i);
        const i_name = name(i_info);
        this.interfaces[i_name] = new InterfaceInfo(i_info, this);
    }

    const n_methods = GI.object_info_get_n_methods(info);
    for (let i = 0; i < n_methods; i++) {
        const methodInfo = GI.object_info_get_method(info, i);
        const methodName = name(methodInfo);
        this.methods[methodName] = new FunctionInfo(methodInfo, this);
    }

    const n_signals = GI.object_info_get_n_signals(info);
    for (let i = 0; i < n_signals; i++) {
        const signalInfo = GI.object_info_get_signal(info, i);
        const signalName = name(signalInfo);
        this.signals[signalName] = getInfo(signalInfo, this);
    }

    const n_vfuncs = GI.object_info_get_n_vfuncs(info);
    for (let i = 0; i < n_vfuncs; i++) {
        const vfuncInfo = GI.object_info_get_vfunc(info, i);
        const vfuncName = name(vfuncInfo);
        this.vfuncs[vfuncName] = vfuncInfo;
    }
}

function ArgInfo(info, parent) {
    BaseInfo.call(this, info, parent)
    def(this, '_typeInfo', GI.arg_info_get_type(info));
    def(this, '_tag', tag(this._typeInfo));
    this.tag = tag_string(this._tag);
    this.type = new TypeInfo(this._typeInfo);
    this.name = name(info);
    this.direction = GI.Direction[GI.arg_info_get_direction(info)];
    this.transfer = GI.Transfer[GI.arg_info_get_ownership_transfer(info)];

    const may_be_null = GI.arg_info_may_be_null(info);
    if (may_be_null)
        this.nullable = may_be_null;

    const is_caller_allocates = GI.arg_info_is_caller_allocates(info);
    if (is_caller_allocates)
        this.caller_allocates = true;

    const is_return_value = GI.arg_info_is_return_value(info);
    if (is_return_value)
        this.return_value = true;

    const is_skip = GI.arg_info_is_skip(info);
    if (is_skip)
        this.skip = true;

    const length_pos = GI.type_info_get_array_length(this._typeInfo)
    if (length_pos >= 0)
        this.lengthPos = length_pos

    this.parent = parent
}

function CallableInfo(info, parent) {
    BaseInfo.call(this, info, parent)
    this.n_args = GI.callable_info_get_n_args(info);
    this.args = [];

    for (let i = 0; i < this.n_args; i++) {
        this.args[i] = new ArgInfo(GI.callable_info_get_arg(info, i), this);
    }

    for (let i = 0; i < this.n_args; i++) {
        if (this.args[i].lengthPos !== undefined)
            this.args[this.args[i].lengthPos].isArrayLength = true
    }

    const transfer = GI.callable_info_get_caller_owns(info);
    this.transfer = GI.Transfer[transfer];

    const return_type = GI.callable_info_get_return_type(info);

    this.return_type = new TypeInfo(return_type);
    this.return_tag = tag_string(tag(return_type));

    const mayReturnNull = GI.callable_info_may_return_null(info);
    if (mayReturnNull) this.mayReturnNull = true;

    const skipReturn = GI.callable_info_skip_return(info)
    if (skipReturn) this.skipReturn = true;

    const canThrow = GI.callable_info_can_throw_gerror(info)
    if (canThrow) this.canThrow = true
}

function SignalInfo(info, parent) {
    BaseInfo.call(this, info, parent)
    CallableInfo.call(this, info);
    def(this, '_flags', GI.signal_info_get_flags(info));
}

function VFuncInfo(info, parent) {
    BaseInfo.call(this, info, parent)
    CallableInfo.call(this, info);
    const invoker = GI.vfunc_info_get_invoker(info);
    if (invoker)
        this.invoker = new FunctionInfo(invoker, this);
    const signal = GI.vfunc_info_get_invoker(info);
    if (signal)
        this.signal = new SignalInfo(signal, this);
}

function FunctionInfo(info, parent) {
    BaseInfo.call(this, info, parent)
    CallableInfo.call(this, info);

    if (this.infoType === 'callback')
        return

    this.symbol        = GI.function_info_get_symbol(info)

    def(this, '_flags', GI.function_info_get_flags(info));
    this.isMethod      = this._flags & GI.FunctionInfoFlags.IS_METHOD !== 0
    this.isConstructor = this._flags & GI.FunctionInfoFlags.IS_CONSTRUCTOR !== 0
    this.isGetter      = this._flags & GI.FunctionInfoFlags.IS_GETTER !== 0
    this.isSetter      = this._flags & GI.FunctionInfoFlags.IS_SETTER !== 0
}

function parseNamespace(ns, ver) {
    const module = Object.create(null);
    const repo = GI.Repository_get_default();

    if (!nodegtk._isLoaded(ns, ver))
        GI.Repository_require.call(repo, ns, ver, 0);

    const nInfos = GI.Repository_get_n_infos.call(repo, ns);
    for (let i = 0; i < nInfos; i++) {
        const info = GI.Repository_get_info.call(repo, ns, i);
        const baseinfo = getInfo(info, ns);
        const basename = name(info);
        module[basename] = baseinfo;
    }
    return module;
}

function getInfo (info, parent) {
    switch (getInfoType(info)) {
        case GI.InfoType.INVALID:
            return null;

        case GI.InfoType.CALLBACK:
        case GI.InfoType.FUNCTION:
            return new FunctionInfo(info, parent)

        case GI.InfoType.OBJECT:
            return new ObjectInfo(info, parent)

        case GI.InfoType.ENUM:
        case GI.InfoType.FLAGS:
            return new EnumInfo(info, parent)

        case GI.InfoType.BOXED:
        case GI.InfoType.STRUCT:
            return new StructInfo(info, parent)

        case GI.InfoType.UNION:
            return new UnionInfo(info, parent)

        case GI.InfoType.INTERFACE:
            return new InterfaceInfo(info, parent)

        case GI.InfoType.CONSTANT:
            return new ConstantInfo(info, parent)

        case GI.InfoType.FIELD:
            return new FieldInfo(info, parent)

        case GI.InfoType.PROPERTY:
            return new PropInfo(info, parent)

        case GI.InfoType.ARG:
            return new ArgInfo(info, parent)

        case GI.InfoType.TYPE:
            return new TypeInfo(info)

        case GI.InfoType.VALUE:
            return new ValueInfo(info, parent)

        case GI.InfoType.SIGNAL:
            return new SignalInfo(info, parent)
        case GI.InfoType.VFUNC:
            return new VFuncInfo(info, parent)

        case GI.InfoType.UNRESOLVED:
            return undefined;
    }
    return new BaseInfo(info, parent)
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


function formatName(info) {
    let name = ''
    let current = info
    while (current) {
        name = (current.name || current) + (name ? '.' + name : '')
        current = current.parent
    }

    return name
}

function formatFunction(fn) {
    let parent = formatName(fn.parent)

    return (
        (parent ? chalk.yellow(parent) + chalk.grey('.') : '')
        + chalk.bold(fn.name)
        + chalk.grey(' (')
        + fn.args.map(a =>
            a.name
            + ': '
            + formatType(a.type)
            + (a.direction !== 'IN' ? chalk.magenta(a.direction) : '')
            + (a.transfer !== 'NOTHING' ? chalk.blue(a.transfer.charAt(0)) : '')
        ).join(chalk.grey(', '))
        + chalk.grey('): ')
        + formatType(fn.return_type)
    )
}

function formatType(type) {
    if (type.type === 'array')
        return formatType(type.elementType) + '[]'
    if (type.type === 'glist' || type.type === 'gslist')
        return [
            chalk.yellow('List'),
            chalk.grey('<'),
            formatType(type.elementType),
            chalk.grey('>'),
        ].join('')
    return chalk.yellow(type.type)
}


module.exports = {
    parseNamespace,
    getLibs,
    infos,
    formatName,
    formatFunction,
    formatType,
};
