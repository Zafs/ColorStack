// js/ui.js

export function renderPalette(colors, paletteDiv, onColorChange, readOnly = false) {
    paletteDiv.innerHTML = '';
    colors.forEach((color, index) => {
        const colorDiv = document.createElement('div');
        colorDiv.className = 'relative group cursor-pointer';

        // Create the color swatch
        const colorSwatch = document.createElement('div');
        colorSwatch.className =
            'w-8 h-8 rounded border-2 border-gray-600 hover:border-indigo-400 transition-all duration-200 hover:scale-110';
        colorSwatch.style.backgroundColor = color;

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

export function openCustomColorPicker(currentColor, onColorChange, isFilamentPicker = false) {
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
            modal.style.display = 'none';
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

export function renderMyFilaments(filaments, container, onRemove, onEdit = null) {
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
            if (onEdit) {
                onEdit(filament.id);
            } else {
                console.log('Edit filament:', filament.id);
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

export function showModal(domElements, title, contentHTML) {
    domElements.modalTitle.textContent = title;
    domElements.modalBody.innerHTML = contentHTML;
    domElements.modal.style.display = 'flex';
}

export function hideModal(domElements) {
    domElements.modal.style.display = 'none';
}

export function resetApp(domElements) {
    const { uploadArea, mainContent, origCanvas, procCanvas, paletteDiv, fileInput } = domElements;
    showUploadArea(domElements);
    origCanvas.getContext('2d').clearRect(0, 0, origCanvas.width, origCanvas.height);
    procCanvas.getContext('2d').clearRect(0, 0, procCanvas.width, procCanvas.height);
    paletteDiv.innerHTML = '';
    fileInput.value = '';
}

export function showApp(domElements) {
    // This function is now replaced by showMainContent
    showMainContent(domElements);
}

export function showMainContent(domElements) {
    const { uploadArea, mainContent } = domElements;
    uploadArea.style.display = 'none';
    mainContent.classList.remove('hidden');
    showHeaderButtons(domElements);
}

export function showUploadArea(domElements) {
    const { uploadArea, mainContent } = domElements;
    uploadArea.style.display = 'block';
    mainContent.classList.add('hidden');
    hideHeaderButtons(domElements);
}

export function showHeaderButtons(domElements) {
    const { instructionsBtn, newImageBtn, exportBtn } = domElements;
    if (instructionsBtn) instructionsBtn.style.display = 'flex';
    if (newImageBtn) newImageBtn.style.display = 'flex';
    if (exportBtn) exportBtn.style.display = 'flex';
}

export function hideHeaderButtons(domElements) {
    const { instructionsBtn, newImageBtn, exportBtn } = domElements;
    if (instructionsBtn) instructionsBtn.style.display = 'none';
    if (newImageBtn) newImageBtn.style.display = 'none';
    if (exportBtn) exportBtn.style.display = 'none';
}
