#!/bin/bash

# Generate iOS app icons from a source image
# Requires: ImageMagick (brew install imagemagick)
#
# Usage: ./scripts/generate-app-icons.sh <source-image.png>
#
# The source image should be at least 1024x1024 pixels, square, with no transparency

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <source-image.png>"
    echo ""
    echo "The source image should be:"
    echo "  - At least 1024x1024 pixels"
    echo "  - Square (1:1 aspect ratio)"
    echo "  - PNG format"
    echo "  - No transparency (iOS fills transparent areas with black)"
    echo ""
    echo "Example: $0 ./scripts/assets/app-icon-source.png"
    exit 1
fi

SOURCE_IMAGE="$1"
OUTPUT_DIR="ios/App/App/Assets.xcassets/AppIcon.appiconset"

if [ ! -f "$SOURCE_IMAGE" ]; then
    echo "Error: Source image not found: $SOURCE_IMAGE"
    exit 1
fi

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "Error: ImageMagick is required but not installed."
    echo "Install with: brew install imagemagick"
    exit 1
fi

echo "Generating iOS app icons from: $SOURCE_IMAGE"
echo "Output directory: $OUTPUT_DIR"

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# iOS App Icon sizes (as per Apple Human Interface Guidelines)
# Format: size filename
declare -a SIZES=(
    "20 icon-20.png"
    "40 icon-20@2x.png"
    "60 icon-20@3x.png"
    "29 icon-29.png"
    "58 icon-29@2x.png"
    "87 icon-29@3x.png"
    "40 icon-40.png"
    "80 icon-40@2x.png"
    "120 icon-40@3x.png"
    "120 icon-60@2x.png"
    "180 icon-60@3x.png"
    "76 icon-76.png"
    "152 icon-76@2x.png"
    "167 icon-83.5@2x.png"
    "1024 icon-1024.png"
)

for entry in "${SIZES[@]}"; do
    size=$(echo "$entry" | cut -d' ' -f1)
    filename=$(echo "$entry" | cut -d' ' -f2)
    echo "  Generating ${filename} (${size}x${size})"
    convert "$SOURCE_IMAGE" -resize "${size}x${size}" "$OUTPUT_DIR/$filename"
done

# Generate Contents.json for the icon set
cat > "$OUTPUT_DIR/Contents.json" << 'EOF'
{
  "images" : [
    {
      "filename" : "icon-20@2x.png",
      "idiom" : "iphone",
      "scale" : "2x",
      "size" : "20x20"
    },
    {
      "filename" : "icon-20@3x.png",
      "idiom" : "iphone",
      "scale" : "3x",
      "size" : "20x20"
    },
    {
      "filename" : "icon-29@2x.png",
      "idiom" : "iphone",
      "scale" : "2x",
      "size" : "29x29"
    },
    {
      "filename" : "icon-29@3x.png",
      "idiom" : "iphone",
      "scale" : "3x",
      "size" : "29x29"
    },
    {
      "filename" : "icon-40@2x.png",
      "idiom" : "iphone",
      "scale" : "2x",
      "size" : "40x40"
    },
    {
      "filename" : "icon-40@3x.png",
      "idiom" : "iphone",
      "scale" : "3x",
      "size" : "40x40"
    },
    {
      "filename" : "icon-60@2x.png",
      "idiom" : "iphone",
      "scale" : "2x",
      "size" : "60x60"
    },
    {
      "filename" : "icon-60@3x.png",
      "idiom" : "iphone",
      "scale" : "3x",
      "size" : "60x60"
    },
    {
      "filename" : "icon-20.png",
      "idiom" : "ipad",
      "scale" : "1x",
      "size" : "20x20"
    },
    {
      "filename" : "icon-20@2x.png",
      "idiom" : "ipad",
      "scale" : "2x",
      "size" : "20x20"
    },
    {
      "filename" : "icon-29.png",
      "idiom" : "ipad",
      "scale" : "1x",
      "size" : "29x29"
    },
    {
      "filename" : "icon-29@2x.png",
      "idiom" : "ipad",
      "scale" : "2x",
      "size" : "29x29"
    },
    {
      "filename" : "icon-40.png",
      "idiom" : "ipad",
      "scale" : "1x",
      "size" : "40x40"
    },
    {
      "filename" : "icon-40@2x.png",
      "idiom" : "ipad",
      "scale" : "2x",
      "size" : "40x40"
    },
    {
      "filename" : "icon-76.png",
      "idiom" : "ipad",
      "scale" : "1x",
      "size" : "76x76"
    },
    {
      "filename" : "icon-76@2x.png",
      "idiom" : "ipad",
      "scale" : "2x",
      "size" : "76x76"
    },
    {
      "filename" : "icon-83.5@2x.png",
      "idiom" : "ipad",
      "scale" : "2x",
      "size" : "83.5x83.5"
    },
    {
      "filename" : "icon-1024.png",
      "idiom" : "ios-marketing",
      "scale" : "1x",
      "size" : "1024x1024"
    }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
EOF

echo ""
echo "App icons generated successfully!"
echo ""
echo "Next steps:"
echo "  1. Open Xcode: npm run cap:open:ios"
echo "  2. Verify icons appear in Assets.xcassets > AppIcon"
echo "  3. Build and run to see the new icon"
