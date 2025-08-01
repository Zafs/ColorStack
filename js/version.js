// Version configuration for cache busting
const VERSION_CONFIG = {
    // Main version - increment this for major updates
    version: '2.1.2',
    
    // Individual asset versions - increment these for specific file updates
    assets: {
        'js/main.js': '2.1.2',
        'js/ui.js': '2.1.2', 
        'js/image_processor.js': '2.1.2',
        'js/stl_exporter.js': '2.1.2',
        'js/main-fallback.js': '2.1.2',
        'Logo.svg': '2.1.2',
        'manifest.json': '2.1.2'
    },
    
    // External resources that should be cached
    externals: {
        'https://cdn.tailwindcss.com?plugins=forms,container-queries': '2.1.2',
        'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap': '2.1.2',
        'https://fonts.googleapis.com/icon?family=Material+Icons': '2.1.2'
    }
};

// Cache busting utility functions
const CacheBuster = {
    // Get versioned URL for a resource
    getVersionedUrl: function(path) {
        if (path.startsWith('http')) {
            // External resource
            const version = VERSION_CONFIG.externals[path];
            if (version) {
                const separator = path.includes('?') ? '&' : '?';
                return `${path}${separator}v=${version}`;
            }
            return path;
        } else {
            // Local resource
            const version = VERSION_CONFIG.assets[path] || VERSION_CONFIG.version;
            const separator = path.includes('?') ? '&' : '?';
            return `${path}${separator}v=${version}`;
        }
    },
    
    // Get all versioned URLs for static files
    getStaticFiles: function() {
        const files = [];
        
        // Add local files
        Object.keys(VERSION_CONFIG.assets).forEach(path => {
            files.push(this.getVersionedUrl(path));
        });
        
        // Add external files
        Object.keys(VERSION_CONFIG.externals).forEach(url => {
            files.push(this.getVersionedUrl(url));
        });
        
        return files;
    },
    
    // Update all script and link tags with versioned URLs
    updateResourceUrls: function() {
        // Update script tags
        const scripts = document.querySelectorAll('script[src]');
        scripts.forEach(script => {
            const src = script.getAttribute('src');
            if (src && !src.startsWith('data:') && !src.startsWith('blob:')) {
                script.setAttribute('src', this.getVersionedUrl(src));
            }
        });
        
        // Update link tags (CSS, icons, etc.)
        const links = document.querySelectorAll('link[href]');
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (href && !href.startsWith('data:') && !href.startsWith('blob:')) {
                link.setAttribute('href', this.getVersionedUrl(href));
            }
        });
    }
};

// Auto-update URLs when this script loads
if (typeof document !== 'undefined') {
    CacheBuster.updateResourceUrls();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VERSION_CONFIG, CacheBuster };
} 