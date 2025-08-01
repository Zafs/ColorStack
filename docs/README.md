# ColorStack - Free HueForge Alternative

Transform any image into beautiful multi-color 3D prints with ColorStack. Free, browser-based tool for creating color-layered STL files.

## 🌟 Features

- **Image Processing**: Upload PNG, JPEG, or BMP images
- **Color Detection**: Automatic color palette generation using k-means clustering
- **Layer Preview**: Real-time preview of each color layer
- **STL Export**: Generate 3D printable STL files with height-based color layers
- **Custom Palettes**: Use your own filament colors
- **Cross-Platform**: Works on desktop, tablet, and mobile devices
- **Offline Support**: Service worker for offline functionality
- **PWA Ready**: Install as a native app

## 🚀 Browser Compatibility

ColorStack is optimized for maximum browser and device compatibility:

### ✅ Fully Supported Browsers
- **Chrome** 60+ (2017)
- **Firefox** 55+ (2017)
- **Safari** 11+ (2017)
- **Edge** 79+ (2020)
- **Opera** 47+ (2017)

### ✅ Mobile Browsers
- **iOS Safari** 11+
- **Chrome Mobile** 60+
- **Firefox Mobile** 55+
- **Samsung Internet** 7.2+

### ⚠️ Limited Support (Fallback Mode)
- **Internet Explorer** 11 (basic functionality)
- **Older browsers** (reduced features)

## 📱 Device Compatibility

### Desktop
- Windows 10/11
- macOS 10.14+
- Linux (Ubuntu, Fedora, etc.)

### Mobile & Tablet
- iOS 11+ (iPhone, iPad)
- Android 7+ (phones, tablets)
- Touch-optimized interface
- Responsive design

### Accessibility
- Screen reader support
- Keyboard navigation
- High contrast mode
- Reduced motion support
- Focus indicators

## 🛠️ Technical Features

### Performance Optimizations
- **Lazy Loading**: Resources loaded on demand
- **Image Compression**: Automatic image optimization
- **Caching**: Service worker for offline access
- **Memory Management**: Efficient canvas operations

### Security
- **Client-side Processing**: No data sent to servers
- **File Validation**: Secure file type checking
- **CSP Headers**: Content Security Policy
- **XSS Protection**: Input sanitization

### Progressive Web App (PWA)
- **Offline Support**: Works without internet
- **App Installation**: Install as native app
- **Background Sync**: Automatic updates
- **Push Notifications**: Future feature ready

## 📋 System Requirements

### Minimum Requirements
- **RAM**: 2GB
- **Storage**: 50MB free space
- **Browser**: Modern web browser (see compatibility list)
- **Internet**: Required for initial load, optional for use

### Recommended Requirements
- **RAM**: 4GB+
- **Storage**: 100MB free space
- **Browser**: Latest version of Chrome/Firefox/Safari
- **Internet**: Stable connection for best experience

## 🔧 Installation

### Web Version (Recommended)
1. Visit [colorstack.app](https://colorstack.app)
2. No installation required
3. Works immediately in any modern browser

### PWA Installation
1. Visit [colorstack.app](https://colorstack.app)
2. Click "Install" in browser menu
3. App will be available in your app launcher

### Offline Installation
1. Visit the website once to cache resources
2. App will work offline on subsequent visits
3. Service worker handles caching automatically

## 📖 Usage Guide

### Getting Started
1. **Upload Image**: Click the upload area or drag & drop an image
2. **Adjust Settings**: Modify color bands, layer height, and dimensions
3. **Preview Layers**: Use the layer slider to see each color layer
4. **Export STL**: Click "Export STL" to download your 3D model

### Advanced Features
- **Custom Colors**: Click on palette colors to change them
- **My Filaments**: Add your own filament colors
- **Slicer Instructions**: Get step-by-step slicer setup
- **Layer Preview**: Toggle between cumulative and single layer views

### Mobile Usage
- **Touch Gestures**: Tap to interact, pinch to zoom
- **Responsive Layout**: Automatically adapts to screen size
- **Optimized Controls**: Larger touch targets for mobile
- **Portrait/Landscape**: Works in both orientations

## 🔄 Updates & Compatibility

### Automatic Updates
- Service worker checks for updates
- User is notified of new versions
- One-click update process
- Graceful fallback for older browsers

### Version History
- **v2.1.0**: Enhanced compatibility, PWA features
- **v2.0.0**: Major UI overhaul, performance improvements
- **v1.0.0**: Initial release

### Browser Feature Detection
The app automatically detects browser capabilities and adjusts functionality:
- **ES6 Modules**: Modern browsers get full features
- **Fallback Mode**: Older browsers get simplified version
- **Canvas Support**: Image processing adapts to capability
- **File API**: Upload functionality adjusts to support

## 🐛 Troubleshooting

### Common Issues

**App won't load**
- Check internet connection
- Try refreshing the page
- Clear browser cache
- Update your browser

**Images won't upload**
- Ensure file is PNG, JPEG, or BMP
- Check file size (max 10MB)
- Try a different browser
- Check browser permissions

**Export fails**
- Ensure image is loaded
- Check browser download settings
- Try a different browser
- Clear browser cache

**Mobile issues**
- Use landscape orientation
- Ensure sufficient storage space
- Check mobile browser version
- Try desktop version

### Performance Tips
- Use smaller images for faster processing
- Close other browser tabs
- Restart browser if slow
- Use desktop for large images

## 🔒 Privacy & Security

### Data Handling
- **No Server Processing**: All processing happens in your browser
- **No Data Collection**: We don't collect or store your images
- **Local Storage**: Settings saved locally on your device
- **Privacy First**: No tracking or analytics

### Security Features
- **File Validation**: Secure file type checking
- **Memory Safety**: Proper cleanup of resources
- **CSP Protection**: Content Security Policy headers
- **XSS Prevention**: Input sanitization

## 🤝 Contributing

### Development
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test across multiple browsers
5. Submit a pull request

### Testing
- Test on multiple browsers
- Test on mobile devices
- Test with different image types
- Test offline functionality

### Browser Testing Matrix
- Chrome (desktop & mobile)
- Firefox (desktop & mobile)
- Safari (desktop & mobile)
- Edge (desktop & mobile)
- Older browser versions

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **HueForge**: Inspiration for the concept
- **3D Printing Community**: Feedback and testing
- **Open Source Libraries**: Tailwind CSS, Material Icons
- **Browser Vendors**: For modern web standards

## 📞 Support

- **Discord**: [Join our community](https://discord.gg/P4VyGBvzZS)
- **Issues**: Report bugs on GitHub
- **Feedback**: Use the feedback button in the app
- **Documentation**: Check this README for help

---

**ColorStack** - Making multi-color 3D printing accessible to everyone, everywhere, on any device.