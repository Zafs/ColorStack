// js/ui.js

export function renderPalette(colors, paletteDiv, onColorChange, readOnly = false) {
  paletteDiv.innerHTML = '';
  colors.forEach(color => {
    const colorInput = document.createElement('input'); 
    colorInput.type = 'color'; 
    colorInput.value = color;
    if (readOnly) {
        colorInput.disabled = true;
    } else {
        colorInput.addEventListener('input', onColorChange);
    }
    paletteDiv.append(colorInput);
  });
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
    '#333333': 'Dark Gray'
  };
  return colorNames[color] || 'Custom';
}

function openColorPicker(currentColor, onColorChange) {
  // This would open a color picker modal
  // For now, we'll just use a simple prompt
  const newColor = prompt('Enter a hex color (e.g., #ff0000):', currentColor);
  if (newColor && /^#[0-9A-F]{6}$/i.test(newColor)) {
    // Update the color in the palette
    const colorDivs = document.querySelectorAll('#palette > div');
    colorDivs.forEach(div => {
      if (div.style.backgroundColor === currentColor) {
        div.style.backgroundColor = newColor;
        div.querySelector('.tooltip').textContent = getColorName(newColor);
      }
    });
    if (onColorChange) onColorChange();
  }
}

export function renderMyFilaments(filaments, container, onRemove) {
    container.innerHTML = '';
    filaments.forEach((color, index) => {
        const filamentDiv = document.createElement('div');
        filamentDiv.className = 'relative group flex flex-col items-center gap-2 has-tooltip';
        
        // Create the filament spool
        const spoolDiv = document.createElement('div');
        spoolDiv.className = 'w-16 h-16 rounded-full flex items-center justify-center bg-gray-700 border-2 border-gray-600';
        spoolDiv.style.setProperty('--filament-color', color);
        
        // Inner color circle
        const innerColor = document.createElement('div');
        innerColor.className = 'w-12 h-12 rounded-full';
        innerColor.style.backgroundColor = color;
        
        // Center hole
        const centerHole = document.createElement('div');
        centerHole.className = 'absolute w-6 h-6 bg-gray-800 rounded-full border-2 border-gray-600';
        
        // Filament name
        const nameDiv = document.createElement('p');
        nameDiv.className = 'text-xs text-gray-300 text-center truncate w-full';
        nameDiv.textContent = getFilamentName(color);
        
        // Remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'absolute top-0 right-0 p-1 bg-gray-800 rounded-full text-gray-400 hover:text-white hover:bg-red-500 opacity-0 group-hover:opacity-100 transition-opacity';
        const closeIcon = document.createElement('span');
        closeIcon.className = 'material-icons text-sm';
        closeIcon.textContent = 'close';
        removeBtn.appendChild(closeIcon);
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            onRemove(index);
        };
        
        // Tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip -bottom-5 px-2 py-1 bg-gray-900 text-white text-xs rounded';
        tooltip.textContent = 'Remove filament';
        
        // Assemble the filament
        spoolDiv.appendChild(innerColor);
        spoolDiv.appendChild(centerHole);
        filamentDiv.appendChild(spoolDiv);
        filamentDiv.appendChild(nameDiv);
        filamentDiv.appendChild(removeBtn);
        filamentDiv.appendChild(tooltip);
        
        container.appendChild(filamentDiv);
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
    '#333333': 'Charcoal PLA'
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