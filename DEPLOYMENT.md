# ColorStack Deployment Guide

## Vercel Deployment

This project is configured for easy deployment on Vercel. The following files are set up for deployment:

### Key Files
- `vercel.json` - Vercel configuration with routing and security headers
- `package.json` - Project metadata and scripts
- `manifest.json` - PWA manifest for mobile installation
- `sw.js` - Service worker for offline functionality

### Deployment Steps

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Deploy to Vercel**:
   ```bash
   vercel
   ```

3. **For production deployment**:
   ```bash
   vercel --prod
   ```

### Preview Deployment

For initial preview deployment (not public):
1. Run `vercel` (without --prod flag)
2. This creates a preview URL for testing
3. Test all functionality before going live

### File Structure

```
ColorStack V2/
├── index.html          # Main application
├── privacy.html        # Privacy policy page
├── terms.html          # Terms of service page
├── js/                 # JavaScript files
│   ├── main.js
│   ├── ui.js
│   ├── image_processor.js
│   ├── stl_exporter.js
│   └── main-fallback.js
├── Logo.svg            # Application logo
├── manifest.json       # PWA manifest
├── sw.js              # Service worker
├── vercel.json        # Vercel configuration
├── package.json       # Project metadata
└── [icon files]       # Various icon sizes
```

### Security Headers

The `vercel.json` includes comprehensive security headers:
- Content Security Policy
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection
- Strict-Transport-Security
- Referrer-Policy
- Permissions-Policy

### Caching

Static assets (images, CSS, JS) are cached for 1 year with immutable headers for optimal performance.

### Environment Variables

No environment variables are required for this static deployment.

### Testing Checklist

Before going live, verify:
- [ ] All pages load correctly
- [ ] Image upload functionality works
- [ ] STL export works
- [ ] Service worker registers properly
- [ ] PWA installation works on mobile
- [ ] All icon files are accessible
- [ ] Privacy and Terms pages are accessible
- [ ] No console errors
- [ ] Mobile responsiveness
- [ ] Performance is acceptable

### Troubleshooting

1. **Missing icons**: Ensure all icon files are in the root directory
2. **Service worker issues**: Check browser console for registration errors
3. **CSP violations**: Review Content Security Policy in vercel.json
4. **Routing issues**: Verify vercel.json routes configuration 