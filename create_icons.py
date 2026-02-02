#!/usr/bin/env python3
"""
Icon Generator for Pomodoro Timer Extension
Creates professional-looking icons at all required sizes
"""

try:
    from PIL import Image, ImageDraw, ImageFont
    import os
    
    # Change to icons directory
    icons_dir = os.path.join(os.path.dirname(__file__), 'icons')
    os.makedirs(icons_dir, exist_ok=True)
    os.chdir(icons_dir)
    
    # Icon sizes
    sizes = [128, 48, 32, 16]
    
    # Colors
    red = (211, 47, 47)  # #d32f2f
    white = (255, 255, 255)
    dark_red = (183, 28, 28)
    
    for size in sizes:
        # Create image with transparency
        img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        
        # Draw rounded rectangle background
        margin = max(2, size // 16)
        corner_radius = max(4, size // 8)
        
        # Draw shadow (darker red)
        shadow_offset = max(1, size // 32)
        draw.rounded_rectangle(
            [margin + shadow_offset, margin + shadow_offset, 
             size - margin + shadow_offset, size - margin + shadow_offset],
            radius=corner_radius,
            fill=dark_red
        )
        
        # Draw main rounded rectangle
        draw.rounded_rectangle(
            [margin, margin, size - margin, size - margin],
            radius=corner_radius,
            fill=red
        )
        
        # Draw "P" text
        try:
            # Try to use a system font
            font_size = int(size * 0.6)
            font = ImageFont.truetype("/usr/share/fonts/TTF/DejaVuSans-Bold.ttf", font_size)
        except:
            try:
                font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
            except:
                # Fallback to default font
                font = ImageFont.load_default()
        
        # Calculate text position (centered)
        bbox = draw.textbbox((0, 0), "P", font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        x = (size - text_width) // 2
        y = (size - text_height) // 2 - bbox[1]
        
        # Draw text
        draw.text((x, y), "P", fill=white, font=font)
        
        # Save icon
        filename = f'icon{size}.png'
        img.save(filename, 'PNG')
        print(f'Created {filename} ({size}x{size})')
    
    print('\nAll icons created successfully!')
    
except ImportError:
    print("PIL/Pillow not available. Using ImageMagick fallback...")
    import subprocess
    import os
    
    icons_dir = os.path.join(os.path.dirname(__file__), 'icons')
    os.makedirs(icons_dir, exist_ok=True)
    os.chdir(icons_dir)
    
    # Create 128px icon
    subprocess.run([
        'convert', '-size', '128x128', 'xc:none',
        '-fill', '#d32f2f',
        '-draw', 'roundrectangle 8,8 120,120 12,12',
        '-fill', 'white',
        '-pointsize', '80',
        '-gravity', 'center',
        '-annotate', '+0+0', 'P',
        'icon128.png'
    ])
    
    # Resize to other sizes
    for size in [48, 32, 16]:
        subprocess.run(['convert', 'icon128.png', '-resize', f'{size}x{size}', f'icon{size}.png'])
    
    print('Icons created using ImageMagick!')

