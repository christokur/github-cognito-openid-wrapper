#!/usr/bin/env bash

# Exit on error
set -e

if [ -f config.rc ]; then
    source config.rc
elif [ -f config.sh ]; then
    source config.sh
else
    echo "ERROR: config.rc or config.sh is required" >&2
    exit 1
fi

npm run start