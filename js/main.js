import { getSuggestedColors, processImage, matchToPalette, detectBackgroundColor, colorDistance, hexToRgb, getLuminance } from './image_processor.js';
import { generateStl } from './stl_exporter.js';
import { renderPalette, resetApp, showApp, renderMyFilaments, showModal, hideModal, showMainContent, showUploadArea, showHeaderButtons, hideHeaderButtons } from './ui.js';

let domElements;
let appState;

function handleFile(file) { 
    console.log('handleFile called with:', file);
    loadImage(file); 
    showMainContent(domElements);
}

function loadImage(file) {
  console.log('loadImage called with:', file);
  const reader = new FileReader();
  reader.onload = event => {
    console.log('FileReader onload triggered');
    appState.img = new Image();
    appState.img.onload = () => { 
        console.log('Image loaded successfully');
        handleNumBandsChange(); 
    };
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
    layerSlider.min = 0;
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
    let instructionsHTML = '<ul class="space-y-2">';
    colors.forEach((color, index) => {
        let text;
        if (index === 0) {
            text = `Start with this color (Base)`;
        } else {
            const startLayer = baseThickness + ((index - 1) * bandThickness) + 1;
            text = `Change to this color at Layer ${startLayer}`;
        }
        instructionsHTML += `<li class="flex items-center gap-3"><div class="w-4 h-4 rounded border border-gray-600" style="background-color:${color};"></div><span class="text-gray-300">${text}</span></li>`;
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
    if (appState.myFilaments.length >= 16) { 
        showModal(domElements, "Maximum Filaments", "You can only have up to 16 filaments. Please remove some before adding new ones.");
        return; 
    }
    
    // Create a simple color picker modal
    const modalHTML = `
        <div class="space-y-4">
            <p class="text-gray-300">Select a color for your new filament:</p>
            <div class="grid grid-cols-8 gap-2">
                <div class="w-8 h-8 rounded cursor-pointer border border-gray-600 hover:scale-110 transition-transform" style="background: #ff0000" data-color="#ff0000"></div>
                <div class="w-8 h-8 rounded cursor-pointer border border-gray-600 hover:scale-110 transition-transform" style="background: #ff8000" data-color="#ff8000"></div>
                <div class="w-8 h-8 rounded cursor-pointer border border-gray-600 hover:scale-110 transition-transform" style="background: #ffff00" data-color="#ffff00"></div>
                <div class="w-8 h-8 rounded cursor-pointer border border-gray-600 hover:scale-110 transition-transform" style="background: #80ff00" data-color="#80ff00"></div>
                <div class="w-8 h-8 rounded cursor-pointer border border-gray-600 hover:scale-110 transition-transform" style="background: #00ff00" data-color="#00ff00"></div>
                <div class="w-8 h-8 rounded cursor-pointer border border-gray-600 hover:scale-110 transition-transform" style="background: #00ff80" data-color="#00ff80"></div>
                <div class="w-8 h-8 rounded cursor-pointer border border-gray-600 hover:scale-110 transition-transform" style="background: #00ffff" data-color="#00ffff"></div>
                <div class="w-8 h-8 rounded cursor-pointer border border-gray-600 hover:scale-110 transition-transform" style="background: #0080ff" data-color="#0080ff"></div>
                <div class="w-8 h-8 rounded cursor-pointer border border-gray-600 hover:scale-110 transition-transform" style="background: #0000ff" data-color="#0000ff"></div>
                <div class="w-8 h-8 rounded cursor-pointer border border-gray-600 hover:scale-110 transition-transform" style="background: #8000ff" data-color="#8000ff"></div>
                <div class="w-8 h-8 rounded cursor-pointer border border-gray-600 hover:scale-110 transition-transform" style="background: #ff00ff" data-color="#ff00ff"></div>
                <div class="w-8 h-8 rounded cursor-pointer border border-gray-600 hover:scale-110 transition-transform" style="background: #ff0080" data-color="#ff0080"></div>
                <div class="w-8 h-8 rounded cursor-pointer border border-gray-600 hover:scale-110 transition-transform" style="background: #ffffff" data-color="#ffffff"></div>
                <div class="w-8 h-8 rounded cursor-pointer border border-gray-600 hover:scale-110 transition-transform" style="background: #cccccc" data-color="#cccccc"></div>
                <div class="w-8 h-8 rounded cursor-pointer border border-gray-600 hover:scale-110 transition-transform" style="background: #999999" data-color="#999999"></div>
                <div class="w-8 h-8 rounded cursor-pointer border border-gray-600 hover:scale-110 transition-transform" style="background: #000000" data-color="#000000"></div>
            </div>
            <div class="flex gap-2">
                <input type="text" id="customColorInput" placeholder="#ffffff" class="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-100 text-sm">
                <button id="addCustomColorBtn" class="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700">Add</button>
            </div>
        </div>
    `;
    
    showModal(domElements, "Add New Filament", modalHTML);
    
    // Add event listeners for color selection
    const colorSwatches = domElements.modalBody.querySelectorAll('[data-color]');
    const customColorInput = domElements.modalBody.querySelector('#customColorInput');
    const addCustomColorBtn = domElements.modalBody.querySelector('#addCustomColorBtn');
    
    colorSwatches.forEach(swatch => {
        swatch.addEventListener('click', function() {
            const color = this.getAttribute('data-color');
            addFilamentWithColor(color);
        });
    });
    
    addCustomColorBtn.addEventListener('click', function() {
        const color = customColorInput.value;
        if (isValidHexColor(color)) {
            addFilamentWithColor(color);
        } else {
            alert('Please enter a valid hex color (e.g., #ff0000)');
        }
    });
    
    customColorInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const color = this.value;
            if (isValidHexColor(color)) {
                addFilamentWithColor(color);
            } else {
                alert('Please enter a valid hex color (e.g., #ff0000)');
            }
        }
    });
}

function addFilamentWithColor(color) {
    if (!appState.myFilaments.includes(color)) {
        appState.myFilaments.push(color);
        saveMyFilaments();
        renderMyFilaments(appState.myFilaments, domElements.myFilamentsList, removeFilament);
        if (appState.activePalette === 'my') updatePalette();
        hideModal(domElements);
    } else {
        alert('This color is already in your filaments!');
    }
}

function isValidHexColor(color) {
    return /^#[0-9A-F]{6}$/i.test(color);
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

window.onload = function() {
    console.log('Window loaded, setting up event listeners');
    
    // Initialize DOM elements after DOM is loaded
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

    // Initialize app state
    appState = {
        img: null, 
        bandMap: null, 
        origCanvas: domElements.origCanvas,
        myFilaments: [], 
        suggestedPalette: [], 
        activePalette: 'suggested',
    };

    // Debug DOM elements
    console.log('DOM Elements found:', {
        uploadCard: !!domElements.uploadCard,
        fileInput: !!domElements.fileInput,
        uploadArea: !!domElements.uploadArea,
        mainContent: !!domElements.mainContent
    });

    loadMyFilaments();
    
    // Hide header buttons initially since no image is loaded
    hideHeaderButtons(domElements);
    
    // Set up all event listeners with error handling
    if (domElements.uploadCard) {
        console.log('Setting up upload card click handler');
        domElements.uploadCard.onclick = () => {
            console.log('Upload card clicked');
            domElements.fileInput.click();
        };
        
        // Add drag and drop functionality
        domElements.uploadCard.addEventListener('dragover', (e) => {
            e.preventDefault();
            domElements.uploadCard.classList.add('dragover');
        });
        
        domElements.uploadCard.addEventListener('dragleave', (e) => {
            e.preventDefault();
            domElements.uploadCard.classList.remove('dragover');
        });
        
        domElements.uploadCard.addEventListener('drop', (e) => {
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
        domElements.fileInput.onchange = () => {
            console.log('File input changed:', domElements.fileInput.files);
            if (domElements.fileInput.files.length) {
                handleFile(domElements.fileInput.files[0]);
            }
        };
    } else {
        console.error('fileInput element not found');
    }
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
        domElements.layerSlider.addEventListener('input', () => {
            domElements.layerValue.textContent = parseInt(domElements.layerSlider.value, 10) + 1;
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
        domElements.suggestedPaletteBtn.onclick = () => {
            appState.activePalette = 'suggested';
            domElements.suggestedPaletteBtn.className = 'px-3 py-1 text-sm font-medium rounded-md bg-indigo-600 text-white';
            domElements.myPaletteBtn.className = 'px-3 py-1 text-sm font-medium rounded-md text-gray-300 hover:bg-gray-700';
            updatePalette();
        };
    }
    if (domElements.myPaletteBtn) {
        domElements.myPaletteBtn.onclick = () => {
            appState.activePalette = 'my';
            domElements.myPaletteBtn.className = 'px-3 py-1 text-sm font-medium rounded-md bg-indigo-600 text-white';
            domElements.suggestedPaletteBtn.className = 'px-3 py-1 text-sm font-medium rounded-md text-gray-300 hover:bg-gray-700';
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
        domElements.modalCloseBtn.onclick = () => hideModal(domElements);
    }
    if (domElements.exportBtn) {
        domElements.exportBtn.onclick = () => {
            const blob = generateStl(appState, domElements);
            const downloadLink = document.createElement('a');
            downloadLink.href = URL.createObjectURL(blob);
            downloadLink.download = 'colorstack.stl';
            downloadLink.click();
            URL.revokeObjectURL(downloadLink.href);
        };
    }
    if (domElements.newImageBtn) {
        domElements.newImageBtn.onclick = () => {
            resetApp(domElements);
            appState.img = null;
            appState.bandMap = null;
            appState.suggestedPalette = [];
            appState.activePalette = 'suggested';
            domElements.suggestedPaletteBtn.className = 'px-3 py-1 text-sm font-medium rounded-md bg-indigo-600 text-white';
            domElements.myPaletteBtn.className = 'px-3 py-1 text-sm font-medium rounded-md text-gray-300 hover:bg-gray-700';
        };
    }
};