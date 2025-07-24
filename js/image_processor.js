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
 * We use squared distance to avoid expensive square root operations, as we only need it for comparison.
 * @param {Array<number>} c1 - First color [r, g, b]
 * @param {Array<number>} c2 - Second color [r, g, b]
 * @returns {number} The squared distance.
 */
export function colorDistance(c1, c2) {
    return (c1[0] - c2[0]) ** 2 + (c1[1] - c2[1]) ** 2 + (c1[2] - c2[2]) ** 2;
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

    // Initialize centroids by picking k random pixels from the image
    let centroids = pixels.slice(0, k); // Simple initialization
    if (pixels.length > k) {
      centroids = [...Array(k)].map(() => pixels[Math.floor(Math.random() * pixels.length)]);
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
                // If a centroid has no pixels, re-initialize it to a random pixel
                newCentroids[i] = pixels[Math.floor(Math.random() * pixels.length)];
            }
        }
        centroids = newCentroids;
    }
    return centroids;
}

/**
 * Matches suggested palette colors to available filament colors based on luminance.
 * This ensures the final palette uses colors that are actually available for 3D printing.
 * 
 * @param {Array<string>} suggestedPalette - Array of hex color strings from k-means
 * @param {Array<string>} myFilaments - Array of available filament hex colors
 * @returns {Array<string>} Matched palette using available filament colors
 */
export function matchToPalette(suggestedPalette, myFilaments) {
    if (!myFilaments || myFilaments.length === 0) return suggestedPalette;
    
    // Sort filaments by luminance (brightness) for consistent matching
    const sortedFilaments = [...myFilaments].sort((a, b) => getLuminance(a) - getLuminance(b));
    
    // Create indexed version of suggested palette to preserve original order
    const indexedSuggested = suggestedPalette.map((color, index) => ({ color, originalIndex: index }));
    indexedSuggested.sort((a, b) => getLuminance(a.color) - getLuminance(b.color));
    
    // Match colors by luminance order and restore original order
    const matchedPalette = new Array(suggestedPalette.length);
    indexedSuggested.forEach(({ originalIndex }, i) => {
        const filamentIndex = i % sortedFilaments.length;
        matchedPalette[originalIndex] = sortedFilaments[filamentIndex];
    });
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
  // Use k-means to find dominant colors
  const dominantColors = kMeans(imageData, bands);
  // Convert the [r,g,b] arrays to hex strings
  return dominantColors.map(c => rgbToHex(c[0], c[1], c[2]));
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
        const bottomColor = [imageData[bottomIndex], imageData[bottomIndex + 1], imageData[bottomIndex + 2]];
        const bottomKey = bottomColor.join(',');
        colorCounts.set(bottomKey, (colorCounts.get(bottomKey) || 0) + 1);
    }
    
    // Left and right columns (excluding corners to avoid double counting)
    for (let y = 1; y < height - 1; y++) {
        // Left column
        const leftIndex = (0 + y * width) * 4;
        const leftColor = [imageData[leftIndex], imageData[leftIndex + 1], imageData[leftIndex + 2]];
        const leftKey = leftColor.join(',');
        colorCounts.set(leftKey, (colorCounts.get(leftKey) || 0) + 1);
        
        // Right column
        const rightIndex = ((width - 1) + y * width) * 4;
        const rightColor = [imageData[rightIndex], imageData[rightIndex + 1], imageData[rightIndex + 2]];
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
  const { origCanvas, procCanvas, numBandsInput, paletteDiv, layerSlider, singleLayerToggle } = domElements;
  if (!img) return null;
  
  // Draw the original image to the canvas and get its pixel data
  const context = origCanvas.getContext('2d');
  context.drawImage(img, 0, 0, origCanvas.width, origCanvas.height);
  const imageData = context.getImageData(0, 0, origCanvas.width, origCanvas.height);
  const data = imageData.data;
  
  const currentLayer = parseInt(layerSlider.value, 10);
  const isSingleLayerMode = singleLayerToggle ? singleLayerToggle.checked : false;

  // Convert palette colors from hex to RGB arrays for distance calculation
  const paletteColors = Array.from(paletteDiv.children).map(input => {
      const { r, g, b } = hexToRgb(input.value);
      return [r, g, b];
  });
  if (paletteColors.length === 0) return null; // Exit if palette isn't ready

  // Create band map: each pixel gets assigned to a color band (0 to numBands-1)
  const bandMap = new Float32Array(data.length / 4);
  
  // First pass: Create the band map and find the base color
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const pixelColor = [data[i], data[i + 1], data[i + 2]];
    
    // Find the closest color in the palette for the current pixel using color distance
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

  // Get the base color (index 0 of the palette)
  const baseColor = hexToRgb(paletteDiv.children[0].value);
  
  // Create a new image data for the preview
  const previewImageData = context.createImageData(origCanvas.width, origCanvas.height);
  const previewData = previewImageData.data;
  
  // Fill the entire preview with the base color
  for (let i = 0; i < previewData.length; i += 4) {
    previewData[i] = baseColor.r;     // Red
    previewData[i + 1] = baseColor.g; // Green
    previewData[i + 2] = baseColor.b; // Blue
    previewData[i + 3] = 255;         // Alpha (opaque)
  }
  
  // Now simulate the 3D printing process by drawing layers on top
  if (isSingleLayerMode) {
    // Single Layer Mode: Only show the currently selected layer
    if (currentLayer > 0) { // Don't draw anything for base layer (0)
      for (let i = 0, j = 0; i < previewData.length; i += 4, j++) {
        if (bandMap[j] === currentLayer) {
          const { r, g, b } = hexToRgb(paletteDiv.children[currentLayer].value);
          previewData[i] = r;     // Red
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
          const { r, g, b } = hexToRgb(paletteDiv.children[layer].value);
          previewData[i] = r;     // Red
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