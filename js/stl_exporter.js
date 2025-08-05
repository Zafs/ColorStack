/**
 * Generates a 3D STL file from a 2D image using the band map for height information.
 * This function creates a heightmap where each color band represents a different height layer,
 * suitable for multi-color 3D printing.
 *
 * @param {Object} appState - Application state containing bandMap and original canvas
 * @param {Object} domElements - DOM elements containing user input parameters
 * @returns {Blob} Binary STL file as a Blob object
 */
export function generateStl(appState, domElements) {
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
