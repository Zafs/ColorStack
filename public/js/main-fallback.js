// Fallback version for browsers without ES6 module support
(function () {
    'use strict';

    // Global variables
    let domElements;
    let appState;

    // Color processing functions (simplified versions)
    function hexToRgb(hex) {
        const v = parseInt(hex.slice(1), 16);
        return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
    }

    function rgbToHex(r, g, b) {
        return (
            '#' +
            [r, g, b]
                .map(function (v) {
                    return Math.round(v).toString(16).padStart(2, '0');
                })
                .join('')
        );
    }

    function getLuminance(hex) {
        const rgb = hexToRgb(hex);
        return 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
    }

    function colorDistance(c1, c2) {
        const rDiff = c1[0] - c2[0];
        const gDiff = c1[1] - c2[1];
        const bDiff = c1[2] - c2[2];
        return rDiff * rDiff + gDiff * gDiff + bDiff * bDiff;
    }

    function detectBackgroundColor(imageData, width, height) {
        const colorCounts = {};

        // Sample pixels along the border
        for (let x = 0; x < width; x++) {
            const topIndex = (x + 0 * width) * 4;
            const topColor = [
                imageData[topIndex],
                imageData[topIndex + 1],
                imageData[topIndex + 2],
            ];
            const topKey = topColor.join(',');
            colorCounts[topKey] = (colorCounts[topKey] || 0) + 1;

            const bottomIndex = (x + (height - 1) * width) * 4;
            const bottomColor = [
                imageData[bottomIndex],
                imageData[bottomIndex + 1],
                imageData[bottomIndex + 2],
            ];
            const bottomKey = bottomColor.join(',');
            colorCounts[bottomKey] = (colorCounts[bottomKey] || 0) + 1;
        }

        for (let y = 1; y < height - 1; y++) {
            const leftIndex = (0 + y * width) * 4;
            const leftColor = [
                imageData[leftIndex],
                imageData[leftIndex + 1],
                imageData[leftIndex + 2],
            ];
            const leftKey = leftColor.join(',');
            colorCounts[leftKey] = (colorCounts[leftKey] || 0) + 1;

            const rightIndex = (width - 1 + y * width) * 4;
            const rightColor = [
                imageData[rightIndex],
                imageData[rightIndex + 1],
                imageData[rightIndex + 2],
            ];
            const rightKey = rightColor.join(',');
            colorCounts[rightKey] = (colorCounts[rightKey] || 0) + 1;
        }

        let maxCount = 0;
        let mostFrequentColor = [0, 0, 0];

        for (const colorKey in colorCounts) {
            if (colorCounts[colorKey] > maxCount) {
                maxCount = colorCounts[colorKey];
                mostFrequentColor = colorKey.split(',').map(Number);
            }
        }

        return mostFrequentColor;
    }

    function getSuggestedColors(imageData, bands) {
        // Simplified color extraction - just sample colors from the image
        const colors = [];
        const step = Math.floor(imageData.length / (bands * 4));

        for (let i = 0; i < bands; i++) {
            const index = i * step * 4;
            const r = imageData[index];
            const g = imageData[index + 1];
            const b = imageData[index + 2];
            colors.push(rgbToHex(r, g, b));
        }

        return colors;
    }

    function matchToPalette(suggestedPalette, myFilaments) {
        if (!myFilaments || myFilaments.length === 0) return suggestedPalette;

        const filamentRgb = myFilaments.map(function (color) {
            const rgb = hexToRgb(color);
            return [rgb.r, rgb.g, rgb.b];
        });

        const matchedPalette = [];

        for (let i = 0; i < suggestedPalette.length; i++) {
            const suggestedRgb = hexToRgb(suggestedPalette[i]);
            const suggestedColorArray = [suggestedRgb.r, suggestedRgb.g, suggestedRgb.b];

            let minDistance = Infinity;
            let bestMatch = suggestedPalette[i];

            for (let j = 0; j < filamentRgb.length; j++) {
                const distance = colorDistance(suggestedColorArray, filamentRgb[j]);
                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = myFilaments[j];
                }
            }

            matchedPalette.push(bestMatch);
        }

        return matchedPalette;
    }

    function processImage(appState, domElements) {
        const img = appState.img;
        const origCanvas = domElements.origCanvas;
        const procCanvas = domElements.procCanvas;
        const layerSlider = domElements.layerSlider;

        if (!img) return null;

        const context = origCanvas.getContext('2d');
        context.drawImage(img, 0, 0, origCanvas.width, origCanvas.height);

        const imageData = context.getImageData(0, 0, origCanvas.width, origCanvas.height);
        const data = imageData.data;

        const currentLayer = parseInt(layerSlider.value, 10);
        const suggestedPalette = appState.suggestedPalette || [];
        const currentPalette = appState.currentPalette || suggestedPalette;

        if (suggestedPalette.length === 0) return null;

        const bandMap = new Float32Array(data.length / 4);

        // Create band map
        for (let i = 0, j = 0; i < data.length; i += 4, j++) {
            const pixelColor = [data[i], data[i + 1], data[i + 2]];

            let minDistance = Infinity;
            let bandIndex = 0;

            for (let k = 0; k < suggestedPalette.length; k++) {
                const rgb = hexToRgb(suggestedPalette[k]);
                const paletteColor = [rgb.r, rgb.g, rgb.b];
                const distance = colorDistance(pixelColor, paletteColor);

                if (distance < minDistance) {
                    minDistance = distance;
                    bandIndex = k;
                }
            }

            bandMap[j] = bandIndex;
        }

        // Create preview
        const baseColor = hexToRgb(currentPalette[0]);
        const previewImageData = context.createImageData(origCanvas.width, origCanvas.height);
        const previewData = previewImageData.data;

        for (let i = 0; i < previewData.length; i += 4) {
            previewData[i] = baseColor.r;
            previewData[i + 1] = baseColor.g;
            previewData[i + 2] = baseColor.b;
            previewData[i + 3] = 255;
        }

        // Draw layers
        for (let layer = 1; layer <= currentLayer; layer++) {
            for (let i = 0, j = 0; i < previewData.length; i += 4, j++) {
                if (bandMap[j] === layer) {
                    const rgb = hexToRgb(currentPalette[layer]);
                    previewData[i] = rgb.r;
                    previewData[i + 1] = rgb.g;
                    previewData[i + 2] = rgb.b;
                    previewData[i + 3] = 255;
                }
            }
        }

        procCanvas.getContext('2d').putImageData(previewImageData, 0, 0);
        return bandMap;
    }

    function generateStl(appState, domElements) {
        const bandMap = appState.bandMap;
        const origCanvas = appState.origCanvas;
        const layerHeightInput = domElements.layerHeightInput;
        const xSizeInput = domElements.xSizeInput;
        const ySizeInput = domElements.ySizeInput;
        const bandThicknessInput = domElements.bandThicknessInput;
        const baseThicknessInput = domElements.baseThicknessInput;
        const numBandsInput = domElements.numBandsInput;

        const singleLayerHeight = parseFloat(layerHeightInput.value);
        const additionalBandLayers = parseInt(bandThicknessInput.value, 10);
        const baseThicknessInLayers = parseInt(baseThicknessInput.value, 10);
        const numBands = parseInt(numBandsInput.value, 10);

        const modelWidth = parseFloat(xSizeInput.value);
        const modelDepth = parseFloat(ySizeInput.value);
        const imageWidth = origCanvas.width;
        const imageHeight = origCanvas.height;

        const dx = modelWidth / (imageWidth - 1);
        const dy = modelDepth / (imageHeight - 1);

        const bandHeights = new Array(numBands);
        bandHeights[0] = baseThicknessInLayers * singleLayerHeight;
        for (let i = 1; i < numBands; i++) {
            bandHeights[i] = bandHeights[i - 1] + additionalBandLayers * singleLayerHeight;
        }

        const vertices = [];
        const faces = [];
        const topVertices = new Array(imageWidth * imageHeight);
        const bottomVertices = new Array(imageWidth * imageHeight);

        for (let j = 0; j < imageHeight; j++) {
            for (let i = 0; i < imageWidth; i++) {
                const x = i * dx;
                const y = j * dy;
                const pixelIndex = j * imageWidth + i;

                bottomVertices[pixelIndex] = vertices.length;
                vertices.push([x, y, 0]);

                const bandMapIndex = (imageHeight - 1 - j) * imageWidth + i;
                const band = bandMap[bandMapIndex];
                const height = bandHeights[band] || 0;
                topVertices[pixelIndex] = vertices.length;
                vertices.push([x, y, height]);
            }
        }

        // Generate faces
        for (let j = 0; j < imageHeight - 1; j++) {
            for (let i = 0; i < imageWidth - 1; i++) {
                const v00_t = topVertices[j * imageWidth + i];
                const v10_t = topVertices[j * imageWidth + i + 1];
                const v01_t = topVertices[(j + 1) * imageWidth + i];
                const v11_t = topVertices[(j + 1) * imageWidth + i + 1];

                faces.push([v00_t, v10_t, v11_t]);
                faces.push([v00_t, v11_t, v01_t]);

                const v00_b = bottomVertices[j * imageWidth + i];
                const v10_b = bottomVertices[j * imageWidth + i + 1];
                const v01_b = bottomVertices[(j + 1) * imageWidth + i];
                const v11_b = bottomVertices[(j + 1) * imageWidth + i + 1];
                faces.push([v00_b, v11_b, v10_b]);
                faces.push([v00_b, v01_b, v11_b]);
            }
        }

        // Create STL binary
        const buffer = new ArrayBuffer(84 + faces.length * 50);
        const writer = new DataView(buffer);
        writer.setUint32(80, faces.length, true);

        let offset = 84;
        for (let f = 0; f < faces.length; f++) {
            const face = faces[f];
            const v1 = vertices[face[0]];
            const v2 = vertices[face[1]];
            const v3 = vertices[face[2]];

            const ux = v2[0] - v1[0],
                uy = v2[1] - v1[1],
                uz = v2[2] - v1[2];
            const vx = v3[0] - v1[0],
                vy = v3[1] - v1[1],
                vz = v3[2] - v1[2];

            const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
            const len = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]) || 1;
            const normalizedNormal = [n[0] / len, n[1] / len, n[2] / len];

            writer.setFloat32(offset, normalizedNormal[0], true);
            offset += 4;
            writer.setFloat32(offset, normalizedNormal[1], true);
            offset += 4;
            writer.setFloat32(offset, normalizedNormal[2], true);
            offset += 4;

            for (let v = 0; v < 3; v++) {
                const vertex = [v1, v2, v3][v];
                writer.setFloat32(offset, vertex[0], true);
                offset += 4;
                writer.setFloat32(offset, vertex[1], true);
                offset += 4;
                writer.setFloat32(offset, vertex[2], true);
                offset += 4;
            }

            offset += 2;
        }

        return new Blob([buffer], { type: 'application/octet-stream' });
    }

    // UI functions
    function renderPalette(colors, paletteDiv, onColorChange, readOnly) {
        paletteDiv.innerHTML = '';
        for (let i = 0; i < colors.length; i++) {
            const color = colors[i];
            const colorDiv = document.createElement('div');
            colorDiv.className = 'relative group cursor-pointer';

            const colorSwatch = document.createElement('div');
            colorSwatch.className =
                'w-8 h-8 rounded border-2 border-gray-600 hover:border-indigo-400 transition-all duration-200 hover:scale-110';
            colorSwatch.style.backgroundColor = color;

            if (!readOnly) {
                colorSwatch.addEventListener('click', function () {
                    openCustomColorPicker(color, function (newColor) {
                        colorSwatch.style.backgroundColor = newColor;
                        colors[i] = newColor;
                        if (window.appState) {
                            window.appState.currentPalette[i] = newColor;
                        }
                        if (onColorChange) {
                            onColorChange();
                        }
                    });
                });
            }

            const tooltip = document.createElement('div');
            tooltip.className =
                'tooltip -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity';
            tooltip.textContent = readOnly ? getColorName(color) : 'Click to change color';

            colorDiv.appendChild(colorSwatch);
            colorDiv.appendChild(tooltip);
            paletteDiv.appendChild(colorDiv);
        }
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

    function openCustomColorPicker(currentColor, onColorChange, isFilamentPicker) {
        const modalHTML =
            '<div class="space-y-6">' +
            '<div class="text-center">' +
            '<h3 class="text-lg font-semibold text-white mb-2">Choose Color</h3>' +
            '<p class="text-gray-400 text-sm">' +
            (isFilamentPicker
                ? 'Select a color for your new filament'
                : 'Select a color for your palette') +
            '</p>' +
            '</div>' +
            '<div class="space-y-4">' +
            '<div class="space-y-2">' +
            '<label class="text-sm text-gray-300">Choose Color</label>' +
            '<input type="color" id="nativeColorPicker" value="' +
            currentColor +
            '" class="w-full h-12 rounded border border-gray-600 cursor-pointer">' +
            '</div>' +
            '</div>' +
            '<div class="flex gap-3 pt-4">' +
            '<button id="cancelColorBtn" class="flex-1 px-4 py-2 bg-gray-600 text-gray-200 font-medium rounded-lg transition-all hover:bg-gray-500">Cancel</button>' +
            '<button id="confirmColorBtn" class="flex-1 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg transition-all hover:bg-indigo-700">Confirm</button>' +
            '</div>' +
            '</div>';

        showModal(domElements, 'Color Picker', modalHTML);

        let selectedColor = currentColor;
        const nativeColorPicker = document.getElementById('nativeColorPicker');
        const confirmBtn = document.getElementById('confirmColorBtn');
        const cancelBtn = document.getElementById('cancelColorBtn');

        if (nativeColorPicker) {
            nativeColorPicker.addEventListener('input', function (e) {
                selectedColor = e.target.value;
            });
        }

        if (confirmBtn) {
            confirmBtn.addEventListener('click', function () {
                onColorChange(selectedColor);
                hideModal(domElements);
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', function () {
                hideModal(domElements);
            });
        }
    }

    function renderMyFilaments(filaments, container, onRemove) {
        container.innerHTML = '';
        for (let i = 0; i < filaments.length; i++) {
            const color = filaments[i];
            const filamentDiv = document.createElement('div');
            filamentDiv.className = 'relative group flex flex-col items-center gap-2 has-tooltip';

            const spoolDiv = document.createElement('div');
            spoolDiv.className =
                'w-16 h-16 rounded-full flex items-center justify-center bg-gray-700 border-2 border-gray-600';

            const innerColor = document.createElement('div');
            innerColor.className = 'w-12 h-12 rounded-full';
            innerColor.style.backgroundColor = color;

            const centerHole = document.createElement('div');
            centerHole.className =
                'absolute w-6 h-6 bg-gray-800 rounded-full border-2 border-gray-600';

            const nameDiv = document.createElement('p');
            nameDiv.className = 'text-xs text-gray-300 text-center truncate w-full';
            nameDiv.textContent = getFilamentName(color);

            const removeBtn = document.createElement('button');
            removeBtn.className =
                'absolute top-0 right-0 p-1 bg-gray-800 rounded-full text-gray-400 hover:text-white hover:bg-red-500 opacity-0 group-hover:opacity-100 transition-opacity';
            const closeIcon = document.createElement('span');
            closeIcon.className = 'material-icons text-sm';
            closeIcon.textContent = 'close';
            removeBtn.appendChild(closeIcon);
            removeBtn.onclick = function (e) {
                e.stopPropagation();
                onRemove(i);
            };

            const tooltip = document.createElement('div');
            tooltip.className =
                'tooltip -bottom-5 px-2 py-1 bg-gray-900 text-white text-xs rounded';
            tooltip.textContent = 'Remove filament';

            spoolDiv.appendChild(innerColor);
            spoolDiv.appendChild(centerHole);
            filamentDiv.appendChild(spoolDiv);
            filamentDiv.appendChild(nameDiv);
            filamentDiv.appendChild(removeBtn);
            filamentDiv.appendChild(tooltip);

            container.appendChild(filamentDiv);
        }
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

    function showModal(domElements, title, contentHTML) {
        domElements.modalTitle.textContent = title;
        domElements.modalBody.innerHTML = contentHTML;
        domElements.modal.style.display = 'flex';
    }

    function hideModal(domElements) {
        domElements.modal.style.display = 'none';
    }

    function resetApp(domElements) {
        const uploadArea = domElements.uploadArea;
        const mainContent = domElements.mainContent;
        const origCanvas = domElements.origCanvas;
        const procCanvas = domElements.procCanvas;
        const paletteDiv = domElements.paletteDiv;
        const fileInput = domElements.fileInput;

        showUploadArea(domElements);
        origCanvas.getContext('2d').clearRect(0, 0, origCanvas.width, origCanvas.height);
        procCanvas.getContext('2d').clearRect(0, 0, procCanvas.width, procCanvas.height);
        paletteDiv.innerHTML = '';
        fileInput.value = '';
    }

    function showMainContent(domElements) {
        const uploadArea = domElements.uploadArea;
        const mainContent = domElements.mainContent;
        uploadArea.style.display = 'none';
        mainContent.classList.remove('hidden');
        showHeaderButtons(domElements);
    }

    function showUploadArea(domElements) {
        const uploadArea = domElements.uploadArea;
        const mainContent = domElements.mainContent;
        uploadArea.style.display = 'block';
        mainContent.classList.add('hidden');
        hideHeaderButtons(domElements);
    }

    function showHeaderButtons(domElements) {
        const instructionsBtn = domElements.instructionsBtn;
        const newImageBtn = domElements.newImageBtn;
        const exportBtn = domElements.exportBtn;
        if (instructionsBtn) instructionsBtn.style.display = 'flex';
        if (newImageBtn) newImageBtn.style.display = 'flex';
        if (exportBtn) exportBtn.style.display = 'flex';
    }

    function hideHeaderButtons(domElements) {
        const instructionsBtn = domElements.instructionsBtn;
        const newImageBtn = domElements.newImageBtn;
        const exportBtn = domElements.exportBtn;
        if (instructionsBtn) instructionsBtn.style.display = 'none';
        if (newImageBtn) newImageBtn.style.display = 'none';
        if (exportBtn) exportBtn.style.display = 'none';
    }

    // Main application functions
    function handleFile(file) {
        console.log('handleFile called with:', file);

        if (!file || !file.type) {
            showError('Invalid file selected');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            showError('File size too large. Please select a file smaller than 10MB.');
            return;
        }

        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/bmp'];
        if (allowedTypes.indexOf(file.type) === -1) {
            showError('Invalid file type. Please select a PNG, JPEG, or BMP file.');
            return;
        }

        try {
            loadImage(file);
            showMainContent(domElements);
        } catch (error) {
            console.error('Error handling file:', error);
            showError('Failed to load image. Please try again.');
        }
    }

    function loadImage(file) {
        console.log('loadImage called with:', file);

        if (typeof FileReader === 'undefined') {
            showError('File reading is not supported in this browser.');
            return;
        }

        const reader = new FileReader();

        reader.onload = function (event) {
            console.log('FileReader onload triggered');

            if (typeof Image === 'undefined') {
                showError('Image processing is not supported in this browser.');
                return;
            }

            appState.img = new Image();

            appState.img.onload = function () {
                console.log('Image loaded successfully');
                try {
                    handleNumBandsChange();
                } catch (error) {
                    console.error('Error processing image:', error);
                    showError('Failed to process image. Please try a different image.');
                }
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

    function handleSettingsChange() {
        if (!appState.img) return;

        try {
            appState.bandMap = processImage(appState, domElements);
        } catch (error) {
            console.error('Error processing image settings:', error);
            showError('Failed to update preview. Please try again.');
        }
    }

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

            const data = imageData.data;
            appState.suggestedPalette = getSuggestedColors(data, numBands);

            const backgroundColor = detectBackgroundColor(data, img.width, img.height);

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

            if (closestIndex > 0) {
                const baseColor = appState.suggestedPalette[closestIndex];
                appState.suggestedPalette.splice(closestIndex, 1);
                appState.suggestedPalette.unshift(baseColor);
            }

            if (appState.suggestedPalette.length > 1) {
                const remainingColors = appState.suggestedPalette.slice(1);
                remainingColors.sort(function (a, b) {
                    return getLuminance(a) - getLuminance(b);
                });
                appState.suggestedPalette = [appState.suggestedPalette[0]].concat(remainingColors);
            }

            updatePalette();
        } catch (error) {
            console.error('Error in handleNumBandsChange:', error);
            showError('Failed to process image. Please try again.');
        }
    }

    function updatePalette() {
        if (!appState.img) return;

        try {
            const paletteDiv = domElements.paletteDiv;

            if (appState.activePalette === 'my') {
                const matchedPalette = matchToPalette(
                    appState.suggestedPalette,
                    appState.myFilaments
                );
                appState.currentPalette = matchedPalette.slice();
                renderPalette(appState.currentPalette, paletteDiv, handleSettingsChange, false);
            } else {
                appState.currentPalette = appState.suggestedPalette.slice();
                renderPalette(appState.currentPalette, paletteDiv, handleSettingsChange, false);
            }
            handleSettingsChange();
        } catch (error) {
            console.error('Error updating palette:', error);
            showError('Failed to update color palette.');
        }
    }

    function showError(message) {
        try {
            showModal(domElements, 'Error', '<div class="text-red-400">' + message + '</div>');
        } catch (error) {
            console.error('Error showing error message:', error);
            alert(message);
        }
    }

    // Initialize the application
    window.onload = function () {
        console.log('Window loaded, setting up event listeners (fallback version)');

        try {
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

            appState = {
                img: null,
                bandMap: null,
                origCanvas: domElements.origCanvas,
                myFilaments: [],
                suggestedPalette: [],
                currentPalette: [],
                activePalette: 'suggested',
            };

            window.appState = appState;

            console.log('DOM Elements found:', {
                uploadCard: !!domElements.uploadCard,
                fileInput: !!domElements.fileInput,
                uploadArea: !!domElements.uploadArea,
                mainContent: !!domElements.mainContent,
            });

            loadMyFilaments();
            hideHeaderButtons(domElements);
            setupEventListeners();
        } catch (error) {
            console.error('Error during initialization:', error);
            showError('Failed to initialize application. Please refresh the page.');
        }
    };

    function loadMyFilaments() {
        try {
            const saved = localStorage.getItem('myFilaments');
            if (saved) {
                appState.myFilaments = JSON.parse(saved);
                renderMyFilaments(
                    appState.myFilaments,
                    domElements.myFilamentsList,
                    removeFilament
                );
            }
        } catch (error) {
            console.error('Failed to load filaments:', error);
            appState.myFilaments = [];
        }
    }

    function saveMyFilaments() {
        try {
            localStorage.setItem('myFilaments', JSON.stringify(appState.myFilaments));
        } catch (error) {
            console.error('Failed to save filaments:', error);
            showError('Failed to save your filaments. Please try again.');
        }
    }

    function removeFilament(indexToRemove) {
        try {
            appState.myFilaments.splice(indexToRemove, 1);
            saveMyFilaments();
            renderMyFilaments(appState.myFilaments, domElements.myFilamentsList, removeFilament);
            if (appState.activePalette === 'my') updatePalette();
        } catch (error) {
            console.error('Error removing filament:', error);
            showError('Failed to remove filament. Please try again.');
        }
    }

    function setupEventListeners() {
        try {
            if (domElements.uploadCard) {
                console.log('Setting up upload card click handler');
                domElements.uploadCard.onclick = function () {
                    console.log('Upload card clicked');
                    domElements.fileInput.click();
                };

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

            setupControlEventListeners();
        } catch (error) {
            console.error('Error setting up event listeners:', error);
            showError('Failed to set up user interface. Please refresh the page.');
        }
    }

    function setupControlEventListeners() {
        try {
            if (domElements.numBandsInput) {
                domElements.numBandsInput.addEventListener('input', handleNumBandsChange);
            }
            if (domElements.layerHeightInput) {
                domElements.layerHeightInput.addEventListener('input', handleSettingsChange);
            }
            if (domElements.baseThicknessInput) {
                domElements.baseThicknessInput.addEventListener('input', handleSettingsChange);
            }
            if (domElements.bandThicknessInput) {
                domElements.bandThicknessInput.addEventListener('input', handleSettingsChange);
            }
            if (domElements.xSizeInput) {
                domElements.xSizeInput.addEventListener('input', handleSettingsChange);
            }
            if (domElements.ySizeInput) {
                domElements.ySizeInput.addEventListener('input', handleSettingsChange);
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
                domElements.instructionsBtn.onclick = showSlicerInstructions;
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

    function addFilament() {
        if (appState.myFilaments.length >= 16) {
            showModal(
                domElements,
                'Maximum Filaments',
                'You can only have up to 16 filaments. Please remove some before adding new ones.'
            );
            return;
        }

        openCustomColorPicker(
            '#ff0000',
            function (selectedColor) {
                addFilamentWithColor(selectedColor);
            },
            true
        );
    }

    function addFilamentWithColor(color) {
        try {
            if (appState.myFilaments.indexOf(color) === -1) {
                appState.myFilaments.push(color);
                saveMyFilaments();
                renderMyFilaments(
                    appState.myFilaments,
                    domElements.myFilamentsList,
                    removeFilament
                );
                if (appState.activePalette === 'my') updatePalette();
                hideModal(domElements);
            } else {
                showError('This color is already in your filaments!');
            }
        } catch (error) {
            console.error('Error adding filament:', error);
            showError('Failed to add filament. Please try again.');
        }
    }

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

    function showSlicerInstructions() {
        try {
            const baseThicknessInput = domElements.baseThicknessInput;
            const bandThicknessInput = domElements.bandThicknessInput;

            const baseThickness = parseInt(baseThicknessInput.value, 10);
            const bandThickness = parseInt(bandThicknessInput.value, 10);

            const colors = appState.currentPalette || appState.suggestedPalette || [];

            let instructionsHTML = '<ul class="space-y-2">';
            for (let i = 0; i < colors.length; i++) {
                const color = colors[i];
                let text;
                if (i === 0) {
                    text = 'Start with this color (Base)';
                } else {
                    const startLayer = baseThickness + (i - 1) * bandThickness + 1;
                    text = 'Change to this color at Layer ' + startLayer;
                }
                instructionsHTML +=
                    '<li class="flex items-center gap-3"><div class="w-4 h-4 rounded border border-gray-600" style="background-color:' +
                    color +
                    ';"></div><span class="text-gray-300">' +
                    text +
                    '</span></li>';
            }
            instructionsHTML += '</ul>';

            showModal(domElements, 'Slicer Instructions', instructionsHTML);
        } catch (error) {
            console.error('Error showing slicer instructions:', error);
            showError('Failed to generate slicer instructions.');
        }
    }
})();
