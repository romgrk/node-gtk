@echo off

REM It'a assumed MSYS2 is installed in C:\msys64

REM To use inside "include_dirs" for 'OS == "win"' add:
REM "<!(%COMSPEC% /c win\\make_include_extra.cmd | tr '\\' '/')",

set SRC_DIR=\msys64\mingw64\include
set DST_DIR=%SRC_DIR%\__extra__

if not exist %DST_DIR% mkdir %DST_DIR%

copy /y %SRC_DIR%\ffi.h       %DST_DIR% >nul
copy /y %SRC_DIR%\ffitarget.h %DST_DIR% >nul

set FC_DIR=%DST_DIR%\fontconfig
if not exist %FC_DIR% mkdir %FC_DIR%
copy /y %SRC_DIR%\fontconfig\fcfreetype.h %FC_DIR% >nul
copy /y %SRC_DIR%\fontconfig\fcprivate.h  %FC_DIR% >nul
copy /y %SRC_DIR%\fontconfig\fontconfig.h %FC_DIR% >nul

echo %DST_DIR%
