#!/bin/bash
# Example script showing how to update the 8 problematic colors
# You can apply these changes to data/categories/colors.js

cat << 'COLORS'
Update these 8 lines in data/categories/colors.js:

LINE 11: { word: "Pink", translation: "ורוד", category: "colors", image: "🌸", imageUrl: "img/icons/colors/pink-circle.svg" },
LINE 16: { word: "Silver", translation: "כסף", category: "colors", image: "🥈", imageUrl: "img/icons/colors/silver-circle.svg" },
LINE 17: { word: "Gold", translation: "זהב", category: "colors", image: "🥇", imageUrl: "img/icons/colors/gold-circle.svg" },
LINE 18: { word: "Beige", translation: "בֵיז'", category: "colors", image: "🟨", imageUrl: "img/icons/colors/beige-circle.svg" },
LINE 19: { word: "Turquoise", translation: "טורקיז", category: "colors", image: "💠", imageUrl: "img/icons/colors/turquoise-circle.svg" },
LINE 20: { word: "Indigo", translation: "כָּחוֹל סגול", category: "colors", image: "🟦", imageUrl: "img/icons/colors/indigo-circle.svg" },
LINE 21: { word: "Lavender", translation: "לוונדר", category: "colors", image: "💜", imageUrl: "img/icons/colors/lavender-circle.svg" },
LINE 25: { word: "Teal", translation: "צהבהב", category: "colors", image: "💙", imageUrl: "img/icons/colors/teal-circle.svg" },

Simply add , imageUrl: "img/icons/colors/COLORNAME-circle.svg" to the end of each line (before the closing brace).
COLORS
