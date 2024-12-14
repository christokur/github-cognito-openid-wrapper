#!/bin/bash

# Get package name from package.json
PACKAGE_NAME=$(node -p "require('./package.json').name")

# List all versions in CodeArtifact
aws codeartifact list-package-versions \
  --package "$PACKAGE_NAME" \
  --format npm \
  --domain artifacts \
  --repository npm \
  --profile cloud-services-prod
