
#include <node.h>
#include <girepository.h>

namespace GINode {

v8::Handle<v8::Value> GIArgumentToV8(GITypeInfo *type_info, GIArgument *argument);

};
