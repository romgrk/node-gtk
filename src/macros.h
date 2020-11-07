
#pragma once

#if defined(__unix__) || defined(__unix) || (defined(__APPLE__) && defined(__MACH__))
#define OS_UNIX    1
#define OS_WINDOWS 0
#elif defined(_WIN32) || defined(WIN32)
#define OS_UNIX    0
#define OS_WINDOWS 1
#else
#error Couldn't recognize OS
#endif

#define FILE_NAME (strrchr(__FILE__, '/') ? strrchr(__FILE__, '/') + 1 : __FILE__)
#ifdef __PRETTY_FUNCTION__
#define FUNCTION_NAME __PRETTY_FUNCTION__
#else
#define FUNCTION_NAME __func__
#endif

#ifdef NDEBUG
#define DEBUG(...) do {} while(0)
#else
#define DEBUG(...) \
    do { \
        printf("\x1b[1;38;5;226m[DEBUG] "); \
        printf("%s:\x1b[0m\x1b[1m %s: %i: \x1b[0m", FILE_NAME, FUNCTION_NAME, __LINE__); \
        printf(__VA_ARGS__); \
        printf("\n"); \
    } while (0)
#endif

#ifdef NDEBUG
#define LOG(...) do {} while(0)
#else
#define LOG(...) \
    do { \
        printf("\x1b[1;38;5;33m[INFO] "); \
        printf("%s:\x1b[0m\x1b[1m %s: %i: \x1b[0m", FILE_NAME, FUNCTION_NAME, __LINE__); \
        printf(__VA_ARGS__); \
        printf("\n"); \
    } while (0)
#endif

#define WARN(...) \
    do { \
        printf("\x1b[1;38;5;202m[WARN] "); \
        printf("%s:\x1b[0m\x1b[1m %s: %i: \x1b[0m", FILE_NAME, FUNCTION_NAME, __LINE__); \
        printf(__VA_ARGS__); \
        printf("\n"); \
    } while (0)

#define ERROR(...) \
    do { \
        printf("\x1b[91m[ERROR] "); \
        printf("%s:\x1b[0m\x1b[1m %s: %i: \x1b[0m", FILE_NAME, FUNCTION_NAME, __LINE__); \
        printf(__VA_ARGS__); \
        printf("\n"); \
        g_assert_not_reached(); \
    } while (0)


#define assert_printf(condition, ...) \
    do { \
        if (G_UNLIKELY(!(condition))) { \
            printf("\x1b[1;91m%s: %s: %i: Assertion '%s' failed:\x1b[0m ", \
                    FILE_NAME, FUNCTION_NAME, __LINE__, #condition); \
            printf(__VA_ARGS__); \
            g_assert_not_reached (); \
        } \
    } while (0) \


/*
 * V8 Macros
 */

#define UTF8(s)         Nan::New<v8::String> (s).ToLocalChecked()

#define RETURN(s)       info.GetReturnValue().Set(s)

#define TO_OBJECT(v)    Nan::To<Object> (v).ToLocalChecked()
#define TO_STRING(v)    Nan::To<String> (v).ToLocalChecked()
#define TO_LONG(v)      Nan::To<int64_t> (v).ToChecked()


