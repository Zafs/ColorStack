// Main application logic with enhanced compatibility
(function () {
    'use strict';

    let domElements;
    let appState;
    let imageWorker; // Web Worker for image processing

    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================

    /**
     * Loads an external script dynamically and returns a Promise.
     * @param {string} url - The URL of the script to load
     * @returns {Promise} Promise that resolves when script loads, rejects on error
     */
    function loadExternalScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
            document.head.appendChild(script);
        });
    }

    /**
     * Debounce utility function to prevent excessive function calls.
     * @param {Function} func - The function to debounce
     * @param {number} delay - The delay in milliseconds
     * @returns {Function} The debounced function
     */
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }

    // ============================================================================
    // IMAGE PROCESSOR FUNCTIONS (from image_processor.js)
    // ============================================================================

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
            const finalImpactScore = (1 + saturation * 2) * (1 + edginess) * (1 + saliencyWeight * 1.5);
            
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
     * @param {Array<string>} myFilaments - Array of available filament hex colors
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
            if (
                usedSuggestions.has(match.suggestedIndex) ||
                usedFilaments.has(match.filamentIndex)
            ) {
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
            const topColor = [
                imageData[topIndex],
                imageData[topIndex + 1],
                imageData[topIndex + 2],
            ];
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
     * Processes an image by quantizing it to the selected color palette and creating a band map.
     * This function converts the image to use only the colors in the palette and creates a height map
     * for 3D printing where each color band represents a different height layer.
     *
     * @param {Object} appState - Application state containing the image
     * @param {Object} domElements - DOM elements for UI controls
     * @returns {Float32Array|null} Band map array where each pixel value indicates which color band it belongs to, or null if processing fails
     */
    function processImage(appState, domElements) {
        const { img } = appState;
        const {
            origCanvas,
            procCanvas,
            numBandsInput,
            paletteDiv,
            layerSlider,
            singleLayerToggle,
        } = domElements;
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

    // ============================================================================
    // STL EXPORTER FUNCTIONS (from stl_exporter.js)
    // ============================================================================

    /**
     * Generates a 3D STL file from a 2D image using the band map for height information.
     * This function creates a heightmap where each color band represents a different height layer,
     * suitable for multi-color 3D printing.
     *
     * @param {Object} appState - Application state containing bandMap and original canvas
     * @param {Object} domElements - DOM elements containing user input parameters
     * @returns {Blob} Binary STL file as a Blob object
     */
    function generateStl(appState, domElements) {
        const { bandMap, origCanvas } = appState;
        const {
            layerHeightInput,
            xSizeInput,
            ySizeInput,
            bandThicknessInput,
            baseThicknessInput,
            numBandsInput,
        } = domElements;

        // --- Model Parameters ---
        // Physical dimensions and layer settings for the 3D model
        const singleLayerHeight = parseFloat(layerHeightInput.value);
        const additionalBandLayers = parseInt(bandThicknessInput.value, 10);
        const baseThicknessInLayers = parseInt(baseThicknessInput.value, 10);
        const numBands = parseInt(numBandsInput.value, 10);

        // Physical size of the model in real-world units
        const modelWidth = parseFloat(xSizeInput.value);
        const modelDepth = parseFloat(ySizeInput.value);
        const imageWidth = origCanvas.width;
        const imageHeight = origCanvas.height;

        // Calculate the physical distance between adjacent pixels
        const dx = modelWidth / (imageWidth - 1);
        const dy = modelDepth / (imageHeight - 1);

        // --- Create a Height Lookup Table ---
        // Each band gets progressively higher, creating a stepped heightmap
        const bandHeights = new Array(numBands);
        bandHeights[0] = baseThicknessInLayers * singleLayerHeight; // Base layer height
        for (let i = 1; i < numBands; i++) {
            // Each subsequent band adds more layers on top
            bandHeights[i] = bandHeights[i - 1] + additionalBandLayers * singleLayerHeight;
        }

        // --- Vertex Generation ---
        // Create arrays to store all vertices and faces of the 3D mesh
        const vertices = [];
        const faces = [];

        // Arrays to track vertex indices for top and bottom surfaces
        // Each pixel gets two vertices: one at the bottom (z=0) and one at the calculated height
        const topVertices = new Array(imageWidth * imageHeight);
        const bottomVertices = new Array(imageWidth * imageHeight);

        // Generate vertices for each pixel in the image
        for (let j = 0; j < imageHeight; j++) {
            for (let i = 0; i < imageWidth; i++) {
                const x = i * dx; // Physical X coordinate
                const y = j * dy; // Physical Y coordinate
                const pixelIndex = j * imageWidth + i;

                // Bottom vertex (always at z=0)
                bottomVertices[pixelIndex] = vertices.length;
                vertices.push([x, y, 0]);

                // Top vertex (height based on color band)
                // Note: Image Y is flipped (j -> imageHeight-1-j) to match 3D coordinate system
                const bandMapIndex = (imageHeight - 1 - j) * imageWidth + i;
                const band = bandMap[bandMapIndex];
                const height = bandHeights[band] || 0;
                topVertices[pixelIndex] = vertices.length;
                vertices.push([x, y, height]);
            }
        }

        // --- Face Generation ---
        // Generate triangular faces to create a complete 3D mesh

        // 1. Top and Bottom Surface Faces (quads split into triangles)
        // For each 2x2 pixel quad, create 4 triangles (2 for top, 2 for bottom)
        for (let j = 0; j < imageHeight - 1; j++) {
            for (let i = 0; i < imageWidth - 1; i++) {
                // Get vertex indices for the 4 corners of the current quad
                const v00_t = topVertices[j * imageWidth + i]; // Top-left top vertex
                const v10_t = topVertices[j * imageWidth + i + 1]; // Top-right top vertex
                const v01_t = topVertices[(j + 1) * imageWidth + i]; // Bottom-left top vertex
                const v11_t = topVertices[(j + 1) * imageWidth + i + 1]; // Bottom-right top vertex

                // Top surface: split quad into 2 triangles
                faces.push([v00_t, v10_t, v11_t]); // First triangle
                faces.push([v00_t, v11_t, v01_t]); // Second triangle

                // Bottom surface: split quad into 2 triangles (note: winding order is reversed)
                const v00_b = bottomVertices[j * imageWidth + i];
                const v10_b = bottomVertices[j * imageWidth + i + 1];
                const v01_b = bottomVertices[(j + 1) * imageWidth + i];
                const v11_b = bottomVertices[(j + 1) * imageWidth + i + 1];
                faces.push([v00_b, v11_b, v10_b]); // First triangle (reversed winding)
                faces.push([v00_b, v01_b, v11_b]); // Second triangle (reversed winding)
            }
        }

        // 2. Front and Back Edge Faces (connecting top to bottom)
        // Create vertical faces along the front (j=0) and back (j=imageHeight-1) edges
        for (let i = 0; i < imageWidth - 1; i++) {
            const jf = 0; // Front edge (j=0)
            const jb = imageHeight - 1; // Back edge (j=imageHeight-1)

            // Front edge faces (connecting bottom to top)
            faces.push([
                bottomVertices[jf * imageWidth + i],
                topVertices[jf * imageWidth + i],
                topVertices[jf * imageWidth + i + 1],
            ]);
            faces.push([
                bottomVertices[jf * imageWidth + i],
                topVertices[jf * imageWidth + i + 1],
                bottomVertices[jf * imageWidth + i + 1],
            ]);

            // Back edge faces (connecting bottom to top)
            faces.push([
                bottomVertices[jb * imageWidth + i],
                topVertices[jb * imageWidth + i + 1],
                topVertices[jb * imageWidth + i],
            ]);
            faces.push([
                bottomVertices[jb * imageWidth + i],
                bottomVertices[jb * imageWidth + i + 1],
                topVertices[jb * imageWidth + i + 1],
            ]);
        }

        // 3. Left and Right Edge Faces (connecting top to bottom)
        // Create vertical faces along the left (i=0) and right (i=imageWidth-1) edges
        for (let j = 0; j < imageHeight - 1; j++) {
            const il = 0; // Left edge (i=0)
            const ir = imageWidth - 1; // Right edge (i=imageWidth-1)

            // Left edge faces (connecting bottom to top)
            faces.push([
                bottomVertices[j * imageWidth + il],
                topVertices[j * imageWidth + il],
                topVertices[(j + 1) * imageWidth + il],
            ]);
            faces.push([
                bottomVertices[j * imageWidth + il],
                topVertices[(j + 1) * imageWidth + il],
                bottomVertices[(j + 1) * imageWidth + il],
            ]);

            // Right edge faces (connecting bottom to top)
            faces.push([
                bottomVertices[j * imageWidth + ir],
                topVertices[(j + 1) * imageWidth + ir],
                topVertices[j * imageWidth + ir],
            ]);
            faces.push([
                bottomVertices[j * imageWidth + ir],
                bottomVertices[(j + 1) * imageWidth + ir],
                topVertices[(j + 1) * imageWidth + ir],
            ]);
        }

        // --- Binary STL File Generation ---
        // STL binary format: 80-byte header + 4-byte triangle count + 50 bytes per triangle

        // Allocate buffer for the entire STL file
        const buffer = new ArrayBuffer(84 + faces.length * 50);
        const writer = new DataView(buffer);

        // Write triangle count (4 bytes at offset 80)
        writer.setUint32(80, faces.length, true); // true = little-endian

        let offset = 84; // Start after header and triangle count

        // Write each triangle face
        for (const face of faces) {
            const [i1, i2, i3] = face; // Vertex indices for this triangle
            const [v1, v2, v3] = [vertices[i1], vertices[i2], vertices[i3]]; // Actual vertex coordinates

            // Calculate face normal using cross product of two edge vectors
            const ux = v2[0] - v1[0],
                uy = v2[1] - v1[1],
                uz = v2[2] - v1[2]; // Edge vector 1
            const vx = v3[0] - v1[0],
                vy = v3[1] - v1[1],
                vz = v3[2] - v1[2]; // Edge vector 2

            // Cross product: n = u × v
            const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];

            // Normalize the normal vector
            const len = Math.sqrt(n[0] ** 2 + n[1] ** 2 + n[2] ** 2) || 1;
            const normalizedNormal = n.map(val => val / len);

            // Write face normal (12 bytes: 3 floats)
            writer.setFloat32(offset, normalizedNormal[0], true);
            offset += 4;
            writer.setFloat32(offset, normalizedNormal[1], true);
            offset += 4;
            writer.setFloat32(offset, normalizedNormal[2], true);
            offset += 4;

            // Write the three vertices (36 bytes: 9 floats)
            for (const v of [v1, v2, v3]) {
                writer.setFloat32(offset, v[0], true);
                offset += 4; // X
                writer.setFloat32(offset, v[1], true);
                offset += 4; // Y
                writer.setFloat32(offset, v[2], true);
                offset += 4; // Z
            }

            // Write attribute byte count (2 bytes, usually 0)
            offset += 2;
        }

        // Return the STL file as a downloadable blob
        return new Blob([buffer], { type: 'application/octet-stream' });
    }

    // ============================================================================
    // UI FUNCTIONS (from ui.js)
    // ============================================================================

    // Helper function to convert RGB style to hex
    function rgbToHexFromStyle(rgbStyle) {
        if (rgbStyle.startsWith('rgb')) {
            const matches = rgbStyle.match(/\d+/g);
            if (matches && matches.length >= 3) {
                const r = parseInt(matches[0]);
                const g = parseInt(matches[1]);
                const b = parseInt(matches[2]);
                return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
            }
        }
        return rgbStyle; // Return as-is if not RGB format
    }

    function getColorName(color) {
        const colorNames = {
            '#000000': 'Black',
            '#4B5563': 'Gray',
            '#6B7280': 'Gray',
            '#9CA3AF': 'Silver',
            '#D1D5DB': 'Light Gray',
            '#FBBF24': 'Yellow',
            '#F87171': 'Salmon',
            '#EF4444': 'Red',
            '#3B82F6': 'Blue',
            '#22C55E': 'Green',
            '#A855F7': 'Purple',
            '#ffffff': 'White',
            '#cccccc': 'Light Gray',
            '#999999': 'Gray',
            '#666666': 'Dark Gray',
            '#333333': 'Dark Gray',
        };
        return colorNames[color] || 'Custom';
    }

    function getFilamentName(color) {
        const colorNames = {
            '#EF4444': 'Fire Red PLA',
            '#000000': 'Galaxy Black ASA',
            '#3B82F6': 'Ocean Blue PETG',
            '#22C55E': 'Lime Green PLA',
            '#FBBF24': 'Sunshine Yellow',
            '#A855F7': 'Purple Haze',
            '#ffffff': 'White PLA',
            '#cccccc': 'Light Gray PLA',
            '#999999': 'Gray PLA',
            '#666666': 'Dark Gray PLA',
            '#333333': 'Charcoal PLA',
        };
        return colorNames[color] || 'Custom PLA';
    }

    function renderPalette(colors, paletteDiv, onColorChange, readOnly = false) {
        paletteDiv.innerHTML = '';
        colors.forEach((color, index) => {
            const colorDiv = document.createElement('div');
            colorDiv.className = 'relative group cursor-grab';

            // Create the color swatch
            const colorSwatch = document.createElement('div');
            colorSwatch.className =
                'w-8 h-8 rounded border-2 border-gray-600 hover:border-indigo-400 transition-all duration-200 hover:scale-110';
            colorSwatch.style.backgroundColor = color;

            // Add drag handle icon
            const dragHandle = document.createElement('span');
            dragHandle.className = 'material-icons absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 group-hover:opacity-50 transition-opacity text-xs';
            dragHandle.textContent = 'drag_indicator';
            colorDiv.appendChild(dragHandle);

            // Add click handler for color picker
            if (!readOnly) {
                colorSwatch.addEventListener('click', () => {
                    // Get the current color from the swatch (not the original)
                    const currentColor = colorSwatch.style.backgroundColor;
                    const hexColor = rgbToHexFromStyle(currentColor);

                    openCustomColorPicker(hexColor, newColor => {
                        // Update the color in the palette
                        colorSwatch.style.backgroundColor = newColor;
                        colors[index] = newColor;

                        // Update the app state - NEVER modify suggestedPalette, only currentPalette
                        if (window.appState) {
                            // Always update currentPalette, never suggestedPalette
                            window.appState.currentPalette[index] = newColor;
                        }

                        // Trigger the change callback to update the preview
                        if (onColorChange) {
                            onColorChange();
                        }
                    });
                });
            }

            // Add tooltip
            const tooltip = document.createElement('div');
            tooltip.className =
                'tooltip -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity';
            tooltip.textContent = readOnly ? getColorName(color) : 'Click to change color';

            colorDiv.appendChild(colorSwatch);
            colorDiv.appendChild(tooltip);
            paletteDiv.appendChild(colorDiv);
        });
    }

    function openCustomColorPicker(currentColor, onColorChange, isFilamentPicker = false) {
        // Get the original color from the suggested palette for this position
        let originalColor = currentColor;
        if (!isFilamentPicker && window.appState && window.appState.suggestedPalette) {
            // Find which color position this is by matching the current color
            const currentIndex = window.appState.currentPalette
                ? window.appState.currentPalette.indexOf(currentColor)
                : -1;
            if (currentIndex >= 0 && window.appState.suggestedPalette[currentIndex]) {
                originalColor = window.appState.suggestedPalette[currentIndex];
            }
        }

        // Create a simple color picker using the browser's native color input
        const modalHTML = `
    <div class="space-y-6">
      <div class="text-center">
        <h3 class="text-lg font-semibold text-white mb-2">Choose Color</h3>
        <p class="text-gray-400 text-sm">${isFilamentPicker ? 'Select a color for your new filament' : 'Select a color for your palette'}</p>
      </div>
      
      ${
          !isFilamentPicker
              ? `
      <!-- Color Preview -->
      <div class="flex items-center justify-center gap-4">
        <div class="text-sm text-gray-300">Original:</div>
        <div class="w-8 h-8 rounded border-2 border-gray-600" style="background-color: ${originalColor}"></div>
        <div class="text-sm text-gray-300">Current:</div>
        <div class="w-8 h-8 rounded border-2 border-gray-600" style="background-color: ${currentColor}"></div>
        <div class="text-sm text-gray-300">New:</div>
        <div id="newColorPreview" class="w-8 h-8 rounded border-2 border-gray-600" style="background-color: ${currentColor}"></div>
      </div>
      `
              : `
      <!-- Color Preview for Filament -->
      <div class="flex items-center justify-center gap-4">
        <div class="text-sm text-gray-300">Selected:</div>
        <div id="newColorPreview" class="w-8 h-8 rounded border-2 border-gray-600" style="background-color: ${currentColor}"></div>
      </div>
      `
      }
      
      <!-- Native Color Picker -->
      <div class="space-y-4">
        <div class="space-y-2">
          <label class="text-sm text-gray-300">Choose Color</label>
          <input type="color" id="nativeColorPicker" value="${currentColor}" class="w-full h-12 rounded border border-gray-600 cursor-pointer">
        </div>
      </div>
      
      <!-- Preset Colors -->
      <div class="space-y-3">
        <label class="text-sm text-gray-300">Quick Colors</label>
        <div class="grid grid-cols-8 gap-2">
          <div class="w-8 h-8 rounded cursor-pointer border-2 border-gray-600 hover:scale-110 transition-transform" style="background: #ff0000" data-color="#ff0000"></div>
          <div class="w-8 h-8 rounded cursor-pointer border-2 border-gray-600 hover:scale-110 transition-transform" style="background: #ff8000" data-color="#ff8000"></div>
          <div class="w-8 h-8 rounded cursor-pointer border-2 border-gray-600 hover:scale-110 transition-transform" style="background: #ffff00" data-color="#ffff00"></div>
          <div class="w-8 h-8 rounded cursor-pointer border-2 border-gray-600 hover:scale-110 transition-transform" style="background: #80ff00" data-color="#80ff00"></div>
          <div class="w-8 h-8 rounded cursor-pointer border-2 border-gray-600 hover:scale-110 transition-transform" style="background: #00ff00" data-color="#00ff00"></div>
          <div class="w-8 h-8 rounded cursor-pointer border-2 border-gray-600 hover:scale-110 transition-transform" style="background: #00ff80" data-color="#00ff80"></div>
          <div class="w-8 h-8 rounded cursor-pointer border-2 border-gray-600 hover:scale-110 transition-transform" style="background: #00ffff" data-color="#00ffff"></div>
          <div class="w-8 h-8 rounded cursor-pointer border-2 border-gray-600 hover:scale-110 transition-transform" style="background: #0080ff" data-color="#0080ff"></div>
          <div class="w-8 h-8 rounded cursor-pointer border-2 border-gray-600 hover:scale-110 transition-transform" style="background: #0000ff" data-color="#0000ff"></div>
          <div class="w-8 h-8 rounded cursor-pointer border-2 border-gray-600 hover:scale-110 transition-transform" style="background: #8000ff" data-color="#8000ff"></div>
          <div class="w-8 h-8 rounded cursor-pointer border-2 border-gray-600 hover:scale-110 transition-transform" style="background: #ff00ff" data-color="#ff00ff"></div>
          <div class="w-8 h-8 rounded cursor-pointer border-2 border-gray-600 hover:scale-110 transition-transform" style="background: #ff0080" data-color="#ff0080"></div>
          <div class="w-8 h-8 rounded cursor-pointer border-2 border-gray-600 hover:scale-110 transition-transform" style="background: #ffffff" data-color="#ffffff"></div>
          <div class="w-8 h-8 rounded cursor-pointer border-2 border-gray-600 hover:scale-110 transition-transform" style="background: #cccccc" data-color="#cccccc"></div>
          <div class="w-8 h-8 rounded cursor-pointer border-2 border-gray-600 hover:scale-110 transition-transform" style="background: #999999" data-color="#999999"></div>
          <div class="w-8 h-8 rounded cursor-pointer border-2 border-gray-600 hover:scale-110 transition-transform" style="background: #000000" data-color="#000000"></div>
        </div>
      </div>
      
      <!-- Custom Hex Input -->
      <div class="space-y-2">
        <label class="text-sm text-gray-300">Custom Color</label>
        <div class="flex gap-2">
          <input type="text" id="customColorInput" placeholder="#ffffff" class="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-100 text-sm" value="${currentColor}">
          <button id="applyCustomColorBtn" class="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700">Apply</button>
        </div>
      </div>
      
      <!-- Action Buttons -->
      <div class="flex gap-3 pt-4">
        ${!isFilamentPicker ? '<button id="resetToOriginalBtn" class="px-4 py-2 bg-gray-500 text-white text-sm rounded hover:bg-gray-600">Reset to Original</button>' : ''}
        <button id="cancelColorBtn" class="flex-1 px-4 py-2 bg-gray-600 text-gray-200 font-medium rounded-lg transition-all hover:bg-gray-500">Cancel</button>
        <button id="confirmColorBtn" class="flex-1 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg transition-all hover:bg-indigo-700">Confirm</button>
      </div>
    </div>
  `;

        // Show the modal
        const modal = document.getElementById('modal');
        const modalBody = document.getElementById('modalBody');
        const modalTitle = document.getElementById('modalTitle');

        modalTitle.textContent = 'Color Picker';
        modalBody.innerHTML = modalHTML;
        modal.style.display = 'flex';

        // Initialize color picker
        let selectedColor = currentColor;

        const nativeColorPicker = document.getElementById('nativeColorPicker');
        const newColorPreview = document.getElementById('newColorPreview');
        const customColorInput = document.getElementById('customColorInput');

        console.log('Color picker elements found:', {
            nativeColorPicker: !!nativeColorPicker,
            newColorPreview: !!newColorPreview,
            customColorInput: !!customColorInput,
        });

        // Simple event handlers
        if (nativeColorPicker) {
            nativeColorPicker.addEventListener('input', e => {
                console.log('Native color picker changed:', e.target.value);
                selectedColor = e.target.value;
                newColorPreview.style.backgroundColor = selectedColor;
                customColorInput.value = selectedColor;
            });
        }

        // Handle preset color clicks
        const presetColors = modalBody.querySelectorAll('[data-color]');
        presetColors.forEach(swatch => {
            swatch.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Preset color clicked:', swatch.getAttribute('data-color'));
                selectedColor = swatch.getAttribute('data-color');
                newColorPreview.style.backgroundColor = selectedColor;
                customColorInput.value = selectedColor;
                if (nativeColorPicker) nativeColorPicker.value = selectedColor;
            });
        });

        // Handle custom color input
        customColorInput.addEventListener('input', e => {
            console.log('Custom color input:', e.target.value);
            const color = e.target.value;
            if (/^#[0-9A-F]{6}$/i.test(color)) {
                selectedColor = color;
                newColorPreview.style.backgroundColor = selectedColor;
                if (nativeColorPicker) nativeColorPicker.value = selectedColor;
            }
        });

        // Handle apply custom color button
        const applyBtn = document.getElementById('applyCustomColorBtn');
        if (applyBtn) {
            applyBtn.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Apply button clicked');
                const color = customColorInput.value;
                if (/^#[0-9A-F]{6}$/i.test(color)) {
                    selectedColor = color;
                    newColorPreview.style.backgroundColor = selectedColor;
                    if (nativeColorPicker) nativeColorPicker.value = selectedColor;
                }
            });
        }

        // Handle confirm button
        const confirmBtn = document.getElementById('confirmColorBtn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Confirm button clicked');
                onColorChange(selectedColor);
                // Only close the modal if it's not a filament picker
                // For filament picker, let the callback handle any UI updates
                if (!isFilamentPicker) {
                    modal.style.display = 'none';
                }
            });
        }

        // Handle reset to original button (only for palette picker)
        if (!isFilamentPicker) {
            const resetBtn = document.getElementById('resetToOriginalBtn');
            if (resetBtn) {
                resetBtn.addEventListener('click', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Reset to original clicked');
                    selectedColor = originalColor;
                    newColorPreview.style.backgroundColor = selectedColor;
                    customColorInput.value = selectedColor;
                    if (nativeColorPicker) nativeColorPicker.value = selectedColor;
                });
            }
        }

        // Handle cancel button
        const cancelBtn = document.getElementById('cancelColorBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Cancel button clicked');
                modal.style.display = 'none';
            });
        }
    }

    function renderMyFilaments(filaments, container, onRemove, editCallback) {
        container.innerHTML = '';
        filaments.forEach((filament, index) => {
            // Create main filament card container
            const filamentCard = document.createElement('div');
            filamentCard.className = 'relative group bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-all duration-200 hover:shadow-lg';

            // Action buttons container - positioned in top-right corner
            const actionButtons = document.createElement('div');
            actionButtons.className = 'absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10';

            // Edit button
            const editBtn = document.createElement('button');
            editBtn.className = 'p-1 bg-blue-600 hover:bg-blue-700 rounded-full text-white transition-colors duration-200 shadow-lg';
            editBtn.title = 'Edit filament';
            const editIcon = document.createElement('span');
            editIcon.className = 'material-icons text-xs';
            editIcon.textContent = 'edit';
            editBtn.appendChild(editIcon);
            editBtn.onclick = e => {
                e.stopPropagation();
                if (editCallback) {
                    editCallback(filament.id);
                }
            };

            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'p-1 bg-red-600 hover:bg-red-700 rounded-full text-white transition-colors duration-200 shadow-lg';
            deleteBtn.title = 'Delete filament';
            const deleteIcon = document.createElement('span');
            deleteIcon.className = 'material-icons text-xs';
            deleteIcon.textContent = 'delete';
            deleteBtn.appendChild(deleteIcon);
            deleteBtn.onclick = e => {
                e.stopPropagation();
                onRemove(filament.id);
            };

            // Create filament spool as a ring with transparent center
            const spoolContainer = document.createElement('div');
            spoolContainer.className = 'flex justify-center mb-3';

            const spoolDiv = document.createElement('div');
            spoolDiv.className = 'w-16 h-16 rounded-full flex items-center justify-center relative';

            // Create the main ring with a hole using CSS
            const ringDiv = document.createElement('div');
            ringDiv.className = 'absolute w-16 h-16 rounded-full';
            ringDiv.style.backgroundColor = filament.color;
            ringDiv.style.border = '4px solid #6B7280';
            ringDiv.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.3)';
            ringDiv.style.mask = 'radial-gradient(circle at center, transparent 10px, black 10px)';
            ringDiv.style.webkitMask =
                'radial-gradient(circle at center, transparent 10px, black 10px)';

            // Add inner hole outline - smaller diameter and thicker border
            const holeOutline = document.createElement('div');
            holeOutline.className = 'absolute w-6 h-6 rounded-full';
            holeOutline.style.border = '4px solid #6B7280';
            holeOutline.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.3)';

            // Filament name
            const nameDiv = document.createElement('div');
            nameDiv.className = 'text-center mb-1 min-h-[2.5rem] flex items-center justify-center';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'text-sm font-medium text-gray-200 break-words leading-tight';
            nameSpan.textContent = filament.name;
            nameDiv.appendChild(nameSpan);

            // Filament type
            const typeDiv = document.createElement('div');
            typeDiv.className = 'text-center mb-3';
            const typeSpan = document.createElement('span');
            typeSpan.className = 'text-xs text-gray-400';
            typeSpan.textContent = filament.type;
            typeDiv.appendChild(typeSpan);

            // Assemble the filament card
            spoolDiv.appendChild(ringDiv);
            spoolDiv.appendChild(holeOutline);
            spoolContainer.appendChild(spoolDiv);
            
            actionButtons.appendChild(editBtn);
            actionButtons.appendChild(deleteBtn);

            filamentCard.appendChild(actionButtons);
            filamentCard.appendChild(spoolContainer);
            filamentCard.appendChild(nameDiv);
            filamentCard.appendChild(typeDiv);

            container.appendChild(filamentCard);
        });
    }

    function showModal(domElements, title, contentHTML) {
        domElements.modalTitle.textContent = title;
        domElements.modalBody.innerHTML = contentHTML;
        domElements.modal.style.display = 'flex';
    }

    function hideModal(domElements) {
        domElements.modal.style.display = 'none';
    }

    /**
     * Updates the dimension display on the processed preview canvas
     * @param {number} xSize - X dimension in millimeters
     * @param {number} ySize - Y dimension in millimeters
     */
    function updateDimensionDisplay(xSize, ySize) {
        // Format the dimensions to 1 decimal place
        const formattedX = parseFloat(xSize).toFixed(1);
        const formattedY = parseFloat(ySize).toFixed(1);
        
        // Update dimension display overlay
        const dimX = document.getElementById('dimension-display-x');
        const dimY = document.getElementById('dimension-display-y');
        if (dimX) dimX.textContent = formattedX;
        if (dimY) dimY.textContent = formattedY;
    }

    function resetApp(domElements) {
        const { uploadArea, mainContent, origCanvas, procCanvas, paletteDiv, fileInput } =
            domElements;
        showUploadArea(domElements);
        origCanvas.getContext('2d').clearRect(0, 0, origCanvas.width, origCanvas.height);
        procCanvas.getContext('2d').clearRect(0, 0, procCanvas.width, procCanvas.height);
        paletteDiv.innerHTML = '';
        fileInput.value = '';

        // Reset the initial load flag for the next image
        if (appState) {
            appState.isInitialLoad = true;
        }
    }

    function showApp(domElements) {
        // This function is now replaced by showMainContent
        showMainContent(domElements);
    }

    function showMainContent(domElements) {
        const { uploadArea, mainContent } = domElements;
        uploadArea.style.display = 'none';
        mainContent.classList.remove('hidden');
        showHeaderButtons(domElements);
    }

    function showUploadArea(domElements) {
        const { uploadArea, mainContent } = domElements;
        uploadArea.style.display = 'block';
        mainContent.classList.add('hidden');
        hideHeaderButtons(domElements);
    }

    function showHeaderButtons(domElements) {
        const { instructionsBtn, newImageBtn, exportBtn } = domElements;
        if (instructionsBtn) instructionsBtn.style.display = 'flex';
        if (newImageBtn) newImageBtn.style.display = 'flex';
        if (exportBtn) exportBtn.style.display = 'flex';
    }

    function hideHeaderButtons(domElements) {
        const { instructionsBtn, newImageBtn, exportBtn } = domElements;
        if (instructionsBtn) instructionsBtn.style.display = 'none';
        if (newImageBtn) newImageBtn.style.display = 'none';
        if (exportBtn) exportBtn.style.display = 'none';
    }

    // Enhanced error handling for file operations
    function handleFile(file) {
        console.log('handleFile called with:', file);

        // Validate file type
        if (!file || !file.type) {
            showError('Invalid file selected');
            return;
        }

        // Check file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
            showError('File size too large. Please select a file smaller than 10MB.');
            return;
        }

        // Validate file type
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/bmp'];
        if (allowedTypes.indexOf(file.type) === -1) {
            showError('Invalid file type. Please select a PNG, JPEG, or BMP file.');
            return;
        }

        try {
            // First, make the main content area visible.
            showMainContent(domElements);

            // Then, wait for the next browser paint cycle before loading the image.
            // This ensures the canvases are rendered and ready.
            setTimeout(() => {
                loadImage(file);
            }, 0);
        } catch (error) {
            console.error('Error handling file:', error);
            showError('Failed to load image. Please try again.');
        }
    }

    // Enhanced image loading with better error handling
    function loadImage(file) {
        console.log('loadImage called with:', file);

        // Check if FileReader is supported
        if (typeof FileReader === 'undefined') {
            showError('File reading is not supported in this browser.');
            return;
        }

        const reader = new FileReader();

        reader.onload = function (event) {
            console.log('FileReader onload triggered');

            // Check if Image constructor is supported
            if (typeof Image === 'undefined') {
                showError('Image processing is not supported in this browser.');
                return;
            }

            appState.img = new Image();

            appState.img.onload = function () {
                console.log('Image loaded successfully');

                // Synchronize with browser's paint cycle to ensure canvas is ready
                requestAnimationFrame(function () {
                    try {
                        // Explicitly draw the original image to its canvas here.
                        const img = appState.img;
                        const origCanvas = domElements.origCanvas;
                        origCanvas.width = img.width;
                        origCanvas.height = img.height;
                        const context = origCanvas.getContext('2d');
                        context.drawImage(img, 0, 0, img.width, img.height);

                        // Implement automatic aspect ratio scaling for model dimensions
                        const MAX_DIMENSION = 150;
                        const aspectRatio = img.width / img.height;
                        
                        // Store the aspect ratio in appState for aspect ratio lock functionality
                        appState.aspectRatio = aspectRatio;
                        
                        let newXSize, newYSize;
                        
                        if (img.width > img.height) {
                            // Image is wider than it is tall
                            newXSize = MAX_DIMENSION;
                            newYSize = Math.round((MAX_DIMENSION / aspectRatio) * 10) / 10; // Round to 1 decimal place
                        } else {
                            // Image is taller than it is wide (or square)
                            newYSize = MAX_DIMENSION;
                            newXSize = Math.round((MAX_DIMENSION * aspectRatio) * 10) / 10; // Round to 1 decimal place
                        }
                        
                        // Update the input field values
                        domElements.xSizeInput.value = newXSize;
                        domElements.ySizeInput.value = newYSize;

                        // Update the dimension display overlays
                        updateDimensionDisplay(newXSize, newYSize);

                        // Now, proceed with processing.
                        handleNumBandsChange();
                    } catch (error) {
                        console.error('Error processing image:', error);
                        showError('Failed to process image. Please try a different image.');
                    }
                });
            };

            appState.img.onerror = function () {
                console.error('Failed to load image');
                showError('Failed to load image. Please try a different file.');
            };

            appState.img.src = event.target.result;
        };

        reader.onerror = function () {
            console.error('FileReader error');
            showError('Failed to read file. Please try again.');
        };

        try {
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Error reading file:', error);
            showError('Failed to read file. Please try again.');
        }
    }

    // Enhanced settings change handler with error handling
    function handleSettingsChange() {
        if (!appState.img) return;

        try {
            // Show spinner while processing
            if (domElements.spinner) {
                domElements.spinner.style.display = 'flex';
            }

            // Prepare data for worker (serializable version)
            const workerAppState = {
                suggestedPalette: appState.suggestedPalette,
                currentPalette: appState.currentPalette,
                imageData: appState.imageData,
                width: appState.img.width,
                height: appState.img.height,
            };

            const workerDomElements = {
                layerSlider: { value: domElements.layerSlider.value },
                singleLayerToggle: {
                    checked: domElements.singleLayerToggle
                        ? domElements.singleLayerToggle.checked
                        : false,
                },
            };

            // Send message to worker
            if (imageWorker) {
                imageWorker.postMessage({
                    type: 'process_image',
                    data: {
                        appState: workerAppState,
                        domElements: workerDomElements,
                    },
                });
            } else {
                // Fallback to synchronous processing
                appState.bandMap = processImage(appState, domElements);
                if (domElements.spinner) {
                    domElements.spinner.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('Error processing image settings:', error);
            showError('Failed to update preview. Please try again.');
            if (domElements.spinner) {
                domElements.spinner.style.display = 'none';
            }
        }
    }

    // Enhanced number of bands change handler
    function handleNumBandsChange() {
        if (!appState.img) return;

        try {
            const img = appState.img;
            const origCanvas = domElements.origCanvas;
            const procCanvas = domElements.procCanvas;
            const numBandsInput = domElements.numBandsInput;
            const numBandsValue = domElements.numBandsValue;
            const layerSlider = domElements.layerSlider;
            const layerValue = domElements.layerValue;

            // Check if canvas is supported
            if (typeof origCanvas.getContext === 'undefined') {
                showError('Canvas is not supported in this browser.');
                return;
            }

            origCanvas.width = procCanvas.width = img.width;
            origCanvas.height = procCanvas.height = img.height;

            const context = origCanvas.getContext('2d');
            if (!context) {
                showError('Canvas 2D context is not supported in this browser.');
                return;
            }

            context.drawImage(img, 0, 0, img.width, img.height);

            let numBands = parseInt(numBandsInput.value, 10);
            if (isNaN(numBands) || numBands < 2 || numBands > 8) {
                numBands = 4;
                numBandsInput.value = 4;
            }

            numBandsValue.textContent = numBands;
            layerSlider.min = 0;
            layerSlider.max = numBands - 1;
            layerSlider.value = numBands - 1;
            layerValue.textContent = numBands;

            const imageData = context.getImageData(0, 0, img.width, img.height);
            if (!imageData || !imageData.data) {
                showError('Failed to get image data.');
                return;
            }

            // Store image data for worker
            appState.imageData = imageData.data;

            // Show spinner while processing
            if (domElements.spinner) {
                domElements.spinner.style.display = 'flex';
            }

            // Send message to worker for palette generation
            if (imageWorker) {
                imageWorker.postMessage({
                    type: 'generate_palette',
                    data: {
                        imageData: imageData.data,
                        numBands: numBands,
                        width: img.width,
                        height: img.height,
                    },
                });
            } else {
                // Fallback to synchronous processing
                const data = imageData.data;
                appState.suggestedPalette = getSuggestedColors(data, numBands, img.width, img.height);

                // Intelligently set the base layer by detecting background color
                const backgroundColor = detectBackgroundColor(data, img.width, img.height);

                // Find the color in the suggested palette closest to the background color
                let closestIndex = 0;
                let minDistance = Infinity;

                for (let i = 0; i < appState.suggestedPalette.length; i++) {
                    const rgb = hexToRgb(appState.suggestedPalette[i]);
                    const paletteColor = [rgb.r, rgb.g, rgb.b];
                    const distance = colorDistance(backgroundColor, paletteColor);

                    if (distance < minDistance) {
                        minDistance = distance;
                        closestIndex = i;
                    }
                }

                // Move the closest color to the beginning of the palette (base layer)
                if (closestIndex > 0) {
                    const baseColor = appState.suggestedPalette[closestIndex];
                    appState.suggestedPalette.splice(closestIndex, 1);
                    appState.suggestedPalette.unshift(baseColor);
                }

                // Sort the remaining colors (from index 1 to end) by luminance, darkest to lightest
                if (appState.suggestedPalette.length > 1) {
                    const remainingColors = appState.suggestedPalette.slice(1);
                    remainingColors.sort(function (a, b) {
                        return getLuminance(a) - getLuminance(b);
                    });
                    appState.suggestedPalette = [appState.suggestedPalette[0]].concat(
                        remainingColors
                    );
                }

                updatePalette();
                if (domElements.spinner) {
                    domElements.spinner.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('Error in handleNumBandsChange:', error);
            showError('Failed to process image. Please try again.');
            if (domElements.spinner) {
                domElements.spinner.style.display = 'none';
            }
        }
    }

    // Enhanced palette update function
    function updatePalette() {
        if (!appState.img) return;

        try {
            const paletteDiv = domElements.paletteDiv;

            if (appState.activePalette === 'my') {
                const matchedPalette = matchToPalette(
                    appState.suggestedPalette,
                    appState.myFilaments
                );
                appState.currentPalette = matchedPalette.slice(); // Create a copy
                renderPalette(appState.currentPalette, paletteDiv, handleSettingsChange, false);
            } else {
                appState.currentPalette = appState.suggestedPalette.slice(); // Create a copy
                renderPalette(appState.currentPalette, paletteDiv, handleSettingsChange, false);
            }
            
            // Initialize SortableJS for drag-and-drop reordering
            if (typeof Sortable !== 'undefined') {
                // Destroy any existing Sortable instance
                if (paletteDiv.sortable) {
                    paletteDiv.sortable.destroy();
                }
                
                // Create new Sortable instance
                paletteDiv.sortable = Sortable.create(paletteDiv, {
                    animation: 150,
                    ghostClass: 'sortable-ghost',
                    chosenClass: 'sortable-chosen',
                    dragClass: 'sortable-drag',
                    onEnd: function(evt) {
                        // Get the new order of color elements from the DOM
                        const colorElements = Array.from(paletteDiv.children);
                        const newColorOrder = colorElements.map(element => {
                            const colorSwatch = element.querySelector('div[style*="background-color"]');
                            if (colorSwatch) {
                                const rgbStyle = colorSwatch.style.backgroundColor;
                                return rgbToHexFromStyle(rgbStyle);
                            }
                            return null;
                        }).filter(color => color !== null);
                        
                        // Update appState.currentPalette with the new order
                        if (newColorOrder.length > 0) {
                            appState.currentPalette = newColorOrder;
                            // Update appState.suggestedPalette to keep structural data in sync
                            appState.suggestedPalette = newColorOrder;
                            // Re-render the "Processed Preview" with the new color order
                            handleSettingsChange();
                        }
                    }
                });
            }
            
            handleSettingsChange();
        } catch (error) {
            console.error('Error updating palette:', error);
            showError('Failed to update color palette.');
        }
    }

    // Enhanced slicer instructions function
    function showSlicerInstructions(appState, domElements) {
        console.log(
            'showSlicerInstructions called with state and elements:',
            !!appState,
            !!domElements
        );
        try {
            const baseThicknessInput = domElements.baseThicknessInput;
            const bandThicknessInput = domElements.bandThicknessInput;

            const baseThickness = parseInt(baseThicknessInput.value, 10);
            const bandThickness = parseInt(bandThicknessInput.value, 10);

            // Get colors from the current palette (which reflects user changes)
            const colors = appState.currentPalette || appState.suggestedPalette || [];

            let instructionsHTML = '<ul class="space-y-2">';
            colors.forEach(function (color, index) {
                let text;
                if (index === 0) {
                    text = 'Start with this color (Base)';
                } else {
                    const startLayer = baseThickness + (index - 1) * bandThickness + 1;
                    text = 'Change to this color at Layer ' + startLayer;
                }
                instructionsHTML +=
                    '<li class="flex items-center gap-3"><div class="w-4 h-4 rounded border border-gray-600" style="background-color:' +
                    color +
                    ';"></div><span class="text-gray-300">' +
                    text +
                    '</span></li>';
            });
            instructionsHTML += '</ul>';

            showModal(domElements, 'Slicer Instructions', instructionsHTML);
        } catch (error) {
            console.error('Error showing slicer instructions:', error);
            showError('Failed to generate slicer instructions.');
        }
    }

    // Enhanced localStorage functions with error handling
    function saveMyFilaments() {
        try {
            localStorage.setItem('myFilaments', JSON.stringify(appState.myFilaments));
        } catch (error) {
            console.error('Failed to save filaments:', error);
            showError('Failed to save your filaments. Please try again.');
        }
    }

    function loadMyFilaments() {
        try {
            const saved = localStorage.getItem('myFilaments');
            if (saved) {
                const parsedData = JSON.parse(saved);
                
                // Migration logic: Check if the data is the old format (array of strings)
                if (Array.isArray(parsedData) && parsedData.length > 0 && typeof parsedData[0] === 'string') {
                    // Convert old format (array of color strings) to new format (array of objects)
                    console.log('Migrating filaments from old format to new format');
                    appState.myFilaments = parsedData.map(color => ({
                        id: Date.now().toString() + Math.random().toString(36).substr(2, 9), // Generate unique ID
                        name: 'New Filament',
                        type: 'PLA',
                        color: color
                    }));
                    // Save the migrated data
                    saveMyFilaments();
                } else {
                    // New format already - use as is
                    appState.myFilaments = parsedData;
                }
                
                renderMyFilaments(
                    appState.myFilaments,
                    domElements.myFilamentsList,
                    removeFilament,
                    openFilamentModal
                );
            }
        } catch (error) {
            console.error('Failed to load filaments:', error);
            // Don't show error for this, just start with empty filaments
            appState.myFilaments = [];
        }
    }

    // Enhanced add filament function
    function addFilament() {
        openFilamentModal(); // Open modal in add mode
    }

    // Enhanced add filament with color function
    function addFilamentWithColor(color) {
        try {
            // Check if this color already exists in filaments
            const existingFilament = appState.myFilaments.find(filament => filament.color === color);
            if (existingFilament) {
                showError('This color is already in your filaments!');
                return;
            }

            // Create a new filament object with the required structure
            const newFilament = {
                id: Date.now().toString(), // Generate unique ID
                name: 'New Filament', // Placeholder name
                type: 'PLA', // Placeholder type
                color: color
            };

            appState.myFilaments.push(newFilament);
            saveMyFilaments();
            renderMyFilaments(
                appState.myFilaments,
                domElements.myFilamentsList,
                removeFilament,
                openFilamentModal
            );
            if (appState.activePalette === 'my') updatePalette();
            hideModal(domElements);
        } catch (error) {
            console.error('Error adding filament:', error);
            showError('Failed to add filament. Please try again.');
        }
    }

    // Enhanced hex color validation
    function isValidHexColor(color) {
        return /^#[0-9A-F]{6}$/i.test(color);
    }

    // Enhanced remove filament function
    function removeFilament(filamentId) {
        try {
            const indexToRemove = appState.myFilaments.findIndex(filament => filament.id === filamentId);
            if (indexToRemove !== -1) {
                appState.myFilaments.splice(indexToRemove, 1);
                saveMyFilaments();
                renderMyFilaments(appState.myFilaments, domElements.myFilamentsList, removeFilament, openFilamentModal);
                if (appState.activePalette === 'my') updatePalette();
            }
        } catch (error) {
            console.error('Error removing filament:', error);
            showError('Failed to remove filament. Please try again.');
        }
    }

    // Enhanced invert palette function
    function invertPalette() {
        try {
            if (appState.suggestedPalette.length > 0) {
                appState.suggestedPalette.reverse();
                updatePalette();
            }
        } catch (error) {
            console.error('Error inverting palette:', error);
            showError('Failed to invert palette.');
        }
    }

    // Enhanced error display function
    function showError(message) {
        try {
            showModal(domElements, 'Error', '<div class="text-red-400">' + message + '</div>');
        } catch (error) {
            console.error('Error showing error message:', error);
            alert(message);
        }
    }

    // Enhanced event listener setup function
    function setupEventListeners() {
        try {
            if (domElements.uploadCard) {
                console.log('Setting up upload card click handler');
                domElements.uploadCard.onclick = function () {
                    console.log('Upload card clicked');
                    domElements.fileInput.click();
                };

                // Add drag and drop functionality with better error handling
                domElements.uploadCard.addEventListener('dragover', function (e) {
                    e.preventDefault();
                    domElements.uploadCard.classList.add('dragover');
                });

                domElements.uploadCard.addEventListener('dragleave', function (e) {
                    e.preventDefault();
                    domElements.uploadCard.classList.remove('dragover');
                });

                domElements.uploadCard.addEventListener('drop', function (e) {
                    e.preventDefault();
                    domElements.uploadCard.classList.remove('dragover');
                    const files = e.dataTransfer.files;
                    console.log('File dropped:', files);
                    if (files.length > 0) {
                        handleFile(files[0]);
                    }
                });
            } else {
                console.error('uploadCard element not found');
            }

            if (domElements.fileInput) {
                console.log('Setting up file input change handler');
                domElements.fileInput.onchange = function () {
                    console.log('File input changed:', domElements.fileInput.files);
                    if (domElements.fileInput.files.length) {
                        handleFile(domElements.fileInput.files[0]);
                    }
                };
            } else {
                console.error('fileInput element not found');
            }

            // Set up all other event listeners with error handling
            setupControlEventListeners();
        } catch (error) {
            console.error('Error setting up event listeners:', error);
            showError('Failed to set up user interface. Please refresh the page.');
        }
    }

    // Flag to prevent infinite loops when updating dimensions programmatically
    let isUpdatingDimensions = false;

    // Enhanced control event listeners setup
    function setupControlEventListeners() {
        try {
            if (domElements.numBandsInput) {
                domElements.numBandsInput.addEventListener('input', debounce(handleNumBandsChange, 250));
            }
            if (domElements.layerHeightInput) {
                domElements.layerHeightInput.addEventListener('input', () => {
                    // --- START NEW LOGIC ---
                    if (parseFloat(domElements.layerHeightInput.value) > 1) {
                        domElements.layerHeightInput.value = 1;
                    }
                    // --- END NEW LOGIC ---
                    handleSettingsChange();
                });
            }
            if (domElements.baseThicknessInput) {
                domElements.baseThicknessInput.addEventListener('input', () => {
                    // --- START NEW LOGIC ---
                    if (parseInt(domElements.baseThicknessInput.value, 10) > 20) {
                        domElements.baseThicknessInput.value = 20;
                    }
                    // --- END NEW LOGIC ---
                    handleSettingsChange();
                });
            }
            if (domElements.bandThicknessInput) {
                domElements.bandThicknessInput.addEventListener('input', () => {
                    // --- START NEW LOGIC ---
                    if (parseInt(domElements.bandThicknessInput.value, 10) > 20) {
                        domElements.bandThicknessInput.value = 20;
                    }
                    // --- END NEW LOGIC ---
                    handleSettingsChange();
                });
            }
            if (domElements.xSizeInput) {
                domElements.xSizeInput.addEventListener('input', function() {
                    // Prevent infinite loops when programmatically updating
                    if (isUpdatingDimensions) return;
                    
                    // Only limit maximum during typing (doesn't interfere with user input)
                    if (parseFloat(domElements.xSizeInput.value) > 500) {
                        domElements.xSizeInput.value = 500;
                    }
                    
                    const newX = parseFloat(domElements.xSizeInput.value);
                    
                    // If aspect ratio is locked, update Y proportionally
                    if (appState.isAspectRatioLocked && appState.aspectRatio && !isNaN(newX)) {
                        isUpdatingDimensions = true;
                        const newY = Math.round((newX / appState.aspectRatio) * 10) / 10;
                        domElements.ySizeInput.value = newY;
                        isUpdatingDimensions = false;
                    }
                    
                    // Update dimension display in real-time
                    updateDimensionDisplay(domElements.xSizeInput.value, domElements.ySizeInput.value);
                    handleSettingsChange();
                });
                
                // Validate minimum when user finishes editing
                domElements.xSizeInput.addEventListener('blur', function() {
                    if (parseFloat(domElements.xSizeInput.value) < 10 || isNaN(parseFloat(domElements.xSizeInput.value))) {
                        domElements.xSizeInput.value = 10;
                        // Update dimension display and trigger aspect ratio recalculation
                        updateDimensionDisplay(domElements.xSizeInput.value, domElements.ySizeInput.value);
                        handleSettingsChange();
                    }
                });
            }
            if (domElements.ySizeInput) {
                domElements.ySizeInput.addEventListener('input', function() {
                    // Prevent infinite loops when programmatically updating
                    if (isUpdatingDimensions) return;
                    
                    // Only limit maximum during typing (doesn't interfere with user input)
                    if (parseFloat(domElements.ySizeInput.value) > 500) {
                        domElements.ySizeInput.value = 500;
                    }
                    
                    const newY = parseFloat(domElements.ySizeInput.value);
                    
                    // If aspect ratio is locked, update X proportionally
                    if (appState.isAspectRatioLocked && appState.aspectRatio && !isNaN(newY)) {
                        isUpdatingDimensions = true;
                        const newX = Math.round((newY * appState.aspectRatio) * 10) / 10;
                        domElements.xSizeInput.value = newX;
                        isUpdatingDimensions = false;
                    }
                    
                    // Update dimension display in real-time
                    updateDimensionDisplay(domElements.xSizeInput.value, domElements.ySizeInput.value);
                    handleSettingsChange();
                });
                
                // Validate minimum when user finishes editing
                domElements.ySizeInput.addEventListener('blur', function() {
                    if (parseFloat(domElements.ySizeInput.value) < 10 || isNaN(parseFloat(domElements.ySizeInput.value))) {
                        domElements.ySizeInput.value = 10;
                        // Update dimension display and trigger aspect ratio recalculation
                        updateDimensionDisplay(domElements.xSizeInput.value, domElements.ySizeInput.value);
                        handleSettingsChange();
                    }
                });
            }
            if (domElements.layerSlider) {
                domElements.layerSlider.addEventListener('input', function () {
                    domElements.layerValue.textContent =
                        parseInt(domElements.layerSlider.value, 10) + 1;
                    handleSettingsChange();
                });
            }
            if (domElements.singleLayerToggle) {
                domElements.singleLayerToggle.addEventListener('change', handleSettingsChange);
            }
            if (domElements.aspectRatioLockBtn) {
                domElements.aspectRatioLockBtn.onclick = function() {
                    // Toggle the aspect ratio lock state
                    appState.isAspectRatioLocked = !appState.isAspectRatioLocked;
                    
                    // Update the button icon
                    const icon = domElements.aspectRatioLockBtn.querySelector('.material-icons');
                    if (icon) {
                        icon.textContent = appState.isAspectRatioLocked ? 'link' : 'link_off';
                    }
                };
            }
            if (domElements.addFilamentBtn) {
                domElements.addFilamentBtn.onclick = addFilament;
            }
            if (domElements.suggestedPaletteBtn) {
                domElements.suggestedPaletteBtn.onclick = function () {
                    appState.activePalette = 'suggested';
                    domElements.suggestedPaletteBtn.className =
                        'px-3 py-1 text-sm font-medium rounded-md bg-indigo-600 text-white';
                    domElements.myPaletteBtn.className =
                        'px-3 py-1 text-sm font-medium rounded-md text-gray-300 hover:bg-gray-700';
                    updatePalette();
                };
            }
            if (domElements.myPaletteBtn) {
                domElements.myPaletteBtn.onclick = function () {
                    appState.activePalette = 'my';
                    domElements.myPaletteBtn.className =
                        'px-3 py-1 text-sm font-medium rounded-md bg-indigo-600 text-white';
                    domElements.suggestedPaletteBtn.className =
                        'px-3 py-1 text-sm font-medium rounded-md text-gray-300 hover:bg-gray-700';
                    updatePalette();
                };
            }
            if (domElements.invertPaletteBtn) {
                domElements.invertPaletteBtn.onclick = invertPalette;
            }
            if (domElements.instructionsBtn) {
                domElements.instructionsBtn.onclick = function () {
                    showSlicerInstructions(appState, domElements);
                };
            }
            if (domElements.modalCloseBtn) {
                domElements.modalCloseBtn.onclick = function () {
                    hideModal(domElements);
                };
            }
            if (domElements.exportBtn) {
                domElements.exportBtn.onclick = function () {
                    try {
                        const blob = generateStl(appState, domElements);
                        if (blob && typeof URL !== 'undefined' && URL.createObjectURL) {
                            const downloadLink = document.createElement('a');
                            downloadLink.href = URL.createObjectURL(blob);
                            downloadLink.download = 'colorstack.stl';
                            downloadLink.click();
                            URL.revokeObjectURL(downloadLink.href);
                        } else {
                            showError('Download not supported in this browser.');
                        }
                    } catch (error) {
                        console.error('Error exporting STL:', error);
                        showError('Failed to export STL file. Please try again.');
                    }
                };
            }
            if (domElements.newImageBtn) {
                domElements.newImageBtn.onclick = function () {
                    try {
                        resetApp(domElements);
                        appState.img = null;
                        appState.bandMap = null;
                        appState.suggestedPalette = [];
                        appState.activePalette = 'suggested';
                        domElements.suggestedPaletteBtn.className =
                            'px-3 py-1 text-sm font-medium rounded-md bg-indigo-600 text-white';
                        domElements.myPaletteBtn.className =
                            'px-3 py-1 text-sm font-medium rounded-md text-gray-300 hover:bg-gray-700';
                    } catch (error) {
                        console.error('Error resetting app:', error);
                        showError('Failed to reset application. Please refresh the page.');
                    }
                };
            }
        } catch (error) {
            console.error('Error setting up control event listeners:', error);
            showError('Failed to set up controls. Please refresh the page.');
        }
    }

    // Initialize modules and start the application
    async function initializeApp() {
        try {
            // Initialize DOM elements first (needed for UI state management)
            domElements = {
                spinner: document.getElementById('spinner'),
                uploadArea: document.getElementById('uploadArea'),
                uploadCard: document.getElementById('uploadCard'),
                mainContent: document.getElementById('mainContent'),
                app: document.getElementById('app'),
                fileInput: document.getElementById('fileInput'),
                origCanvas: document.getElementById('origCanvas'),
                procCanvas: document.getElementById('procCanvas'),
                paletteDiv: document.getElementById('palette'),
                numBandsInput: document.getElementById('numBands'),
                numBandsValue: document.getElementById('numBandsValue'),
                layerHeightInput: document.getElementById('layerHeight'),
                bandThicknessInput: document.getElementById('bandThickness'),
                baseThicknessInput: document.getElementById('baseThickness'),
                xSizeInput: document.getElementById('xSize'),
                ySizeInput: document.getElementById('ySize'),
                aspectRatioLockBtn: document.getElementById('aspectRatioLockBtn'),
                layerSlider: document.getElementById('layerSlider'),
                layerValue: document.getElementById('layerValue'),
                maxLayers: document.getElementById('maxLayers'),
                singleLayerToggle: document.getElementById('singleLayerToggle'),
                exportBtn: document.getElementById('exportBtn'),
                newImageBtn: document.getElementById('newImageBtn'),
                instructionsBtn: document.getElementById('instructionsBtn'),
                suggestedPaletteBtn: document.getElementById('suggestedPaletteBtn'),
                myPaletteBtn: document.getElementById('myPaletteBtn'),
                invertPaletteBtn: document.getElementById('invertPaletteBtn'),
                addFilamentBtn: document.getElementById('addFilamentBtn'),
                myFilamentsList: document.getElementById('myFilamentsList'),
                modal: document.getElementById('modal'),
                modalTitle: document.getElementById('modalTitle'),
                modalBody: document.getElementById('modalBody'),
                modalCloseBtn: document.getElementById('modalCloseBtn'),
            };

            // Make domElements globally accessible for worker
            window.domElements = domElements;

            // Initialize app state
            appState = {
                img: null,
                bandMap: null,
                origCanvas: domElements.origCanvas,
                myFilaments: [],
                suggestedPalette: [],
                currentPalette: [],
                activePalette: 'suggested',
                isInitialLoad: true, // Flag for stabilizing refresh
                isAspectRatioLocked: true, // Aspect ratio lock enabled by default
                aspectRatio: 1, // Default aspect ratio (1:1)
            };

            // Make appState globally accessible for the color picker
            window.appState = appState;

            // Gate User Interaction until Ready
            if (domElements.fileInput) {
                domElements.fileInput.disabled = true;
            }
            if (domElements.uploadCard) {
                domElements.uploadCard.style.cursor = 'wait';
            }

            // Create promises for initialization
            const isNtcReady = loadExternalScript('https://cdn.jsdelivr.net/npm/ntc@0.0.1/ntc.min.js')
                .catch(error => {
                    console.warn('Failed to load ntc.js library:', error);
                    // Don't reject the promise, just log the warning
                    // The app will still work with fallback naming
                });

            const isWorkerReady = new Promise(resolve => {
                if (window.Worker) {
                    try {
                        imageWorker = new Worker('js/image_worker.js');

                        // Set up worker message handler - unified handler for all message types
                        imageWorker.onmessage = function (e) {
                            const { type, data } = e.data;

                            // Show a spinner ONLY when starting a task, and hide it on any response.
                            if (type !== 'worker_ready') {
                                domElements.spinner.style.display = 'none';
                            }

                            switch (type) {
                                case 'worker_ready':
                                    console.log('Image worker is ready.');
                                    resolve(true); // Resolves the isWorkerReady promise
                                    break;

                                case 'palette_generated':
                                    appState.suggestedPalette = data.suggestedPalette;
                                    updatePalette(); // This will trigger the call to process the image
                                    break;

                                case 'image_processed':
                                    if (data.bandMap && data.previewImageData) {
                                        appState.bandMap = new Float32Array(data.bandMap);
                                        const previewImage = new ImageData(
                                            new Uint8ClampedArray(data.previewImageData.data),
                                            data.previewImageData.width,
                                            data.previewImageData.height
                                        );
                                        domElements.procCanvas
                                            .getContext('2d')
                                            .putImageData(previewImage, 0, 0);
                                    } else {
                                        showError('Image processing failed to return valid data.');
                                    }

                                    // Stabilizing refresh logic
                                    if (appState.isInitialLoad) {
                                        appState.isInitialLoad = false;
                                        setTimeout(() => {
                                            handleSettingsChange();
                                        }, 50);
                                    }

                                    // Force canvas redraw after a delay to ensure browser stability
                                    setTimeout(() => {
                                        console.log('Forcing canvas redraw...');

                                        // 1. Redraw the original image
                                        const origCanvas = document.getElementById('origCanvas');
                                        if (origCanvas && appState.img) {
                                            const context = origCanvas.getContext('2d');
                                            // Ensure canvas dimensions are still correct before drawing
                                            if (
                                                origCanvas.width !== appState.img.width ||
                                                origCanvas.height !== appState.img.height
                                            ) {
                                                origCanvas.width = appState.img.width;
                                                origCanvas.height = appState.img.height;
                                            }
                                            context.drawImage(
                                                appState.img,
                                                0,
                                                0,
                                                origCanvas.width,
                                                origCanvas.height
                                            );
                                        }

                                        // 2. Redraw the processed preview
                                        const procCanvas = document.getElementById('procCanvas');
                                        if (procCanvas && data.previewImageData) {
                                            const previewImage = new ImageData(
                                                new Uint8ClampedArray(
                                                    data.previewImageData.data.buffer.slice(0)
                                                ),
                                                data.previewImageData.width,
                                                data.previewImageData.height
                                            );
                                            procCanvas
                                                .getContext('2d')
                                                .putImageData(previewImage, 0, 0);
                                        }
                                    }, 100); // 100ms delay to ensure the browser is stable
                                    break;

                                case 'error':
                                    showError(
                                        data.message || 'An unknown error occurred in the worker.'
                                    );
                                    break;

                                default:
                                    console.warn('Unknown message type from worker:', type);
                                    break;
                            }
                        };

                        // Set up worker error handler
                        imageWorker.onerror = function (error) {
                            console.error('Worker error:', error);
                            showError('Image processing failed. Please try again.');
                            if (window.domElements && window.domElements.spinner) {
                                window.domElements.spinner.style.display = 'none';
                            }
                        };

                        // Send init message to worker
                        imageWorker.postMessage({ type: 'init' });

                        console.log('Web Worker initialized successfully');
                    } catch (workerError) {
                        console.warn(
                            'Failed to initialize Web Worker, falling back to synchronous processing:',
                            workerError
                        );
                        imageWorker = null;
                        resolve(true); // Resolve anyway to not block the app
                    }
                } else {
                    console.warn('Web Workers not supported, using synchronous processing');
                    imageWorker = null;
                    resolve(true); // Resolve anyway to not block the app
                }
            });

            // Ensure the Service Worker is Active
            const isServiceWorkerReady = new Promise(resolve => {
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.ready
                        .then(registration => {
                            console.log('Service worker is active.');
                            resolve(true);
                        })
                        .catch(error => {
                            console.error('Service worker failed to become ready:', error);
                            resolve(true); // Resolve anyway to not block the app
                        });
                } else {
                    resolve(true); // No service worker, so we're "ready"
                }
            });

            // All functions are now consolidated in this file - no imports needed

            // All functions are now local to this scope - no need for imports
            // Make functions globally accessible for compatibility
            window.getSuggestedColors = getSuggestedColors;
            window.processImage = processImage;
            window.matchToPalette = matchToPalette;
            window.detectBackgroundColor = detectBackgroundColor;
            window.colorDistance = colorDistance;
            window.hexToRgb = hexToRgb;
            window.getLuminance = getLuminance;
            window.generateStl = generateStl;
            window.renderPalette = renderPalette;
            window.resetApp = resetApp;
            window.showApp = showApp;
            window.renderMyFilaments = renderMyFilaments;
            window.showModal = showModal;
            window.hideModal = hideModal;
            window.showMainContent = showMainContent;
            window.showUploadArea = showUploadArea;
            window.showHeaderButtons = showHeaderButtons;
            window.hideHeaderButtons = hideHeaderButtons;
            window.openCustomColorPicker = openCustomColorPicker;

            // Debug DOM elements
            console.log('DOM Elements found:', {
                uploadCard: !!domElements.uploadCard,
                fileInput: !!domElements.fileInput,
                uploadArea: !!domElements.uploadArea,
                mainContent: !!domElements.mainContent,
            });

            loadMyFilaments();

            // Hide header buttons initially since no image is loaded
            hideHeaderButtons(domElements);

            // Wait for worker, service worker, and ntc library to be ready
            Promise.all([isWorkerReady, isServiceWorkerReady, isNtcReady]).then(() => {
                console.log('Application is fully ready.');

                // Enable UI now that everything is ready
                if (domElements.fileInput) {
                    domElements.fileInput.disabled = false;
                }
                if (domElements.uploadCard) {
                    domElements.uploadCard.style.cursor = 'pointer';
                }

                // It's now safe to set up event listeners
                setupEventListeners();

                console.log('Application initialized successfully');
            });
        } catch (error) {
            console.error('Failed to initialize application:', error);
            document.body.innerHTML =
                '<div style="text-align: center; padding: 50px; color: #E0E0E0;"><h1>Browser Compatibility Issue</h1><p>Your browser does not support the required features for ColorStack. Please use a modern browser like Chrome, Firefox, Safari, or Edge.</p></div>';
        }
    }

    // Enhanced window load function with better error handling
    window.onload = function () {
        console.log('Window loaded, initializing application');
        initializeApp();
    };

    function openFilamentModal(filamentId = null) {
        // Determine if we're in add or edit mode
        const isEditMode = filamentId !== null;
        const filament = isEditMode ? appState.myFilaments.find(f => f.id === filamentId) : null;
        
        // Prepare form data
        const name = isEditMode ? filament.name : '';
        const type = isEditMode ? filament.type : 'PLA';
        const color = isEditMode ? filament.color : '#ff0000';
        
        // Create modal content
        const modalContent = `
            <div class="space-y-4">
                <div>
                    <label for="filamentName" class="block text-sm font-medium text-gray-300 mb-2">
                        Filament Name
                    </label>
                    <input 
                        type="text" 
                        id="filamentName" 
                        value="${name}"
                        class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter filament name"
                    >
                </div>
                
                <div>
                    <label for="filamentType" class="block text-sm font-medium text-gray-300 mb-2">
                        Filament Type
                    </label>
                    <select 
                        id="filamentType" 
                        class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="PLA" ${type === 'PLA' ? 'selected' : ''}>PLA</option>
                        <option value="PETG" ${type === 'PETG' ? 'selected' : ''}>PETG</option>
                        <option value="ABS" ${type === 'ABS' ? 'selected' : ''}>ABS</option>
                        <option value="ASA" ${type === 'ASA' ? 'selected' : ''}>ASA</option>
                        <option value="TPU" ${type === 'TPU' ? 'selected' : ''}>TPU</option>
                    </select>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">
                        Filament Color
                    </label>
                    <div class="flex items-center space-x-3">
                        <div 
                            id="colorPreview" 
                            class="w-10 h-10 rounded-full border-2 border-gray-600 cursor-pointer"
                            style="background-color: ${color};"
                        ></div>
                        <input 
                            type="text" 
                            id="colorInput" 
                            value="${color}"
                            class="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="#ff0000"
                        >
                    </div>
                </div>
                
                <div class="flex justify-end space-x-3 pt-4">
                    <button 
                        id="cancelBtn"
                        class="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors duration-200"
                    >
                        Cancel
                    </button>
                    <button 
                        id="saveBtn"
                        class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors duration-200"
                    >
                        ${isEditMode ? 'Update' : 'Add'} Filament
                    </button>
                </div>
            </div>
        `;
        
        // Show the modal
        showModal(domElements, isEditMode ? 'Edit Filament' : 'Add New Filament', modalContent);
        
        // Function to set up event listeners for the filament modal
        function setupFilamentModalEventListeners() {
            const nameInput = document.getElementById('filamentName');
            const typeSelect = document.getElementById('filamentType');
            const colorInput = document.getElementById('colorInput');
            const colorPreview = document.getElementById('colorPreview');
            const saveBtn = document.getElementById('saveBtn');
            const cancelBtn = document.getElementById('cancelBtn');
            
            // Color picker functionality with state restoration
            if (colorPreview) {
                colorPreview.onclick = () => {
                    // Save the current modal state before opening color picker
                    const savedModalHTML = domElements.modalBody.innerHTML;
                    
                    openCustomColorPicker(
                        colorInput.value,
                        (selectedColor) => {
                            // Restore the modal HTML
                            domElements.modalBody.innerHTML = savedModalHTML;
                            
                            // Re-query DOM elements after restoration
                            const restoredColorInput = document.getElementById('colorInput');
                            const restoredColorPreview = document.getElementById('colorPreview');
                            
                            // Update the color input and preview with the new color
                            if (restoredColorInput) {
                                restoredColorInput.value = selectedColor;
                            }
                            if (restoredColorPreview) {
                                restoredColorPreview.style.backgroundColor = selectedColor;
                            }
                            
                            // Re-attach all event listeners
                            setupFilamentModalEventListeners();
                        },
                        true
                    );
                };
            }
            
            // Color input change handler
            if (colorInput) {
                colorInput.oninput = () => {
                    const newColor = colorInput.value;
                    if (isValidHexColor(newColor)) {
                        colorPreview.style.backgroundColor = newColor;
                    }
                };
            }
            
            // Save button handler
            if (saveBtn) {
                saveBtn.onclick = () => {
                    let newName = nameInput.value.trim();
                    const newType = typeSelect.value;
                    const newColor = colorInput.value.trim();
                    
                    // Smart naming: If name is empty, generate one from the color
                    if (!newName && !isEditMode) {
                        // First, check if the ntc library has loaded and is available on the window
                        if (window.ntc) {
                            try {
                                // The ntc.name function returns an array: [matchedHex, name, exactMatchBoolean]
                                const match = window.ntc.name(newColor);
                                newName = match[1]; // The second item is the human-readable name
                                
                                // Check if the name contains a slash and take the first part if it does.
                                if (newName.includes(' / ')) {
                                    newName = newName.split(' / ')[0];
                                }
                            } catch (e) {
                                console.warn('The ntc.js library failed to find a name. Using fallback.', e);
                                newName = `New Filament ${newColor}`;
                            }
                        } else {
                            // This is the fallback if the ntc library hasn't loaded for any reason
                            console.warn('ntc.js library not found. Using fallback name.');
                            newName = `New Filament ${newColor}`;
                        }
                    }
                    
                    // Validation
                    if (!newName) {
                        showError('Please enter a filament name.');
                        return;
                    }
                    
                    if (!isValidHexColor(newColor)) {
                        showError('Please enter a valid hex color (e.g., #ff0000).');
                        return;
                    }
                    
                    // Check for duplicate colors (except in edit mode for the same filament)
                    const existingFilament = appState.myFilaments.find(f => 
                        f.color === newColor && (!isEditMode || f.id !== filamentId)
                    );
                    if (existingFilament) {
                        showError('This color is already in your filaments!');
                        return;
                    }
                    
                    try {
                        if (isEditMode) {
                            // Update existing filament
                            const filamentToUpdate = appState.myFilaments.find(f => f.id === filamentId);
                            if (filamentToUpdate) {
                                filamentToUpdate.name = newName;
                                filamentToUpdate.type = newType;
                                filamentToUpdate.color = newColor;
                            }
                        } else {
                            // Check filament limit
                            if (appState.myFilaments.length >= 16) {
                                showError('You can only have up to 16 filaments. Please remove some before adding new ones.');
                                return;
                            }
                            
                            // Create new filament
                            const newFilament = {
                                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                                name: newName,
                                type: newType,
                                color: newColor
                            };
                            appState.myFilaments.push(newFilament);
                        }
                        
                        // Save and update UI
                        saveMyFilaments();
                        renderMyFilaments(appState.myFilaments, domElements.myFilamentsList, removeFilament, openFilamentModal);
                        if (appState.activePalette === 'my') updatePalette();
                        hideModal(domElements);
                        
                    } catch (error) {
                        console.error('Error saving filament:', error);
                        showError('Failed to save filament. Please try again.');
                    }
                };
            }
            
            // Cancel button handler
            if (cancelBtn) {
                cancelBtn.onclick = () => {
                    hideModal(domElements);
                };
            }
        }
        
        // Set up event listeners after modal is shown
        setTimeout(() => {
            setupFilamentModalEventListeners();
            
            // Focus on name input
            const nameInput = document.getElementById('filamentName');
            if (nameInput) {
                nameInput.focus();
            }
        }, 100);
    }
})();
