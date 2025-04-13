#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
# Go up one level to the project root directory
PROJECT_ROOT="$SCRIPT_DIR/.."

# Define the name of the output zip file
OUTPUT_ZIP="naca_extension.zip"
# Define the path for the output zip file (in the project root)
OUTPUT_PATH="$PROJECT_ROOT/$OUTPUT_ZIP"

# Files and directories to include in the zip
INCLUDE_DIRS=("icons" "js" "popup")
INCLUDE_FILES=("manifest.json")

# Change to the project root directory
cd "$PROJECT_ROOT" || exit 1

# Check if an old zip file exists and remove it
if [ -f "$OUTPUT_ZIP" ]; then
  echo "Removing existing $OUTPUT_ZIP..."
  rm "$OUTPUT_ZIP"
fi

# Create the zip archive
echo "Creating $OUTPUT_ZIP..."
zip -r "$OUTPUT_ZIP" "${INCLUDE_DIRS[@]}" "${INCLUDE_FILES[@]}" -x "*.DS_Store"

# Check if the zip command was successful
if [ $? -eq 0 ]; then
  echo "Successfully created $OUTPUT_PATH"
else
  echo "Error creating zip file."
  exit 1
fi

# Optional: Change back to the original directory if needed
# cd - > /dev/null

exit 0