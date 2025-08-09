/**
 * Web Worker for image processing tasks
 * This worker handles all computationally intensive image processing operations
 * to prevent the main UI thread from freezing.
 */

// Import all functions from image_processor.js (without export statements)
// These functions will be local to the worker's scope

/**
 * Converts a hex color string to RGB object.
 * @param {string} hex - Hex color string (e.g., "#FF0000")
 * @returns {Object} RGB object with r, g, b properties (0-255)
 */
function hexToRgb(hex) {
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
function getLuminance(hex) {
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
function colorDistance(c1, c2) {
    const rDiff = c1[0] - c2[0];
    const gDiff = c1[1] - c2[1];
    const bDiff = c1[2] - c2[2];

    return rDiff * rDiff + gDiff * gDiff + bDiff * bDiff;
}

/**
 * Calculates the saturation of a color in RGB space.
 * @param {number} r - Red component (0-255)
 * @param {number} g - Green component (0-255)
 * @param {number} b - Blue component (0-255)
 * @returns {number} Saturation value (0-1, where 1 is most saturated)
 */
function getSaturation(r, g, b) {
    // Normalize RGB values to 0-1 range
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;
    
    const max = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    
    // If max is 0, the color is black and has no saturation
    if (max === 0) return 0;
    
    // Saturation = (max - min) / max
    return (max - min) / max;
}

/**
 * Converts RGB color values to CIE XYZ color space.
 * @param {number} r - Red component (0-255)
 * @param {number} g - Green component (0-255)
 * @param {number} b - Blue component (0-255)
 * @returns {Object} XYZ color values {x, y, z}
 */
function rgbToXyz(r, g, b) {
    // Normalize RGB values to 0-1 range
    let rNorm = r / 255;
    let gNorm = g / 255;
    let bNorm = b / 255;
    
    // Apply gamma correction (sRGB to linear RGB)
    rNorm = rNorm > 0.04045 ? Math.pow((rNorm + 0.055) / 1.055, 2.4) : rNorm / 12.92;
    gNorm = gNorm > 0.04045 ? Math.pow((gNorm + 0.055) / 1.055, 2.4) : gNorm / 12.92;
    bNorm = bNorm > 0.04045 ? Math.pow((bNorm + 0.055) / 1.055, 2.4) : bNorm / 12.92;
    
    // Apply sRGB to XYZ transformation matrix (D65 illuminant)
    const x = rNorm * 0.4124564 + gNorm * 0.3575761 + bNorm * 0.1804375;
    const y = rNorm * 0.2126729 + gNorm * 0.7151522 + bNorm * 0.0721750;
    const z = rNorm * 0.0193339 + gNorm * 0.1191920 + bNorm * 0.9503041;
    
    return { x, y, z };
}

/**
 * Converts CIE XYZ color values to CIELAB color space.
 * @param {number} x - X component
 * @param {number} y - Y component  
 * @param {number} z - Z component
 * @returns {Object} LAB color values {l, a, b}
 */
function xyzToLab(x, y, z) {
    // Reference white point (D65 illuminant)
    const xn = 0.95047;
    const yn = 1.00000;
    const zn = 1.08883;
    
    // Normalize by reference white
    const xr = x / xn;
    const yr = y / yn;
    const zr = z / zn;
    
    // Apply the CIELAB transformation function
    const fx = xr > 0.008856 ? Math.pow(xr, 1/3) : (7.787 * xr + 16/116);
    const fy = yr > 0.008856 ? Math.pow(yr, 1/3) : (7.787 * yr + 16/116);
    const fz = zr > 0.008856 ? Math.pow(zr, 1/3) : (7.787 * zr + 16/116);
    
    // Calculate LAB values
    const l = 116 * fy - 16;
    const a = 500 * (fx - fy);
    const b = 200 * (fy - fz);
    
    return { l, a, b };
}

/**
 * Converts RGB color directly to CIELAB color space.
 * @param {number} r - Red component (0-255)
 * @param {number} g - Green component (0-255)
 * @param {number} b - Blue component (0-255)
 * @returns {Object} LAB color values {l, a, b}
 */
function rgbToLab(r, g, b) {
    const xyz = rgbToXyz(r, g, b);
    return xyzToLab(xyz.x, xyz.y, xyz.z);
}

/**
 * Calculates the Delta E (CIE76) distance between two colors in CIELAB space.
 * This represents the perceptual difference between colors.
 * @param {Object} lab1 - First color in LAB space {l, a, b}
 * @param {Object} lab2 - Second color in LAB space {l, a, b}
 * @returns {number} Delta E distance (higher = more perceptually different)
 */
function calculateDeltaE(lab1, lab2) {
    const deltaL = lab1.l - lab2.l;
    const deltaA = lab1.a - lab2.a;
    const deltaB = lab1.b - lab2.b;
    
    return Math.sqrt(deltaL * deltaL + deltaA * deltaA + deltaB * deltaB);
}

/**
 * Performs Sobel edge detection on image data to identify edges.
 * @param {Uint8ClampedArray} imageData - Raw RGBA image data
 * @param {number} width - Image width in pixels
 * @param {number} height - Image height in pixels
 * @returns {Float32Array} Array of edge intensity values (0-1) for each pixel
 */
function sobelEdgeDetection(imageData, width, height) {
    // Convert to grayscale first for edge detection
    const gray = new Float32Array(width * height);
    for (let i = 0; i < imageData.length; i += 4) {
        const pixelIndex = i / 4;
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        // Convert to grayscale using luminance formula
        gray[pixelIndex] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    }
    
    const edges = new Float32Array(width * height);
    
    // Sobel kernels
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    
    // Apply Sobel operator (skip border pixels to avoid boundary checks)
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let gx = 0;
            let gy = 0;
            
            // Apply 3x3 convolution
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const pixelIndex = (y + ky) * width + (x + kx);
                    const kernelIndex = (ky + 1) * 3 + (kx + 1);
                    const pixelValue = gray[pixelIndex];
                    
                    gx += pixelValue * sobelX[kernelIndex];
                    gy += pixelValue * sobelY[kernelIndex];
                }
            }
            
            // Calculate gradient magnitude and normalize to 0-1 range
            const magnitude = Math.sqrt(gx * gx + gy * gy);
            edges[y * width + x] = Math.min(magnitude / 4, 1); // Divide by 4 to normalize
        }
    }
    
    return edges;
}

/**
 * Finds the most perceptually distinct colors using the Subject-Aware Maximal Color Distinction algorithm.
 * This hybrid algorithm combines visual impact scoring, center-biased saliency, and CIELAB perceptual 
 * distance optimization to prioritize important subject colors over background colors.
 *
 * The Subject-Aware Maximal Color Distinction algorithm works by:
 * 1. Calculate center-biased saliency weights to prioritize central subjects
 * 2. Generate a large pool of impactful candidate colors with enhanced scoring (4x oversampling)
 * 3. Convert all candidates to CIELAB color space for perceptual accuracy
 * 4. Use Farthest Point Selection to choose the most distinct colors
 * 5. Return a palette where each color is maximally different from all others
 *
 * @param {Uint8ClampedArray} data - The RGBA image data (4 values per pixel: r,g,b,a)
 * @param {number} width - Image width in pixels
 * @param {number} height - Image height in pixels
 * @param {number} numColors - The number of colors to extract
 * @returns {Array<Array<number>>} An array of the most distinct colors, each as an [r, g, b] array
 */
function getImpactfulColors(data, width, height, numColors) {
    // Step 1: Oversample - generate a large pool of candidate colors
    const candidateCount = Math.min(numColors * 4, 64); // Generate 4x candidates, max 64
    
    // Use existing impact-based algorithm to get candidate colors
    const edgeData = sobelEdgeDetection(data, width, height);
    const colorHistogram = new Map();
    
    // Calculate center coordinates and maximum distance for saliency weighting
    const centerX = width / 2;
    const centerY = height / 2;
    const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY); // Distance to corner
    
    // Sample pixels - use every 4th pixel for performance while maintaining quality
    for (let i = 0; i < data.length; i += 16) {
        const pixelIndex = i / 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const colorKey = `${r},${g},${b}`;
        
        // Calculate pixel coordinates from pixel index
        const x = pixelIndex % width;
        const y = Math.floor(pixelIndex / width);
        
        // Calculate center-biased saliency weight
        const distanceFromCenter = Math.sqrt(
            (x - centerX) * (x - centerX) + (y - centerY) * (y - centerY)
        );
        const saliencyWeight = 1.0 - (distanceFromCenter / maxDistance);
        
        // Calculate enhanced impact score with saliency weighting
        const saturation = getSaturation(r, g, b);
        const edginess = edgeData[pixelIndex] || 0;
        const finalImpactScore = (1 + saturation * 2) * (1 + edginess * 3) * (1 + saliencyWeight * 1.5);
        
        // Add to histogram
        if (colorHistogram.has(colorKey)) {
            colorHistogram.get(colorKey).impactScore += finalImpactScore;
            colorHistogram.get(colorKey).pixelCount += 1;
        } else {
            colorHistogram.set(colorKey, { impactScore: finalImpactScore, pixelCount: 1 });
        }
    }
    
    // Convert histogram to array and sort by impact score (highest first)
    const allColors = [];
    for (const [colorKey, data] of colorHistogram) {
        const [r, g, b] = colorKey.split(',').map(Number);
        allColors.push({ 
            r, 
            g, 
            b, 
            impactScore: data.impactScore,
            pixelCount: data.pixelCount
        });
    }
    
    // Sort by impact score (highest first) and take top candidates
    allColors.sort((a, b) => b.impactScore - a.impactScore);
    const candidates = allColors.slice(0, candidateCount);
    
    // If we have fewer candidates than requested colors, return what we have
    if (candidates.length <= numColors) {
        return candidates.map(c => [c.r, c.g, c.b]);
    }
    
    // Step 2: Convert all candidates to CIELAB color space
    const candidatesLab = candidates.map(c => ({
        ...c,
        lab: rgbToLab(c.r, c.g, c.b)
    }));
    
    // Step 3: Implement Farthest Point Selection
    const finalPalette = [];
    const remainingCandidates = [...candidatesLab];
    
    // Step 3a: Start with the most impactful color (first in sorted list)
    finalPalette.push(remainingCandidates.shift());
    
    // Step 3b: Iteratively select the most distinct remaining colors
    while (finalPalette.length < numColors && remainingCandidates.length > 0) {
        let maxMinDistance = -1;
        let bestCandidateIndex = 0;
        
        // Step 3b.i: For each remaining candidate, find its minimum distance to current palette
        for (let i = 0; i < remainingCandidates.length; i++) {
            const candidate = remainingCandidates[i];
            let minDistanceToCurrentPalette = Infinity;
            
            // Find the minimum distance from this candidate to any color in current palette
            for (const paletteColor of finalPalette) {
                const distance = calculateDeltaE(candidate.lab, paletteColor.lab);
                if (distance < minDistanceToCurrentPalette) {
                    minDistanceToCurrentPalette = distance;
                }
            }
            
            // Step 3b.ii: Track the candidate with the largest minimum distance
            if (minDistanceToCurrentPalette > maxMinDistance) {
                maxMinDistance = minDistanceToCurrentPalette;
                bestCandidateIndex = i;
            }
        }
        
        // Add the most distinct candidate to final palette and remove from candidates
        finalPalette.push(remainingCandidates.splice(bestCandidateIndex, 1)[0]);
    }
    
    // Step 4: Return the final palette in RGB format
    const finalPaletteRGB = finalPalette.map(c => [c.r, c.g, c.b]);
    
    // Step 5: Intelligent base layer ordering
    // Detect the true background color of the image
    const backgroundColor = detectBackgroundColor(data, width, height);
    
    // Find the color in the final palette that is closest to the background color
    let closestColorIndex = 0;
    let minDistance = Infinity;
    
    for (let i = 0; i < finalPaletteRGB.length; i++) {
        const paletteColor = finalPaletteRGB[i];
        const distance = calculateDeltaE(
            rgbToLab(paletteColor[0], paletteColor[1], paletteColor[2]),
            rgbToLab(backgroundColor[0], backgroundColor[1], backgroundColor[2])
        );
        
        if (distance < minDistance) {
            minDistance = distance;
            closestColorIndex = i;
        }
    }
    
    // Move the closest-matching color to the first position (index 0)
    if (closestColorIndex > 0) {
        const closestColor = finalPaletteRGB[closestColorIndex];
        finalPaletteRGB.splice(closestColorIndex, 1);
        finalPaletteRGB.unshift(closestColor);
    }
    
    // Step 6: Thin Feature sorting pass
    // Create a temporary bandMap using the final palette to analyze color usage
    const tempBandMap = new Float32Array(data.length / 4);
    
    // Create temporary bandMap by assigning each pixel to the closest color in finalPaletteRGB
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        const pixelColor = [data[i], data[i + 1], data[i + 2]];
        
        // Find the closest color in the final palette
        let minDistance = Infinity;
        let bandIndex = 0;
        for (let k = 0; k < finalPaletteRGB.length; k++) {
            const distance = colorDistance(pixelColor, finalPaletteRGB[k]);
            if (distance < minDistance) {
                minDistance = distance;
                bandIndex = k;
            }
        }
        tempBandMap[j] = bandIndex;
    }
    
    // Step A: Analyze color usage to get pixel counts
    const colorUsage = analyzeColorUsage(tempBandMap, width, height);
    
    // Step B: Separate base layer (index 0) from detail colors
    const baseLayer = finalPaletteRGB[0];
    const detailColors = finalPaletteRGB.slice(1);
    
    // Step C: Sort detail colors by pixel count (fewest to most)
    detailColors.sort((a, b) => {
        const aIndex = finalPaletteRGB.indexOf(a);
        const bIndex = finalPaletteRGB.indexOf(b);
        const aCount = colorUsage[aIndex] || 0;
        const bCount = colorUsage[bIndex] || 0;
        return aCount - bCount; // Fewest pixels first (thin features)
    });
    
    // Step D: Concatenate base layer with sorted detail colors
    finalPaletteRGB.length = 0; // Clear array
    finalPaletteRGB.push(baseLayer, ...detailColors);
    
    return finalPaletteRGB;
}

/**
 * Analyzes the usage of each color in the bandMap to determine pixel counts.
 * This helps identify which colors are used for thin features vs. large areas.
 * 
 * @param {Float32Array} bandMap - Array where each element represents which color band a pixel belongs to
 * @param {number} width - Width of the image
 * @param {number} height - Height of the image
 * @returns {Object} Object mapping color indices to their pixel counts
 */
function analyzeColorUsage(bandMap, width, height) {
    const colorUsage = {};
    
    // Iterate through the bandMap to count pixels for each color
    for (let i = 0; i < bandMap.length; i++) {
        const colorIndex = Math.floor(bandMap[i]);
        colorUsage[colorIndex] = (colorUsage[colorIndex] || 0) + 1;
    }
    
    return colorUsage;
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
function matchToPalette(suggestedPalette, myFilaments) {
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
 * Extracts dominant colors from an image using Impactful Color algorithm.
 *
 * @param {Uint8ClampedArray} imageData - Raw RGBA image data
 * @param {number} bands - Number of dominant colors to extract
 * @param {number} width - Image width in pixels
 * @param {number} height - Image height in pixels
 * @returns {Array<string>} Array of hex color strings representing dominant colors
 */
function getSuggestedColors(imageData, bands, width, height) {
    // Preprocess the image data to group very similar colors together
    const preprocessedData = preprocessImageData(imageData);

    // Use Impactful Color algorithm to find visually important colors
    const dominantColors = getImpactfulColors(preprocessedData, width, height, bands);
    // Convert the [r,g,b] arrays to hex strings and ensure uniqueness
    const hexColors = dominantColors.map(c => rgbToHex(c[0], c[1], c[2]));
    return ensureUniqueColors(hexColors, imageData);
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
function detectBackgroundColor(imageData, width, height) {
    // Step 1: Check the four corner pixels first
    const cornerColors = [];
    
    // Top-left corner
    const topLeftIndex = (0 + 0 * width) * 4;
    cornerColors.push([
        imageData[topLeftIndex],
        imageData[topLeftIndex + 1],
        imageData[topLeftIndex + 2]
    ]);
    
    // Top-right corner
    const topRightIndex = (width - 1 + 0 * width) * 4;
    cornerColors.push([
        imageData[topRightIndex],
        imageData[topRightIndex + 1],
        imageData[topRightIndex + 2]
    ]);
    
    // Bottom-left corner
    const bottomLeftIndex = (0 + (height - 1) * width) * 4;
    cornerColors.push([
        imageData[bottomLeftIndex],
        imageData[bottomLeftIndex + 1],
        imageData[bottomLeftIndex + 2]
    ]);
    
    // Bottom-right corner
    const bottomRightIndex = (width - 1 + (height - 1) * width) * 4;
    cornerColors.push([
        imageData[bottomRightIndex],
        imageData[bottomRightIndex + 1],
        imageData[bottomRightIndex + 2]
    ]);
    
    // Step 2: Check if corner colors are similar (within threshold)
    const colorDistanceThreshold = 1000; // Threshold for RGB squared distance
    let cornersAreSimilar = true;
    
    // Convert corner colors to CIELAB for more accurate comparison
    const cornerColorsLab = cornerColors.map(color => rgbToLab(color[0], color[1], color[2]));
    
    // Check if all corners are within threshold of each other
    for (let i = 0; i < cornerColorsLab.length; i++) {
        for (let j = i + 1; j < cornerColorsLab.length; j++) {
            const distance = calculateDeltaE(cornerColorsLab[i], cornerColorsLab[j]);
            if (distance > 15) { // CIELAB threshold (15 is a reasonable perceptual difference)
                cornersAreSimilar = false;
                break;
            }
        }
        if (!cornersAreSimilar) break;
    }
    
    // Step 3: If corners are similar, return their average color
    if (cornersAreSimilar) {
        const avgR = Math.round(cornerColors.reduce((sum, color) => sum + color[0], 0) / 4);
        const avgG = Math.round(cornerColors.reduce((sum, color) => sum + color[1], 0) / 4);
        const avgB = Math.round(cornerColors.reduce((sum, color) => sum + color[2], 0) / 4);
        return [avgR, avgG, avgB];
    }
    
    // Step 4: Fall back to existing border sampling logic
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
 * @returns {Object} Object containing bandMap and previewImageData
 */
function processImage(appState, domElements) {
    const { suggestedPalette, currentPalette } = appState;
    const { layerSlider, singleLayerToggle } = domElements;

    // Always use the suggested palette for creating the band map (image structure)
    const palette = suggestedPalette || [];

    // Use the current palette for rendering colors
    const renderPalette = currentPalette || suggestedPalette;

    // Convert suggested palette colors from hex to RGB arrays for distance calculation
    const paletteColors = palette.map(color => {
        const { r, g, b } = hexToRgb(color);
        return [r, g, b];
    });
    if (paletteColors.length === 0) return null; // Exit if palette isn't ready

    // Create band map: each pixel gets assigned to a color band (0 to numBands-1)
    const bandMap = new Float32Array(appState.imageData.length / 4);

    // First pass: Create the band map using the suggested palette (image structure)
    for (let i = 0, j = 0; i < appState.imageData.length; i += 4, j++) {
        const pixelColor = [
            appState.imageData[i],
            appState.imageData[i + 1],
            appState.imageData[i + 2],
        ];

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

    // Despeckle filter: Clean up noisy pixel assignments in the bandMap
    const cleanedBandMap = new Float32Array(bandMap.length);
    const width = appState.width;
    const height = appState.height;
    
    // Copy the original bandMap to cleanedBandMap
    for (let i = 0; i < bandMap.length; i++) {
        cleanedBandMap[i] = bandMap[i];
    }
    
    // Apply despeckle filter (skip 1-pixel border)
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const pixelIndex = y * width + x;
            const neighborhood = [];
            
            // Collect 3x3 neighborhood (8 neighbors + center) from original bandMap
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const neighborIndex = (y + dy) * width + (x + dx);
                    neighborhood.push(bandMap[neighborIndex]);
                }
            }
            
            // Count occurrences of each bandIndex in the neighborhood
            const bandCounts = new Map();
            for (const bandIndex of neighborhood) {
                bandCounts.set(bandIndex, (bandCounts.get(bandIndex) || 0) + 1);
            }
            
            // Find the most frequent bandIndex (majority)
            let majorityBandIndex = bandMap[pixelIndex]; // Default to current pixel
            let maxCount = 0;
            
            for (const [bandIndex, count] of bandCounts) {
                if (count > maxCount) {
                    maxCount = count;
                    majorityBandIndex = bandIndex;
                }
            }
            
            // Set the central pixel to the majority bandIndex
            cleanedBandMap[pixelIndex] = majorityBandIndex;
        }
    }
    
    // Replace the original bandMap with the cleaned version
    for (let i = 0; i < bandMap.length; i++) {
        bandMap[i] = cleanedBandMap[i];
    }

    // Get the base color from the current palette (for rendering)
    const baseColor = hexToRgb(renderPalette[0]);

    // Create a new image data for the preview
    // Note: ImageData constructor is not available in Web Workers, so we create the data array manually
    const previewData = new Uint8ClampedArray(appState.width * appState.height * 4);

    // Fill the entire preview with the base color
    for (let i = 0; i < previewData.length; i += 4) {
        previewData[i] = baseColor.r; // Red
        previewData[i + 1] = baseColor.g; // Green
        previewData[i + 2] = baseColor.b; // Blue
        previewData[i + 3] = 255; // Alpha (opaque)
    }

    const currentLayer = parseInt(layerSlider.value, 10);
    const isSingleLayerMode = singleLayerToggle ? singleLayerToggle.checked : false;

    // Now simulate the 3D printing process by drawing layers on top
    if (isSingleLayerMode) {
        // Single Layer Mode: Only show the currently selected layer
        if (currentLayer > 0) {
            // Don't draw anything for base layer (0)
            for (let i = 0, j = 0; i < previewData.length; i += 4, j++) {
                if (bandMap[j] === currentLayer) {
                    const { r, g, b } = hexToRgb(renderPalette[currentLayer]);
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
                    const { r, g, b } = hexToRgb(renderPalette[layer]);
                    previewData[i] = r; // Red
                    previewData[i + 1] = g; // Green
                    previewData[i + 2] = b; // Blue
                    previewData[i + 3] = 255; // Alpha (opaque)
                }
            }
        }
    }

    return {
        bandMap: bandMap,
        previewImageData: {
            data: previewData,
            width: appState.width,
            height: appState.height,
        },
    };
}

// Set up message listener for the worker
self.onmessage = function (e) {
    const { type, data } = e.data;

    try {
        if (type === 'init') {
            // Worker ready handshake
            self.postMessage({
                type: 'worker_ready',
            });
            return;
        }

        if (type === 'generate_palette') {
            const { imageData, numBands, width, height } = data;

            // Generate suggested palette
            const suggestedPalette = getSuggestedColors(imageData, numBands, width, height);

            // Detect background color
            const backgroundColor = detectBackgroundColor(imageData, width, height);

            // Post results back to main thread
            self.postMessage({
                type: 'palette_generated',
                data: {
                    suggestedPalette: suggestedPalette,
                    backgroundColor: backgroundColor,
                },
            });
        } else if (type === 'process_image') {
            const { appState, domElements } = data;

            // Process the image
            const result = processImage(appState, domElements);

            if (result) {
                // Post results back to main thread
                self.postMessage({
                    type: 'image_processed',
                    data: {
                        bandMap: result.bandMap,
                        previewImageData: result.previewImageData,
                    },
                });
            } else {
                // Post error back to main thread
                self.postMessage({
                    type: 'error',
                    data: {
                        message: 'Failed to process image',
                    },
                });
            }
        } else {
            // Unknown message type
            self.postMessage({
                type: 'error',
                data: {
                    message: 'Unknown message type: ' + type,
                },
            });
        }
    } catch (error) {
        // Post error back to main thread
        self.postMessage({
            type: 'error',
            data: {
                message: 'Worker error: ' + error.message,
            },
        });
    }
};
