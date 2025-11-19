// Image Rendering Utility
// Handles displaying either real images or emoji fallbacks

/**
 * Renders a picture (image URL or emoji) into a DOM element
 * @param {HTMLElement} element - The element to render into
 * @param {Object} question - Question object with picture/imageUrl
 * @param {string} question.picture - Emoji fallback
 * @param {string} question.imageUrl - Optional image URL
 * @param {string} question.word - Word for alt text
 */
export function renderPicture(element, question) {
    if (!element) return;

    // Clear existing content
    element.innerHTML = '';

    // Check if we have an image URL
    if (question.imageUrl) {
        // Create and display image
        const img = document.createElement('img');
        img.src = question.imageUrl;
        img.alt = question.word || 'Word image';
        img.className = 'word-image';

        // Fallback to emoji if image fails to load
        img.onerror = () => {
            console.warn(`Failed to load image: ${question.imageUrl}, falling back to emoji`);
            element.innerHTML = '';
            element.textContent = question.picture || '🔤';
            element.style.fontSize = ''; // Reset font size
        };

        element.appendChild(img);
        element.style.fontSize = ''; // Reset font size for images
    } else {
        // Use emoji
        element.textContent = question.picture || '🔤';
        // Ensure emoji is visible (restore font size if it was changed)
        if (!element.style.fontSize || element.style.fontSize === '0') {
            element.style.fontSize = '';
        }
    }

    element.style.display = 'block';
}

/**
 * Preload an image to avoid loading delays during gameplay
 * @param {string} imageUrl - URL of image to preload
 */
export function preloadImage(imageUrl) {
    if (!imageUrl) return;

    const img = new Image();
    img.src = imageUrl;
}

/**
 * Preload multiple images
 * @param {Array} questions - Array of question objects
 */
export function preloadImages(questions) {
    if (!questions || !Array.isArray(questions)) return;

    questions.forEach(question => {
        if (question.imageUrl) {
            preloadImage(question.imageUrl);
        }
    });
}

// Make globally accessible for non-module scripts
if (typeof window !== 'undefined') {
    window.renderPicture = renderPicture;
    window.preloadImage = preloadImage;
    window.preloadImages = preloadImages;
}
