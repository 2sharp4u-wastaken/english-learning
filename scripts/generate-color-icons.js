#!/usr/bin/env node
// Auto-generate color circle SVG icons for the 8 problematic color words

const fs = require('fs');
const path = require('path');

// Color definitions with accurate hex values
const colors = [
    { name: 'pink', hex: '#FFC0CB', label: 'Pink' },
    { name: 'silver', hex: '#C0C0C0', label: 'Silver' },
    { name: 'gold', hex: '#FFD700', label: 'Gold' },
    { name: 'beige', hex: '#F5F5DC', label: 'Beige' },
    { name: 'turquoise', hex: '#40E0D0', label: 'Turquoise' },
    { name: 'indigo', hex: '#4B0082', label: 'Indigo' },
    { name: 'lavender', hex: '#E6E6FA', label: 'Lavender' },
    { name: 'teal', hex: '#008080', label: 'Teal' }
];

// SVG template for a colored circle with border
const generateSVG = (color, name) => {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <!-- ${name} color circle -->
    <circle cx="256" cy="256" r="220" fill="${color}" />
    <circle cx="256" cy="256" r="220" fill="none" stroke="#000000" stroke-width="8" opacity="0.1"/>
</svg>`;
};

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, '../img/icons/colors');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
    console.log('✅ Created directory: img/icons/colors/');
}

// Generate SVG for each color
colors.forEach(color => {
    const svg = generateSVG(color.hex, color.label);
    const filename = `${color.name}-circle.svg`;
    const filepath = path.join(iconsDir, filename);

    fs.writeFileSync(filepath, svg);
    console.log(`✅ Generated: ${filename}`);
});

console.log('\n🎨 All color circle SVGs generated successfully!');
console.log(`📁 Location: ${iconsDir}`);
console.log('\n📝 Next steps:');
console.log('1. Update data/categories/colors.js with imageUrl fields');
console.log('2. Test the colors in the game');
console.log('\nExample update:');
console.log('{ word: "Pink", translation: "ורוד", category: "colors", image: "🌸", imageUrl: "img/icons/colors/pink-circle.svg" }');
