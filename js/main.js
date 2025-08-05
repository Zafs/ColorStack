// Main application logic with enhanced compatibility
(function() {
    'use strict';
    
    var imageProcessor, stlExporter, ui;
    var domElements;
    var appState;
    var imageWorker; // Web Worker for image processing

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
        var allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/bmp'];
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
        
        var reader = new FileReader();
        
        reader.onload = function(event) {
            console.log('FileReader onload triggered');
            
            // Check if Image constructor is supported
            if (typeof Image === 'undefined') {
                showError('Image processing is not supported in this browser.');
                return;
            }
            
            appState.img = new Image();
            
            appState.img.onload = function() {
                console.log('Image loaded successfully');
                
                // Synchronize with browser's paint cycle to ensure canvas is ready
                requestAnimationFrame(function() {
                    try {
                        // Explicitly draw the original image to its canvas here.
                        const img = appState.img;
                        const origCanvas = domElements.origCanvas;
                        origCanvas.width = img.width;
                        origCanvas.height = img.height;
                        const context = origCanvas.getContext('2d');
                        context.drawImage(img, 0, 0, img.width, img.height);

                        // Now, proceed with processing.
                        handleNumBandsChange();
                    } catch (error) {
                        console.error('Error processing image:', error);
                        showError('Failed to process image. Please try a different image.');
                    }
                });
            };
            
            appState.img.onerror = function() {
                console.error('Failed to load image');
                showError('Failed to load image. Please try a different file.');
            };
            
            appState.img.src = event.target.result;
        };
        
        reader.onerror = function() {
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
                height: appState.img.height
            };
            
            const workerDomElements = {
                layerSlider: { value: domElements.layerSlider.value },
                singleLayerToggle: { checked: domElements.singleLayerToggle ? domElements.singleLayerToggle.checked : false }
            };
            
            // Send message to worker
            if (imageWorker) {
                imageWorker.postMessage({
                    type: 'process_image',
                    data: {
                        appState: workerAppState,
                        domElements: workerDomElements
                    }
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
            var img = appState.img;
            var origCanvas = domElements.origCanvas;
            var procCanvas = domElements.procCanvas;
            var numBandsInput = domElements.numBandsInput;
            var numBandsValue = domElements.numBandsValue;
            var layerSlider = domElements.layerSlider;
            var layerValue = domElements.layerValue;
            
            // Check if canvas is supported
            if (typeof origCanvas.getContext === 'undefined') {
                showError('Canvas is not supported in this browser.');
                return;
            }
            
            origCanvas.width = procCanvas.width = img.width;
            origCanvas.height = procCanvas.height = img.height;
            
            var context = origCanvas.getContext('2d');
            if (!context) {
                showError('Canvas 2D context is not supported in this browser.');
                return;
            }
            
            context.drawImage(img, 0, 0, img.width, img.height);
            
            var numBands = parseInt(numBandsInput.value, 10);
            if (isNaN(numBands) || numBands < 2 || numBands > 8) {
                numBands = 4;
                numBandsInput.value = 4;
            }
            
            numBandsValue.textContent = numBands;
            layerSlider.min = 0;
            layerSlider.max = numBands - 1;
            layerSlider.value = numBands - 1;
            layerValue.textContent = numBands;
            
            var imageData = context.getImageData(0, 0, img.width, img.height);
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
                        height: img.height
                    }
                });
            } else {
                // Fallback to synchronous processing
                var data = imageData.data;
                appState.suggestedPalette = getSuggestedColors(data, numBands);
                
                // Intelligently set the base layer by detecting background color
                var backgroundColor = detectBackgroundColor(data, img.width, img.height);
                
                // Find the color in the suggested palette closest to the background color
                var closestIndex = 0;
                var minDistance = Infinity;
                
                for (var i = 0; i < appState.suggestedPalette.length; i++) {
                    var rgb = hexToRgb(appState.suggestedPalette[i]);
                    var paletteColor = [rgb.r, rgb.g, rgb.b];
                    var distance = colorDistance(backgroundColor, paletteColor);
                    
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestIndex = i;
                    }
                }
                
                // Move the closest color to the beginning of the palette (base layer)
                if (closestIndex > 0) {
                    var baseColor = appState.suggestedPalette[closestIndex];
                    appState.suggestedPalette.splice(closestIndex, 1);
                    appState.suggestedPalette.unshift(baseColor);
                }
                
                // Sort the remaining colors (from index 1 to end) by luminance, darkest to lightest
                if (appState.suggestedPalette.length > 1) {
                    var remainingColors = appState.suggestedPalette.slice(1);
                    remainingColors.sort(function(a, b) {
                        return getLuminance(a) - getLuminance(b);
                    });
                    appState.suggestedPalette = [appState.suggestedPalette[0]].concat(remainingColors);
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
            var paletteDiv = domElements.paletteDiv;
            
            if (appState.activePalette === 'my') {
                var matchedPalette = matchToPalette(appState.suggestedPalette, appState.myFilaments);
                appState.currentPalette = matchedPalette.slice(); // Create a copy
                renderPalette(appState.currentPalette, paletteDiv, handleSettingsChange, false);
            } else {
                appState.currentPalette = appState.suggestedPalette.slice(); // Create a copy
                renderPalette(appState.currentPalette, paletteDiv, handleSettingsChange, false);
            }
            handleSettingsChange();
        } catch (error) {
            console.error('Error updating palette:', error);
            showError('Failed to update color palette.');
        }
    }

    // Enhanced slicer instructions function
    function showSlicerInstructions() {
        try {
            var baseThicknessInput = domElements.baseThicknessInput;
            var bandThicknessInput = domElements.bandThicknessInput;
            
            var baseThickness = parseInt(baseThicknessInput.value, 10);
            var bandThickness = parseInt(bandThicknessInput.value, 10);
            
            // Get colors from the current palette (which reflects user changes)
            var colors = appState.currentPalette || appState.suggestedPalette || [];
            
            var instructionsHTML = '<ul class="space-y-2">';
            colors.forEach(function(color, index) {
                var text;
                if (index === 0) {
                    text = 'Start with this color (Base)';
                } else {
                    var startLayer = baseThickness + ((index - 1) * bandThickness) + 1;
                    text = 'Change to this color at Layer ' + startLayer;
                }
                instructionsHTML += '<li class="flex items-center gap-3"><div class="w-4 h-4 rounded border border-gray-600" style="background-color:' + color + ';"></div><span class="text-gray-300">' + text + '</span></li>';
            });
            instructionsHTML += '</ul>';
            
            showModal(domElements, "Slicer Instructions", instructionsHTML);
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
            var saved = localStorage.getItem('myFilaments');
            if (saved) {
                appState.myFilaments = JSON.parse(saved);
                renderMyFilaments(appState.myFilaments, domElements.myFilamentsList, removeFilament);
            }
        } catch (error) {
            console.error('Failed to load filaments:', error);
            // Don't show error for this, just start with empty filaments
            appState.myFilaments = [];
        }
    }

    // Enhanced add filament function
    function addFilament() {
        if (appState.myFilaments.length >= 16) { 
            showModal(domElements, "Maximum Filaments", "You can only have up to 16 filaments. Please remove some before adding new ones.");
            return; 
        }
        
        // Use the same comprehensive color picker as the palette
        openCustomColorPicker('#ff0000', function(selectedColor) {
            addFilamentWithColor(selectedColor);
        }, true); // isFilamentPicker = true
    }

    // Enhanced add filament with color function
    function addFilamentWithColor(color) {
        try {
            if (!appState.myFilaments.includes(color)) {
                appState.myFilaments.push(color);
                saveMyFilaments();
                renderMyFilaments(appState.myFilaments, domElements.myFilamentsList, removeFilament);
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

    // Enhanced hex color validation
    function isValidHexColor(color) {
        return /^#[0-9A-F]{6}$/i.test(color);
    }

    // Enhanced remove filament function
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
            showModal(domElements, "Error", '<div class="text-red-400">' + message + '</div>');
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
                domElements.uploadCard.onclick = function() {
                    console.log('Upload card clicked');
                    domElements.fileInput.click();
                };
                
                // Add drag and drop functionality with better error handling
                domElements.uploadCard.addEventListener('dragover', function(e) {
                    e.preventDefault();
                    domElements.uploadCard.classList.add('dragover');
                });
                
                domElements.uploadCard.addEventListener('dragleave', function(e) {
                    e.preventDefault();
                    domElements.uploadCard.classList.remove('dragover');
                });
                
                domElements.uploadCard.addEventListener('drop', function(e) {
                    e.preventDefault();
                    domElements.uploadCard.classList.remove('dragover');
                    var files = e.dataTransfer.files;
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
                domElements.fileInput.onchange = function() {
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

    // Enhanced control event listeners setup
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
                domElements.layerSlider.addEventListener('input', function() {
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
                domElements.suggestedPaletteBtn.onclick = function() {
                    appState.activePalette = 'suggested';
                    domElements.suggestedPaletteBtn.className = 'px-3 py-1 text-sm font-medium rounded-md bg-indigo-600 text-white';
                    domElements.myPaletteBtn.className = 'px-3 py-1 text-sm font-medium rounded-md text-gray-300 hover:bg-gray-700';
                    updatePalette();
                };
            }
            if (domElements.myPaletteBtn) {
                domElements.myPaletteBtn.onclick = function() {
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
                domElements.modalCloseBtn.onclick = function() { 
                    hideModal(domElements); 
                };
            }
            if (domElements.exportBtn) {
                domElements.exportBtn.onclick = function() {
                    try {
                        var blob = generateStl(appState, domElements);
                        if (blob && typeof URL !== 'undefined' && URL.createObjectURL) {
                            var downloadLink = document.createElement('a');
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
                domElements.newImageBtn.onclick = function() {
                    try {
                        resetApp(domElements);
                        appState.img = null;
                        appState.bandMap = null;
                        appState.suggestedPalette = [];
                        appState.activePalette = 'suggested';
                        domElements.suggestedPaletteBtn.className = 'px-3 py-1 text-sm font-medium rounded-md bg-indigo-600 text-white';
                        domElements.myPaletteBtn.className = 'px-3 py-1 text-sm font-medium rounded-md text-gray-300 hover:bg-gray-700';
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
            let isWorkerReady = new Promise(resolve => {
                if (window.Worker) {
                    try {
                        imageWorker = new Worker('js/image_worker.js');
                        
                        // Set up worker message handler - unified handler for all message types
                        imageWorker.onmessage = function(e) {
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
                                        const previewImage = new ImageData(new Uint8ClampedArray(data.previewImageData.data), data.previewImageData.width, data.previewImageData.height);
                                        domElements.procCanvas.getContext('2d').putImageData(previewImage, 0, 0);
                                    } else {
                                         showError("Image processing failed to return valid data.");
                                    }
                                    
                                    // Force canvas redraw after a delay to ensure browser stability
                                    setTimeout(() => {
                                        console.log('Forcing canvas redraw...');

                                        // 1. Redraw the original image
                                        const origCanvas = document.getElementById('origCanvas');
                                        if (origCanvas && appState.img) {
                                            const context = origCanvas.getContext('2d');
                                            // Ensure canvas dimensions are still correct before drawing
                                            if (origCanvas.width !== appState.img.width || origCanvas.height !== appState.img.height) {
                                                origCanvas.width = appState.img.width;
                                                origCanvas.height = appState.img.height;
                                            }
                                            context.drawImage(appState.img, 0, 0, origCanvas.width, origCanvas.height);
                                        }

                                        // 2. Redraw the processed preview
                                        const procCanvas = document.getElementById('procCanvas');
                                        if (procCanvas && data.previewImageData) {
                                            const previewImage = new ImageData(new Uint8ClampedArray(data.previewImageData.data.buffer.slice(0)), data.previewImageData.width, data.previewImageData.height);
                                            procCanvas.getContext('2d').putImageData(previewImage, 0, 0);
                                        }
                                    }, 100); // 100ms delay to ensure the browser is stable
                                    break;

                                case 'error':
                                    showError(data.message || "An unknown error occurred in the worker.");
                                    break;

                                default:
                                    console.warn('Unknown message type from worker:', type);
                                    break;
                            }
                        };
                        
                        // Set up worker error handler
                        imageWorker.onerror = function(error) {
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
                        console.warn('Failed to initialize Web Worker, falling back to synchronous processing:', workerError);
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
            let isServiceWorkerReady = new Promise(resolve => {
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.ready.then(registration => {
                        console.log('Service worker is active.');
                        resolve(true);
                    }).catch(error => {
                        console.error('Service worker failed to become ready:', error);
                        resolve(true); // Resolve anyway to not block the app
                    });
                } else {
                    resolve(true); // No service worker, so we're "ready"
                }
            });
            
            // Import modules
            imageProcessor = await import('./image_processor.js');
            stlExporter = await import('./stl_exporter.js');
            ui = await import('./ui.js');

            // Destructure imported functions with fallbacks
            var getSuggestedColors = imageProcessor.getSuggestedColors || function() { return []; };
            var processImage = imageProcessor.processImage || function() { return null; };
            var matchToPalette = imageProcessor.matchToPalette || function(a, b) { return a; };
            var detectBackgroundColor = imageProcessor.detectBackgroundColor || function() { return [0, 0, 0]; };
            var colorDistance = imageProcessor.colorDistance || function() { return 0; };
            var hexToRgb = imageProcessor.hexToRgb || function() { return {r: 0, g: 0, b: 0}; };
            var getLuminance = imageProcessor.getLuminance || function() { return 0; };

            var generateStl = stlExporter.generateStl || function() { return new Blob(); };

            var renderPalette = ui.renderPalette || function() {};
            var resetApp = ui.resetApp || function() {};
            var showApp = ui.showApp || function() {};
            var renderMyFilaments = ui.renderMyFilaments || function() {};
            var showModal = ui.showModal || function() {};
            var hideModal = ui.hideModal || function() {};
            var showMainContent = ui.showMainContent || function() {};
            var showUploadArea = ui.showUploadArea || function() {};
            var showHeaderButtons = ui.showHeaderButtons || function() {};
            var hideHeaderButtons = ui.hideHeaderButtons || function() {};
            var openCustomColorPicker = ui.openCustomColorPicker || function() {};

            // Make functions globally accessible
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
                mainContent: !!domElements.mainContent
            });

            loadMyFilaments();
            
            // Hide header buttons initially since no image is loaded
            hideHeaderButtons(domElements);
            
            // Wait for both worker and service worker to be ready
            Promise.all([isWorkerReady, isServiceWorkerReady]).then(() => {
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
            document.body.innerHTML = '<div style="text-align: center; padding: 50px; color: #E0E0E0;"><h1>Browser Compatibility Issue</h1><p>Your browser does not support the required features for ColorStack. Please use a modern browser like Chrome, Firefox, Safari, or Edge.</p></div>';
        }
    }

    // Enhanced window load function with better error handling
    window.onload = function() {
        console.log('Window loaded, initializing application');
        initializeApp();
    };

})();