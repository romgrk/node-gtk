#!/bin/bash

# Return where/ is mounted to.

mount | awk '$3 == "/" { print $1 }'
