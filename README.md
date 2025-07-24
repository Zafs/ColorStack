# ColorStack 🎨

**Turn any image into a beautiful, multi-color 3D printable STL file.**

ColorStack is a free, browser-based tool that makes creating stunning color 3D prints easy. Inspired by tools like HueForge, it analyzes the colors in your image and converts them into a 3D model with varying layer heights, allowing you to create physical art by changing filament colors at specific points in your print.

![ColorStack Screenshot](https://user-images.githubusercontent.com/username/repo/image.png) 
*(Note: You will need to upload a screenshot to your GitHub repository and replace the URL above)*

---

### ✨ Features

* **Intelligent Color Analysis**: Uses k-means clustering to find the most dominant colors in your image.
* **Smart Base Layer Detection**: Automatically detects the background color of your image to use as the base of the print.
* **Full User Control**: Easily invert the color stacking order and customize the generated color palette.
* **Live 3D Preview**: See exactly what your final print will look like with a layer-by-layer preview.
* **Customizable STL Export**: Control the model dimensions, layer height, and thickness of each color band.
* **"My Filaments" Library**: Save your personal filament colors in your browser's local storage for easy access.

### 🚀 How to Use

1.  **Upload an Image**: Click the upload card to select an image from your computer.
2.  **Adjust Settings**: Use the controls on the right panel to set the number of colors (Z-Bands), model dimensions, and layer parameters.
3.  **Customize Your Palette**: Use the suggested palette, or switch to "My Palette" to use your saved filament colors. Click "Invert" (↕) to change the stacking order.
4.  **Preview**: Use the "Preview Z-Band" slider to inspect the model layer by layer.
5.  **Export**: Click "Export STL" to download your file and "View Slicer Instructions" for guidance on when to change filament colors in your slicer software.

### ❤️ Support the Project

ColorStack is a free tool developed for the 3D printing community. If you find it useful, please consider supporting its development!

*(Here you can add a link to your "Buy Me a Coffee", Ko-fi, or Gumroad page.)*

### 📜 Copyright & Usage

Copyright (c) 2025 Kellen Meade. All Rights Reserved.

The code for this project is proprietary. You are welcome to use the ColorStack web application for personal, non-commercial purposes. You may not copy, modify, or redistribute the source code.