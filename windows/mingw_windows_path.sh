#!/bin/bash

# Return where the root (/) is mounted to.

mount | awk '$3 == "/" { print $1 }'
