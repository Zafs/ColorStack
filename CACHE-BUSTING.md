# Cache Busting System for ColorStack

## Overview

ColorStack now includes a comprehensive cache busting system that ensures users always get the latest version of your application, even when browsers aggressively cache static assets.

## How It Works

### 1. Version-Based URLs
All static assets (JavaScript, CSS, images, etc.) now include version parameters in their URLs:
- `js/main.js?v=2.1.1`
- `https://cdn.tailwindcss.com?plugins=forms,container-queries&v=2.1.1`

### 2. Version Configuration
The `js/version.js` file contains the central version configuration:
```javascript
const VERSION_CONFIG = {
    version: '2.1.1',
    assets: {
        'js/main.js': '2.1.1',
        'js/ui.js': '2.1.1',
        // ... more assets
    },
    externals: {
        'https://cdn.tailwindcss.com?plugins=forms,container-queries': '2.1.1',
        // ... external resources
    }
};
```

### 3. Service Worker Integration
The service worker (`sw.js`) has been updated to:
- Use versioned URLs for caching
- Handle cache invalidation when versions change
- Maintain separate cache names for different versions

## Files Modified

### Core Files
- `js/version.js` - Version configuration and cache busting utilities
- `sw.js` - Updated service worker with version-aware caching
- `build.js` - Automated version update script

### HTML Files
- `index.html` - Updated with versioned resource URLs
- `privacy.html` - Updated with versioned resource URLs  
- `terms.html` - Updated with versioned resource URLs

## Usage

### Updating Versions

To update the version across all files, use the build script:

```bash
# Update to a specific version
node build.js 2.1.2

# Or use the default version (2.1.1)
node build.js
```

### Manual Version Updates

If you need to update versions manually:

1. **Update `js/version.js`**:
   - Change the main `version` field
   - Update individual asset versions as needed

2. **Update HTML files**:
   - Add `?v=VERSION` to all script and link tags
   - Update external resource URLs

3. **Update `sw.js`**:
   - Update cache names
   - Update VERSION_CONFIG

### Best Practices

1. **Increment versions** when making changes to:
   - JavaScript files
   - CSS styles
   - Images or icons
   - Service worker logic

2. **Test thoroughly** after version updates to ensure:
   - All resources load correctly
   - Service worker caches properly
   - No broken links

3. **Monitor cache behavior** using browser dev tools:
   - Check Network tab for versioned URLs
   - Verify Service Worker cache storage
   - Test offline functionality

## Cache Strategy

### Static Assets
- **Cache First**: Serve from cache, update in background
- **Long-term caching**: Assets are cached until version changes
- **Automatic invalidation**: New versions force cache refresh

### HTML Pages
- **Network First**: Try network, fallback to cache
- **Always fresh**: HTML content stays current

### External Resources
- **Cache First**: External CDN resources cached locally
- **Version control**: External resources also versioned

## Troubleshooting

### Common Issues

1. **Old versions still loading**:
   - Clear browser cache completely
   - Unregister service worker
   - Hard refresh (Ctrl+F5)

2. **Service worker not updating**:
   - Check browser dev tools > Application > Service Workers
   - Force update or unregister

3. **Version mismatch**:
   - Ensure all files have consistent versions
   - Run `node build.js` to sync versions

### Debug Tools

- **Browser Dev Tools**: Check Network tab for versioned URLs
- **Service Worker**: Application tab > Service Workers
- **Cache Storage**: Application tab > Storage > Cache Storage

## Version History

- `2.1.1` - Initial cache busting implementation
- `2.1.0` - Previous version (no cache busting)

## Future Improvements

- [ ] Automatic version generation based on file hashes
- [ ] Webpack/Vite integration for build-time versioning
- [ ] CDN integration for better global caching
- [ ] Progressive cache invalidation strategies 