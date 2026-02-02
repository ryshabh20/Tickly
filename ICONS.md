# Icon Setup Guide

This extension requires icon files in the `icons/` directory. Here are several ways to create them:

## Option 1: Use Online Icon Generator

1. Visit an icon generator like:
   - [Favicon.io](https://favicon.io/)
   - [RealFaviconGenerator](https://realfavicongenerator.net/)
   - [IconKitchen](https://icon.kitchen/)

2. Create a simple design:
   - Use a tomato emoji (🍅) or Pomodoro-themed icon
   - Use text "P" or "25" for a minimalist look
   - Use a clock or timer icon

3. Download icons in these sizes:
   - 16x16 pixels → `icon16.png`
   - 32x32 pixels → `icon32.png`
   - 48x48 pixels → `icon48.png`
   - 128x128 pixels → `icon128.png`

4. Place all files in the `icons/` directory

## Option 2: Create Icons Manually

### Using Image Editing Software

1. Create a 128x128 pixel image (largest size)
2. Design your icon (tomato, timer, or text-based)
3. Export at all required sizes:
   - 16x16, 32x32, 48x48, 128x128
4. Save as PNG files with appropriate names

### Using Command Line (ImageMagick)

If you have ImageMagick installed:

```bash
# Create a simple colored square with text (example)
convert -size 128x128 xc:#d32f2f -gravity center -pointsize 72 -fill white -annotate +0+0 "🍅" icons/icon128.png
convert icons/icon128.png -resize 48x48 icons/icon48.png
convert icons/icon128.png -resize 32x32 icons/icon32.png
convert icons/icon128.png -resize 16x16 icons/icon16.png
```

## Option 3: Use Placeholder Icons (Testing Only)

For quick testing, you can create simple colored squares:

```bash
# Using ImageMagick to create simple placeholders
convert -size 128x128 xc:#d32f2f icons/icon128.png
convert -size 48x48 xc:#d32f2f icons/icon48.png
convert -size 32x32 xc:#d32f2f icons/icon32.png
convert -size 16x16 xc:#d32f2f icons/icon16.png
```

## Recommended Design

For a professional look, consider:
- **Primary color**: Red (#d32f2f) for work sessions
- **Icon**: Tomato emoji or stylized timer
- **Background**: Transparent or solid color
- **Style**: Simple, recognizable at small sizes

## Icon Requirements

- **Format**: PNG
- **Sizes**: 16, 32, 48, 128 pixels (square)
- **Background**: Transparent recommended
- **File names**: Must match exactly (icon16.png, icon32.png, etc.)

## Quick Test Icons

If you just need to test the extension quickly, you can:

1. Find any PNG image online
2. Resize it to the required dimensions
3. Save with the correct names in the `icons/` folder

The extension will work with any PNG images, though custom-designed icons will look more professional.

