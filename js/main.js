import { getSuggestedColors, processImage, matchToPalette, detectBackgroundColor, colorDistance, hexToRgb, getLuminance } from './image_processor.js';
import { generateStl } from './stl_exporter.js';
import { renderPalette, resetApp, showApp, renderMyFilaments, showModal, hideModal } from './ui.js';

const domElements = {
    spinner: document.getElementById('spinner'),
    uploadScreen: document.getElementById('uploadScreen'),
    uploadCard: document.getElementById('uploadCard'),
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
    singleLayerToggle: document.getElementById('singleLayerToggle'),
    exportBtn: document.getElementById('exportBtn'),
    newImageBtn: document.getElementById('newImageBtn'),
    instructionsBtn: document.getElementById('instructionsBtn'),
    suggestedPaletteBtn: document.getElementById('suggestedPaletteBtn'),
    myPaletteBtn: document.getElementById('myPaletteBtn'),
    invertPaletteBtn: document.getElementById('invertPaletteBtn'),
    newFilamentColor: document.getElementById('newFilamentColor'),
    addFilamentBtn: document.getElementById('addFilamentBtn'),
    myFilamentsList: document.getElementById('myFilamentsList'),
    modal: document.getElementById('modal'),
    modalTitle: document.getElementById('modalTitle'),
    modalBody: document.getElementById('modalBody'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
};

const appState = {
    img: null, bandMap: null, origCanvas: domElements.origCanvas,
    myFilaments: [], suggestedPalette: [], activePalette: 'suggested',
};

function handleFile(file) { showApp(domElements); loadImage(file); }

function loadImage(file) {
  const reader = new FileReader();
  reader.onload = event => {
    appState.img = new Image();
    appState.img.onload = () => { handleNumBandsChange(); };
    appState.img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

function handleSettingsChange() {
    if (!appState.img) return;
    appState.bandMap = processImage(appState, domElements);
}

function handleNumBandsChange() {
    if (!appState.img) return;
    const { img } = appState;
    const { origCanvas, procCanvas, numBandsInput, numBandsValue, layerSlider, layerValue } = domElements;
    origCanvas.width = procCanvas.width = img.width;
    origCanvas.height = procCanvas.height = img.height;
    const context = origCanvas.getContext('2d');
    context.drawImage(img, 0, 0, img.width, img.height);
    const numBands = parseInt(numBandsInput.value, 10);
    numBandsValue.textContent = numBands;
    layerSlider.max = numBands - 1;
    layerSlider.value = numBands - 1;
    layerValue.textContent = numBands;
    const data = context.getImageData(0, 0, img.width, img.height).data;
    appState.suggestedPalette = getSuggestedColors(data, numBands);
    
    // Intelligently set the base layer by detecting background color
    const backgroundColor = detectBackgroundColor(data, img.width, img.height);
    
    // Find the color in the suggested palette closest to the background color
    let closestIndex = 0;
    let minDistance = Infinity;
    
    for (let i = 0; i < appState.suggestedPalette.length; i++) {
        const { r, g, b } = hexToRgb(appState.suggestedPalette[i]);
        const paletteColor = [r, g, b];
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
        remainingColors.sort((a, b) => getLuminance(a) - getLuminance(b));
        appState.suggestedPalette = [appState.suggestedPalette[0], ...remainingColors];
    }
    
    updatePalette();
}

function updatePalette() {
    if (!appState.img) return;
    const { paletteDiv } = domElements;
    if (appState.activePalette === 'my') {
        const matchedPalette = matchToPalette(appState.suggestedPalette, appState.myFilaments);
        appState.currentPalette = matchedPalette; // Store the matched palette
        renderPalette(matchedPalette, paletteDiv, null, true);
    } else {
        appState.currentPalette = appState.suggestedPalette; // Store the suggested palette
        renderPalette(appState.suggestedPalette, paletteDiv, handleSettingsChange, false);
    }
    handleSettingsChange();
}

function showSlicerInstructions() {
    const { baseThicknessInput, bandThicknessInput, paletteDiv } = domElements;
    const baseThickness = parseInt(baseThicknessInput.value, 10);
    const bandThickness = parseInt(bandThicknessInput.value, 10);
    const colors = Array.from(paletteDiv.children).map(input => input.value);
    let instructionsHTML = '<ul>';
    colors.forEach((color, index) => {
        let text;
        if (index === 0) {
            text = `Start with this color (Base)`;
        } else {
            const startLayer = baseThickness + ((index - 1) * bandThickness) + 1;
            text = `Change to this color at Layer ${startLayer}`;
        }
        instructionsHTML += `<li><div class="color-swatch" style="background-color:${color};"></div><span>${text}</span></li>`;
    });
    instructionsHTML += '</ul>';
    showModal(domElements, "Slicer Instructions", instructionsHTML);
}

function saveMyFilaments() { localStorage.setItem('myFilaments', JSON.stringify(appState.myFilaments)); }
function loadMyFilaments() {
    const saved = localStorage.getItem('myFilaments');
    if (saved) {
        appState.myFilaments = JSON.parse(saved);
        renderMyFilaments(appState.myFilaments, domElements.myFilamentsList, removeFilament);
    }
}

function addFilament() {
    if (appState.myFilaments.length >= 16) { alert("Max 16 filaments."); return; }
    const newColor = domElements.newFilamentColor.value;
    if (!appState.myFilaments.includes(newColor)) {
        appState.myFilaments.push(newColor);
        saveMyFilaments();
        renderMyFilaments(appState.myFilaments, domElements.myFilamentsList, removeFilament);
        if (appState.activePalette === 'my') updatePalette();
    }
}

function removeFilament(indexToRemove) {
    appState.myFilaments.splice(indexToRemove, 1);
    saveMyFilaments();
    renderMyFilaments(appState.myFilaments, domElements.myFilamentsList, removeFilament);
    if (appState.activePalette === 'my') updatePalette();
}

function invertPalette() {
    if (appState.suggestedPalette.length > 0) {
        appState.suggestedPalette.reverse();
        updatePalette();
    }
}

function initializeColorPicker() {
    const selectedColor = document.getElementById('selectedColor');
    const trigger = document.getElementById('colorPickerTrigger');
    const colorPicker = document.getElementById('customColorPicker');
    const customColorInput = document.getElementById('customColorInput');
    
    if (!selectedColor || !trigger || !colorPicker) return;
    
    // Set initial color
    updateSelectedColor('#ffffff');
    customColorInput.value = '#ffffff';
    
    // Toggle color picker on trigger click
    trigger.addEventListener('click', function(e) {
        e.stopPropagation();
        colorPicker.classList.toggle('hidden');
    });
    
    // Close color picker when clicking outside
    document.addEventListener('click', function(e) {
        if (!colorPicker.contains(e.target) && !trigger.contains(e.target)) {
            colorPicker.classList.add('hidden');
        }
    });
    
    // Handle predefined color clicks
    const colorSwatches = colorPicker.querySelectorAll('[data-color]');
    colorSwatches.forEach(swatch => {
        swatch.addEventListener('click', function() {
            const color = this.getAttribute('data-color');
            updateSelectedColor(color);
            customColorInput.value = color;
            colorPicker.classList.add('hidden');
        });
    });
    
    // Handle custom color input
    customColorInput.addEventListener('input', function() {
        const color = this.value;
        if (isValidHexColor(color)) {
            updateSelectedColor(color);
        }
    });
    
    // Handle custom color input on enter
    customColorInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const color = this.value;
            if (isValidHexColor(color)) {
                updateSelectedColor(color);
                colorPicker.classList.add('hidden');
            }
        }
    });
    
    function updateSelectedColor(color) {
        selectedColor.style.backgroundColor = color;
        selectedColor.style.borderColor = getContrastColor(color);
        // Update the hidden input value for the add filament functionality
        if (domElements.newFilamentColor) {
            domElements.newFilamentColor.value = color;
        }
    }
    
    function getContrastColor(hexColor) {
        // Convert hex to RGB
        const r = parseInt(hexColor.substr(1, 2), 16);
        const g = parseInt(hexColor.substr(3, 2), 16);
        const b = parseInt(hexColor.substr(5, 2), 16);
        
        // Calculate luminance
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        
        // Return dark or light border based on luminance
        return luminance > 0.5 ? '#475569' : '#f8fafc';
    }
    
    function isValidHexColor(color) {
        return /^#[0-9A-F]{6}$/i.test(color);
    }
}

window.onload = function() {
    loadMyFilaments();
    initializeColorPicker();
};
domElements.uploadCard.onclick = () => domElements.fileInput.click();
domElements.fileInput.onchange = () => domElements.fileInput.files.length && handleFile(domElements.fileInput.files[0]);
domElements.numBandsInput.addEventListener('input', handleNumBandsChange);
domElements.layerHeightInput.addEventListener('input', handleSettingsChange);
domElements.baseThicknessInput.addEventListener('input', handleSettingsChange);
domElements.bandThicknessInput.addEventListener('input', handleSettingsChange);
domElements.layerSlider.addEventListener('input', () => {
    domElements.layerValue.textContent = parseInt(domElements.layerSlider.value, 10) + 1;
    handleSettingsChange();
});
domElements.singleLayerToggle.addEventListener('change', handleSettingsChange);
domElements.addFilamentBtn.onclick = addFilament;
domElements.suggestedPaletteBtn.onclick = () => {
    appState.activePalette = 'suggested';
    domElements.suggestedPaletteBtn.className = 'flex-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-md transition-all hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500';
    domElements.myPaletteBtn.className = 'flex-1 px-3 py-1.5 bg-slate-600 text-slate-200 text-xs font-medium rounded-md transition-all hover:bg-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500';
    updatePalette();
};
domElements.myPaletteBtn.onclick = () => {
    appState.activePalette = 'my';
    domElements.myPaletteBtn.className = 'flex-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-md transition-all hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500';
    domElements.suggestedPaletteBtn.className = 'flex-1 px-3 py-1.5 bg-slate-600 text-slate-200 text-xs font-medium rounded-md transition-all hover:bg-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500';
    updatePalette();
};
domElements.invertPaletteBtn.onclick = invertPalette;
domElements.instructionsBtn.onclick = showSlicerInstructions;
domElements.modalCloseBtn.onclick = () => hideModal(domElements);
domElements.exportBtn.onclick = () => {
    const blob = generateStl(appState, domElements);
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = 'colorstack.stl';
    downloadLink.click();
    URL.revokeObjectURL(downloadLink.href);
};
domElements.newImageBtn.onclick = () => {
    resetApp(domElements);
    appState.img = null;
    appState.bandMap = null;
    appState.suggestedPalette = [];
    appState.activePalette = 'suggested';
    domElements.suggestedPaletteBtn.className = 'flex-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-md transition-all hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500';
    domElements.myPaletteBtn.className = 'flex-1 px-3 py-1.5 bg-slate-600 text-slate-200 text-xs font-medium rounded-md transition-all hover:bg-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500';
};