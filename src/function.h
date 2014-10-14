
#pragma once

#include <node.h>
#include <girepository.h>

namespace GINode {

v8::Handle<v8::Function> MakeFunction(GIBaseInfo *base_info);

};
