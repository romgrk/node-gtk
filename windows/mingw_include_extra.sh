#!/bin/bash

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

echo $DST_DIR
