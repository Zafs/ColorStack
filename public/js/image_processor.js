/**
 * Converts a hex color string to RGB object.
 * @param {string} hex - Hex color string (e.g., "#FF0000")
 * @returns {Object} RGB object with r, g, b properties (0-255)
 */
export function hexToRgb(hex) {
    const v = parseInt(hex.slice(1), 16);
    return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

/**
 * Converts RGB values to hex color string.
 * @param {number} r - Red component (0-255)
 * @param {number} g - Green component (0-255)
 * @param {number} b - Blue component (0-255)
 * @returns {string} Hex color string (e.g., "#FF0000")
 */
function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}

/**
 * Calculates the luminance (brightness) of a hex color using standard luminance formula.
 * @param {string} hex - Hex color string
 * @returns {number} Luminance value (0-255, higher = brighter)
 */
export function getLuminance(hex) {
    const { r, g, b } = hexToRgb(hex);
    return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Calculates the squared Euclidean distance between two colors in RGB space.
 * Simple but effective for color matching.
 * @param {Array<number>} c1 - First color [r, g, b]
 * @param {Array<number>} c2 - Second color [r, g, b]
 * @returns {number} The squared distance.
 */
export function colorDistance(c1, c2) {
    const rDiff = c1[0] - c2[0];
    const gDiff = c1[1] - c2[1];
    const bDiff = c1[2] - c2[2];

    return rDiff * rDiff + gDiff * gDiff + bDiff * bDiff;
}

/**
 * Finds the dominant colors in an image using k-means clustering algorithm.
 *
 * The k-means algorithm works in two main steps that repeat until convergence:
 * 1. Assignment: Each pixel is assigned to the closest centroid (color)
 * 2. Update: Centroids are recalculated as the mean of all assigned pixels
 *
 * @param {Uint8ClampedArray} data - The RGBA image data (4 values per pixel: r,g,b,a)
 * @param {number} k - The number of clusters (colors) to find
 * @returns {Array<Array<number>>} An array of the k dominant colors, each as an [r, g, b] array
 */
function kMeans(data, k) {
    const maxIterations = 20;
    const pixels = [];

    // Downsample for performance: use 1 in every 4 pixels to reduce computation time
    for (let i = 0; i < data.length; i += 16) {
        pixels.push([data[i], data[i + 1], data[i + 2]]);
    }

    // Initialize centroids using k-means++ algorithm for better distribution
    let centroids = [];
    if (pixels.length > k) {
        // Start with a random pixel (but use a deterministic seed)
        const seed = pixels.length + k; // Deterministic seed
        const firstIndex = seed % pixels.length;
        centroids.push([...pixels[firstIndex]]);

        // Use k-means++ to select remaining centroids
        for (let i = 1; i < k; i++) {
            const distances = pixels.map(pixel => {
                let minDistance = Infinity;
                for (const centroid of centroids) {
                    const distance = colorDistance(pixel, centroid);
                    if (distance < minDistance) {
                        minDistance = distance;
                    }
                }
                return minDistance;
            });

            // Select next centroid with probability proportional to distance squared
            const totalDistance = distances.reduce((sum, d) => sum + d, 0);
            let randomValue = (seed * (i + 1)) % totalDistance; // Deterministic but pseudo-random

            for (let j = 0; j < pixels.length; j++) {
                randomValue -= distances[j];
                if (randomValue <= 0) {
                    centroids.push([...pixels[j]]);
                    break;
                }
            }
        }
    } else {
        // If we have fewer pixels than k, use all pixels
        centroids = pixels.slice(0, k);
    }

    // Main k-means iteration loop
    for (let iter = 0; iter < maxIterations; iter++) {
        const assignments = new Array(pixels.length);

        // --- Assignment Step ---
        // Assign each pixel to the closest centroid based on color distance
        for (let i = 0; i < pixels.length; i++) {
            let minDistance = Infinity;
            let closestCentroidIndex = 0;
            for (let j = 0; j < centroids.length; j++) {
                const distance = colorDistance(pixels[i], centroids[j]);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestCentroidIndex = j;
                }
            }
            assignments[i] = closestCentroidIndex;
        }

        // --- Update Step ---
        // Recalculate centroids based on the mean of all pixels assigned to each cluster
        const newCentroids = Array.from({ length: k }, () => [0, 0, 0]);
        const counts = new Array(k).fill(0);

        // Sum up all pixels assigned to each centroid
        for (let i = 0; i < pixels.length; i++) {
            const centroidIndex = assignments[i];
            newCentroids[centroidIndex][0] += pixels[i][0]; // Sum red
            newCentroids[centroidIndex][1] += pixels[i][1]; // Sum green
            newCentroids[centroidIndex][2] += pixels[i][2]; // Sum blue
            counts[centroidIndex]++;
        }

        // Calculate the mean (average) for each centroid
        for (let i = 0; i < centroids.length; i++) {
            if (counts[i] > 0) {
                newCentroids[i][0] /= counts[i]; // Average red
                newCentroids[i][1] /= counts[i]; // Average green
                newCentroids[i][2] /= counts[i]; // Average blue
            } else {
                // If a centroid has no pixels, re-initialize it deterministically
                const fallbackIndex = (i * 7) % pixels.length; // Deterministic but spread out
                newCentroids[i] = [...pixels[fallbackIndex]];
            }
        }
        centroids = newCentroids;
    }
    return centroids;
}

/**
 * Matches suggested palette colors to available filament colors based on color similarity.
 * This ensures the final palette uses colors that are actually available for 3D printing.
 * Uses a greedy algorithm to avoid duplicate filament usage while prioritizing best matches.
 *
 * @param {Array<string>} suggestedPalette - Array of hex color strings from k-means
 * @param {Array<Object>} myFilaments - Array of filament objects with color property
 * @returns {Array<string>} Matched palette using available filament colors
 */
export function matchToPalette(suggestedPalette, myFilaments) {
    if (!myFilaments || myFilaments.length === 0) return suggestedPalette;

    // Extract colors from filament objects for backward compatibility
    const filamentColors = myFilaments.map(filament => filament.color);

    // Convert filament colors to RGB arrays for distance calculation
    const filamentRgb = filamentColors.map(color => {
        const { r, g, b } = hexToRgb(color);
        return [r, g, b];
    });

    // Create all possible matches with their distances
    const allMatches = [];
    suggestedPalette.forEach((suggestedColor, suggestedIndex) => {
        const { r, g, b } = hexToRgb(suggestedColor);
        const suggestedRgb = [r, g, b];

        filamentRgb.forEach((filamentRgb, filamentIndex) => {
            const distance = colorDistance(suggestedRgb, filamentRgb);
            allMatches.push({
                suggestedIndex,
                filamentIndex,
                suggestedColor,
                filamentColor: filamentColors[filamentIndex],
                distance,
            });
        });
    });

    // Sort matches by distance (best matches first)
    allMatches.sort((a, b) => a.distance - b.distance);

    // Use greedy algorithm to assign matches, avoiding duplicates
    const matchedPalette = new Array(suggestedPalette.length);
    const usedFilaments = new Set();
    const usedSuggestions = new Set();

    allMatches.forEach(match => {
        // Skip if we've already matched this suggested color or filament
        if (usedSuggestions.has(match.suggestedIndex) || usedFilaments.has(match.filamentIndex)) {
            return;
        }

        // Assign this match
        matchedPalette[match.suggestedIndex] = match.filamentColor;
        usedSuggestions.add(match.suggestedIndex);
        usedFilaments.add(match.filamentIndex);
    });

    // Fill any remaining unmatched suggestions with the best available filament
    for (let i = 0; i < matchedPalette.length; i++) {
        if (!matchedPalette[i]) {
            // Find the best unused filament
            for (let j = 0; j < filamentColors.length; j++) {
                if (!usedFilaments.has(j)) {
                    matchedPalette[i] = filamentColors[j];
                    usedFilaments.add(j);
                    break;
                }
            }
            // If all filaments are used, use the first one
            if (!matchedPalette[i]) {
                matchedPalette[i] = filamentColors[0];
            }
        }
    }

    return matchedPalette;
}

/**
 * Extracts dominant colors from an image using k-means clustering.
 *
 * @param {Uint8ClampedArray} imageData - Raw RGBA image data
 * @param {number} bands - Number of dominant colors to extract
 * @returns {Array<string>} Array of hex color strings representing dominant colors
 */
export function getSuggestedColors(imageData, bands) {
    // Preprocess the image data to group very similar colors together
    const preprocessedData = preprocessImageData(imageData);

    // Use k-means to find dominant colors
    const dominantColors = kMeans(preprocessedData, bands);
    // Convert the [r,g,b] arrays to hex strings and ensure uniqueness
    const hexColors = dominantColors.map(c => rgbToHex(c[0], c[1], c[2]));
    return ensureUniqueColors(hexColors, imageData);
}

/**
 * Preprocesses image data to group very similar colors together, reducing noise.
 * This helps prevent tiny color variations from being treated as separate colors.
 * @param {Uint8ClampedArray} imageData - Raw RGBA image data
 * @returns {Uint8ClampedArray} Preprocessed image data
 */
function preprocessImageData(imageData) {
    const processedData = new Uint8ClampedArray(imageData.length);

    // Group similar colors by quantizing them to a coarser grid
    const quantizationLevel = 32; // Reduce color precision to group similar colors

    for (let i = 0; i < imageData.length; i += 4) {
        // Quantize RGB values to reduce precision
        const r = Math.round(imageData[i] / quantizationLevel) * quantizationLevel;
        const g = Math.round(imageData[i + 1] / quantizationLevel) * quantizationLevel;
        const b = Math.round(imageData[i + 2] / quantizationLevel) * quantizationLevel;

        processedData[i] = r;
        processedData[i + 1] = g;
        processedData[i + 2] = b;
        processedData[i + 3] = imageData[i + 3]; // Keep alpha unchanged
    }

    return processedData;
}

/**
 * Ensures the suggested palette has unique colors by replacing duplicates with distinct alternatives.
 * @param {Array<string>} colors - Array of hex color strings
 * @param {Uint8ClampedArray} imageData - Raw image data for finding alternative colors
 * @returns {Array<string>} Array of unique hex color strings
 */
function ensureUniqueColors(colors, imageData) {
    const uniqueColors = [];
    const usedColors = new Set();

    for (let i = 0; i < colors.length; i++) {
        const color = colors[i];

        // If this color is already used, find a distinct alternative
        if (usedColors.has(color)) {
            const alternative = findDistinctColor(usedColors, imageData);
            uniqueColors.push(alternative);
            usedColors.add(alternative);
        } else {
            uniqueColors.push(color);
            usedColors.add(color);
        }
    }

    return uniqueColors;
}

/**
 * Finds a distinct color that's not already in the used colors set.
 * @param {Set<string>} usedColors - Set of already used hex colors
 * @param {Uint8ClampedArray} imageData - Raw image data
 * @returns {string} A distinct hex color
 */
function findDistinctColor(usedColors, imageData) {
    // Sample random pixels from the image to find a distinct color
    const maxAttempts = 100;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Pick a random pixel
        const pixelIndex = Math.floor(Math.random() * (imageData.length / 4)) * 4;
        const r = imageData[pixelIndex];
        const g = imageData[pixelIndex + 1];
        const b = imageData[pixelIndex + 2];
        const color = rgbToHex(r, g, b);

        // Check if this color is distinct enough from all used colors
        let isDistinct = true;
        for (const usedColor of usedColors) {
            const { r: ur, g: ug, b: ub } = hexToRgb(usedColor);
            const distance = colorDistance([r, g, b], [ur, ug, ub]);

            // If the distance is too small, this color is too similar
            if (distance < 10000) {
                // Threshold for "similar" colors
                isDistinct = false;
                break;
            }
        }

        if (isDistinct) {
            return color;
        }
    }

    // If we can't find a distinct color, generate a random one
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    return rgbToHex(r, g, b);
}

/**
 * Detects the background color by sampling pixels along the image border.
 * This function analyzes the 1-pixel border around the entire image to find
 * the most frequent color, which is typically the background.
 *
 * @param {Uint8ClampedArray} imageData - Raw RGBA image data
 * @param {number} width - Image width in pixels
 * @param {number} height - Image height in pixels
 * @returns {Array<number>} RGB array [r, g, b] of the detected background color
 */
export function detectBackgroundColor(imageData, width, height) {
    const colorCounts = new Map();

    // Sample pixels along the border (1-pixel width)
    // Top and bottom rows
    for (let x = 0; x < width; x++) {
        // Top row
        const topIndex = (x + 0 * width) * 4;
        const topColor = [imageData[topIndex], imageData[topIndex + 1], imageData[topIndex + 2]];
        const topKey = topColor.join(',');
        colorCounts.set(topKey, (colorCounts.get(topKey) || 0) + 1);

        // Bottom row
        const bottomIndex = (x + (height - 1) * width) * 4;
        const bottomColor = [
            imageData[bottomIndex],
            imageData[bottomIndex + 1],
            imageData[bottomIndex + 2],
        ];
        const bottomKey = bottomColor.join(',');
        colorCounts.set(bottomKey, (colorCounts.get(bottomKey) || 0) + 1);
    }

    // Left and right columns (excluding corners to avoid double counting)
    for (let y = 1; y < height - 1; y++) {
        // Left column
        const leftIndex = (0 + y * width) * 4;
        const leftColor = [
            imageData[leftIndex],
            imageData[leftIndex + 1],
            imageData[leftIndex + 2],
        ];
        const leftKey = leftColor.join(',');
        colorCounts.set(leftKey, (colorCounts.get(leftKey) || 0) + 1);

        // Right column
        const rightIndex = (width - 1 + y * width) * 4;
        const rightColor = [
            imageData[rightIndex],
            imageData[rightIndex + 1],
            imageData[rightIndex + 2],
        ];
        const rightKey = rightColor.join(',');
        colorCounts.set(rightKey, (colorCounts.get(rightKey) || 0) + 1);
    }

    // Find the most frequent color
    let maxCount = 0;
    let mostFrequentColor = [0, 0, 0]; // Default to black

    for (const [colorKey, count] of colorCounts) {
        if (count > maxCount) {
            maxCount = count;
            mostFrequentColor = colorKey.split(',').map(Number);
        }
    }

    return mostFrequentColor;
}

/**
 * Processes an image by quantizing it to the selected color palette and creating a band map.
 * This function converts the image to use only the colors in the palette and creates a height map
 * for 3D printing where each color band represents a different height layer.
 *
 * @param {Object} appState - Application state containing the image
 * @param {Object} domElements - DOM elements for UI controls
 * @returns {Float32Array|null} Band map array where each pixel value indicates which color band it belongs to, or null if processing fails
 */
export function processImage(appState, domElements) {
    const { img } = appState;
    const { origCanvas, procCanvas, numBandsInput, paletteDiv, layerSlider, singleLayerToggle } =
        domElements;
    if (!img) return null;

    // Draw the original image to the canvas and get its pixel data
    const context = origCanvas.getContext('2d');
    context.drawImage(img, 0, 0, origCanvas.width, origCanvas.height);
    const imageData = context.getImageData(0, 0, origCanvas.width, origCanvas.height);
    const data = imageData.data;

    const currentLayer = parseInt(layerSlider.value, 10);
    const isSingleLayerMode = singleLayerToggle ? singleLayerToggle.checked : false;

    // Always use the suggested palette for creating the band map (image structure)
    const suggestedPalette =
        appState.suggestedPalette || Array.from(paletteDiv.children).map(input => input.value);

    // Use the current palette for rendering colors
    const currentPalette = appState.currentPalette || suggestedPalette;

    // Convert suggested palette colors from hex to RGB arrays for distance calculation
    const paletteColors = suggestedPalette.map(color => {
        const { r, g, b } = hexToRgb(color);
        return [r, g, b];
    });
    if (paletteColors.length === 0) return null; // Exit if palette isn't ready

    // Create band map: each pixel gets assigned to a color band (0 to numBands-1)
    const bandMap = new Float32Array(data.length / 4);

    // First pass: Create the band map using the suggested palette (image structure)
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        const pixelColor = [data[i], data[i + 1], data[i + 2]];

        // Find the closest color in the suggested palette for the current pixel using color distance
        let minDistance = Infinity;
        let bandIndex = 0;
        for (let k = 0; k < paletteColors.length; k++) {
            const distance = colorDistance(pixelColor, paletteColors[k]);
            if (distance < minDistance) {
                minDistance = distance;
                bandIndex = k;
            }
        }
        bandMap[j] = bandIndex;
    }

    // Get the base color from the current palette (for rendering)
    const baseColor = hexToRgb(currentPalette[0]);

    // Create a new image data for the preview
    const previewImageData = context.createImageData(origCanvas.width, origCanvas.height);
    const previewData = previewImageData.data;

    // Fill the entire preview with the base color
    for (let i = 0; i < previewData.length; i += 4) {
        previewData[i] = baseColor.r; // Red
        previewData[i + 1] = baseColor.g; // Green
        previewData[i + 2] = baseColor.b; // Blue
        previewData[i + 3] = 255; // Alpha (opaque)
    }

    // Now simulate the 3D printing process by drawing layers on top
    if (isSingleLayerMode) {
        // Single Layer Mode: Only show the currently selected layer
        if (currentLayer > 0) {
            // Don't draw anything for base layer (0)
            for (let i = 0, j = 0; i < previewData.length; i += 4, j++) {
                if (bandMap[j] === currentLayer) {
                    const { r, g, b } = hexToRgb(currentPalette[currentLayer]);
                    previewData[i] = r; // Red
                    previewData[i + 1] = g; // Green
                    previewData[i + 2] = b; // Blue
                    previewData[i + 3] = 255; // Alpha (opaque)
                }
            }
        }
    } else {
        // Cumulative Mode: Draw all layers from 1 up to currentLayer
        for (let layer = 1; layer <= currentLayer; layer++) {
            for (let i = 0, j = 0; i < previewData.length; i += 4, j++) {
                if (bandMap[j] === layer) {
                    const { r, g, b } = hexToRgb(currentPalette[layer]);
                    previewData[i] = r; // Red
                    previewData[i + 1] = g; // Green
                    previewData[i + 2] = b; // Blue
                    previewData[i + 3] = 255; // Alpha (opaque)
                }
            }
        }
    }

    // Update the processed canvas with the new image data
    procCanvas.getContext('2d').putImageData(previewImageData, 0, 0);
    return bandMap;
}
