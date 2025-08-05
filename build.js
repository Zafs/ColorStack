#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Version management
const VERSION = process.argv[2] || '2.1.1';

console.log(`🔄 Updating ColorStack to version ${VERSION}...`);

// Files to update with version
const filesToUpdate = [
    'index.html',
    'privacy.html', 
    'terms.html',
    'js/version.js',
    'sw.js'
];

// Update version in version.js
function updateVersionFile() {
    const versionPath = 'js/version.js';
    let content = fs.readFileSync(versionPath, 'utf8');
    
    // Update main version
    content = content.replace(/version: '[\d.]+'/, `version: '${VERSION}'`);
    
    // Update all asset versions
    const assetRegex = /'[^']+': '[\d.]+'/g;
    content = content.replace(assetRegex, (match) => {
        return match.replace(/[\d.]+'$/, `${VERSION}'`);
    });
    
    fs.writeFileSync(versionPath, content);
    console.log(`✅ Updated ${versionPath}`);
}

// Update HTML files
function updateHtmlFiles() {
    const htmlFiles = ['index.html', 'privacy.html', 'terms.html'];
    
    htmlFiles.forEach(file => {
        let content = fs.readFileSync(file, 'utf8');
        
        // Update external resources
        content = content.replace(
            /(https:\/\/cdn\.tailwindcss\.com\?plugins=forms,container-queries)(&v=[\d.]+)?/g,
            `$1&v=${VERSION}`
        );
        
        content = content.replace(
            /(https:\/\/fonts\.googleapis\.com\/css2\?family=Inter:wght@400;500;600;700&amp;display=swap)(&amp;v=[\d.]+)?/g,
            `$1&amp;v=${VERSION}`
        );
        
        content = content.replace(
            /(https:\/\/fonts\.googleapis\.com\/icon\?family=Material\+Icons)(&amp;v=[\d.]+)?/g,
            `$1&amp;v=${VERSION}`
        );
        
        // Update local JS files
        content = content.replace(
            /(src="js\/[^"]+\.js)(\?v=[\d.]+)?/g,
            `$1?v=${VERSION}`
        );
        
        // Update Service Worker registration
        content = content.replace(
            /navigator\.serviceWorker\.register\('\/sw\.js(\?v=[\d.]+)?'\)/g,
            `navigator.serviceWorker.register('/sw.js?v=${VERSION}')`
        );
        
        fs.writeFileSync(file, content);
        console.log(`✅ Updated ${file}`);
    });
}

// Update service worker
function updateServiceWorker() {
    let content = fs.readFileSync('sw.js', 'utf8');
    
    // Update cache names
    content = content.replace(/colorstack-v[\d.]+/g, `colorstack-v${VERSION}`);
    content = content.replace(/colorstack-static-v[\d.]+/g, `colorstack-static-v${VERSION}`);
    content = content.replace(/colorstack-dynamic-v[\d.]+/g, `colorstack-dynamic-v${VERSION}`);
    
    // Update version in VERSION_CONFIG
    content = content.replace(/version: '[\d.]+'/, `version: '${VERSION}'`);
    
    // Update all asset versions in VERSION_CONFIG
    const assetRegex = /'[^']+': '[\d.]+'/g;
    content = content.replace(assetRegex, (match) => {
        return match.replace(/[\d.]+'$/, `${VERSION}'`);
    });
    
    fs.writeFileSync('sw.js', content);
    console.log(`✅ Updated sw.js`);
}

// Main execution
try {
    updateVersionFile();
    updateHtmlFiles();
    updateServiceWorker();
    
    console.log(`\n🎉 Successfully updated ColorStack to version ${VERSION}!`);
    console.log('\n📝 Next steps:');
    console.log('1. Test the application to ensure everything works');
    console.log('2. Deploy the updated files');
    console.log('3. Clear browser caches if needed');
    
} catch (error) {
    console.error('❌ Error updating version:', error.message);
    process.exit(1);
} 