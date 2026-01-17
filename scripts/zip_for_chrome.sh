#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
# Go up one level to the project root directory
PROJECT_ROOT="$SCRIPT_DIR/.."

# Define paths
EXTENSION_DIR="$PROJECT_ROOT/packages/extension"
DIST_DIR="$EXTENSION_DIR/dist"
OUTPUT_ZIP="naca_extension.zip"
OUTPUT_PATH="$PROJECT_ROOT/$OUTPUT_ZIP"

# Build the extension first
echo "Building extension..."
cd "$EXTENSION_DIR" || exit 1
bun run build
if [ $? -ne 0 ]; then
  echo "Error: Extension build failed."
  exit 1
fi
echo "Build complete."

# Change to dist directory for zipping
cd "$DIST_DIR" || exit 1

# Bump version in the built manifest.json (not the source)
MANIFEST="manifest.json"
if [ ! -f "$MANIFEST" ]; then
  echo "Error: $MANIFEST not found in dist directory."
  exit 1
fi

CURRENT_VERSION=$(grep -o '"version": "[^"]*"' "$MANIFEST" | grep -o '[0-9.]*')
# Split version and increment last part
IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
LAST_INDEX=$((${#VERSION_PARTS[@]} - 1))
VERSION_PARTS[$LAST_INDEX]=$((VERSION_PARTS[$LAST_INDEX] + 1))
NEW_VERSION=$(IFS='.'; echo "${VERSION_PARTS[*]}")
# Update dist manifest
sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$MANIFEST"
echo "Bumped dist/manifest.json version: $CURRENT_VERSION → $NEW_VERSION"

# Also update version in packages/extension/package.json to stay in sync with Chrome Web Store
PACKAGE_JSON="$EXTENSION_DIR/package.json"
if [ -f "$PACKAGE_JSON" ]; then
  PKG_CURRENT_VERSION=$(grep -o '"version": "[^"]*"' "$PACKAGE_JSON" | head -1 | grep -o '[0-9.]*')
  sed -i '' "s/\"version\": \"$PKG_CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$PACKAGE_JSON"
  echo "Updated package.json version: $PKG_CURRENT_VERSION → $NEW_VERSION"
fi

# Check if an old zip file exists and remove it
if [ -f "$OUTPUT_PATH" ]; then
  echo "Removing existing $OUTPUT_ZIP..."
  rm "$OUTPUT_PATH"
fi

# Create the zip archive from dist contents
echo "Creating $OUTPUT_ZIP..."
zip -r "$OUTPUT_PATH" . -x "*.DS_Store"

# Check if the zip command was successful
if [ $? -eq 0 ]; then
  echo "Successfully created $OUTPUT_PATH"
else
  echo "Error creating zip file."
  exit 1
fi

exit 0
