#!/bin/bash

# Create a placeholder app icon for testing
# Requires: ImageMagick (brew install imagemagick)

set -e

OUTPUT="scripts/assets/app-icon-source.png"

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "Error: ImageMagick is required but not installed."
    echo "Install with: brew install imagemagick"
    exit 1
fi

mkdir -p scripts/assets

# Create a simple placeholder icon with FuelRx branding
# Dark background (#18181b) with teal accent (#14b8a6)
convert -size 1024x1024 xc:'#18181b' \
    -fill '#14b8a6' \
    -draw "roundrectangle 200,300 824,724 50,50" \
    -fill white \
    -font Helvetica-Bold \
    -pointsize 200 \
    -gravity center \
    -draw "text 0,-50 'FRx'" \
    -fill '#a1a1aa' \
    -pointsize 80 \
    -draw "text 0,150 'FUEL'" \
    "$OUTPUT"

echo "Created placeholder icon: $OUTPUT"
echo ""
echo "To generate all icon sizes, run:"
echo "  ./scripts/generate-app-icons.sh $OUTPUT"
echo ""
echo "For a production app, replace this with your actual app icon design."
