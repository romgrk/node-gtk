#!/bin/bash

# It'a assumed MSYS2 is installed in C:\msys64

# To use inside "include_dirs" for 'OS == "win"' add:
# "<!(bash win/make_include_extra.sh)",

SRC_DIR=/mingw64/include
DST_DIR=$SRC_DIR/__extra__

mkdir -p $DST_DIR

cp $SRC_DIR/ffi.h       $DST_DIR
cp $SRC_DIR/ffitarget.h $DST_DIR

FC_DIR=$DST_DIR/fontconfig
mkdir -p $FC_DIR
cp $SRC_DIR/fontconfig/fcfreetype.h $FC_DIR
cp $SRC_DIR/fontconfig/fcprivate.h  $FC_DIR
cp $SRC_DIR/fontconfig/fontconfig.h $FC_DIR

echo /msys64/$DST_DIR
