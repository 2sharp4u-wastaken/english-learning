#!/usr/bin/env node

// Generate remaining color circle SVGs
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const colorsDir = 'img/icons/colors';

// Colors that need SVGs (from analysis)
const colors = [
    { name: 'maroon', hex: '#800000' },
    { name: 'magenta', hex: '#FF00FF' },
    { name: 'cyan', hex: '#00FFFF' },
    { name: 'scarlet', hex: '#FF2400' },
    { name: 'coral', hex: '#FF7F50' },
    { name: 'amber', hex: '#FFBF00' },
    { name: 'navy-blue', hex: '#000080' },
    { name: 'olive', hex: '#808000' },
    { name: 'khaki', hex: '#C3B091' }
];

const generateSVG = (color, name) => {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <!-- ${name} color circle -->
    <circle cx="256" cy="256" r="220" fill="${color}" />
    <circle cx="256" cy="256" r="220" fill="none" stroke="#000000" stroke-width="8" opacity="0.1"/>
</svg>`;
};

console.log('🎨 Generating color circle SVGs...\n');

// Ensure directory exists
try {
    mkdirSync(colorsDir, { recursive: true });
} catch (e) {
    // Directory exists
}

let created = 0;
for (const { name, hex } of colors) {
    const filename = `${name}-circle.svg`;
    const filepath = join(colorsDir, filename);
    const svg = generateSVG(hex, name);

    try {
        writeFileSync(filepath, svg);
        console.log(`✅ Created: ${filename} (${hex})`);
        created++;
    } catch (error) {
        console.error(`❌ Failed: ${filename}`, error.message);
    }
}

console.log(`\n🎉 Created ${created}/${colors.length} color SVGs!`);
console.log(`📁 Location: ${colorsDir}/\n`);
