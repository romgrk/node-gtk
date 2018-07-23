
#pragma once

#define FILE_NAME (strrchr(__FILE__, '/') ? strrchr(__FILE__, '/') + 1 : __FILE__)
#ifdef __PRETTY_FUNCTION__
#define FUNCTION_NAME __PRETTY_FUNCTION__
#else
#define FUNCTION_NAME __func__
#endif

#define assert_printf(condition, ...) \
    do { \
        if (G_UNLIKELY(!(condition))) { \
            printf("\x1b[1;91m%s: %s: %i: Assertion '%s' failed:\x1b[0m ", \
                    FILE_NAME, FUNCTION_NAME, __LINE__, #condition); \
            printf(__VA_ARGS__); \
            g_assert_not_reached (); \
        } \
    } while (0) \

