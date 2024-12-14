#!/bin/bash

if [ -z "$1" ]; then
    echo "Error: Version number required"
    echo "Usage: $0 <version-number>"
    exit 1
fi

# Get package name from package.json
PACKAGE_NAME=$(node -p "require('./package.json').name")
VERSION="$1"

# Delete specific version from CodeArtifact
aws codeartifact delete-package-versions \
  --package "$PACKAGE_NAME" \
  --format npm \
  --versions "$VERSION" \
  --domain artifacts \
  --repository npm \
  --profile cloud-services-prod
