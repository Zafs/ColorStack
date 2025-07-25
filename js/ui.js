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

export function renderMyFilaments(filaments, container, onRemove) {
    container.innerHTML = '';
    filaments.forEach((color, index) => {
        const filamentChip = document.createElement('div');
        filamentChip.className = 'filament-icon';
        filamentChip.style.setProperty('--filament-color', color);
        
        // Create the spool structure
        const spoolBody = document.createElement('div');
        spoolBody.className = 'filament-outer-ring';
        
        const centerHole = document.createElement('div');
        centerHole.className = 'filament-center-dot';
        
        // Create label
        const label = document.createElement('div');
        label.className = 'filament-label';
        label.textContent = 'PLA';
        
        // Create remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'filament-remove-btn';
        removeBtn.innerHTML = '×';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            onRemove(index);
        };
        
        // Assemble the filament spool icon
        spoolBody.appendChild(centerHole);
        filamentChip.appendChild(spoolBody);
        filamentChip.appendChild(label);
        filamentChip.appendChild(removeBtn);
        
        container.appendChild(filamentChip);
    });
}

export function showModal(domElements, title, contentHTML) {
    domElements.modalTitle.textContent = title;
    domElements.modalBody.innerHTML = contentHTML;
    domElements.modal.classList.remove('hidden');
}

export function hideModal(domElements) {
    domElements.modal.classList.add('hidden');
}

export function resetApp(domElements) {
    const { app, uploadScreen, origCanvas, procCanvas, paletteDiv, fileInput } = domElements;
    app.style.display = 'none';
    uploadScreen.style.display = 'flex';
    uploadScreen.style.opacity = '1';
    origCanvas.getContext('2d').clearRect(0, 0, origCanvas.width, origCanvas.height);
    procCanvas.getContext('2d').clearRect(0, 0, procCanvas.width, procCanvas.height);
    paletteDiv.innerHTML = '';
    fileInput.value = '';
}

export function showApp(domElements) {
    const { uploadScreen, app } = domElements;
    uploadScreen.style.opacity = '0';
    setTimeout(() => {
        uploadScreen.style.display = 'none';
        app.style.display = 'flex';
    }, 500);
}