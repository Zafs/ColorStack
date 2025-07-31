# Security Policy

## Overview
ColorStack is a client-side web application that processes images locally in the browser. No user data is transmitted to external servers except for analytics.

## Security Measures

### Content Security Policy (CSP)
- **Script Sources**: Only allows scripts from `'self'`, `'unsafe-inline'` (for Tailwind), and `https://plausible.io`
- **Style Sources**: Allows styles from `'self'`, `'unsafe-inline'`, and `https://fonts.googleapis.com`
- **Font Sources**: Only allows fonts from `https://fonts.gstatic.com`
- **Image Sources**: Allows `'self'`, `data:` URIs, and `blob:` URIs for file processing
- **Connect Sources**: Only allows connections to `'self'` and `https://plausible.io`
- **Object Sources**: Set to `'none'` to prevent plugin execution
- **Frame Ancestors**: Set to `'none'` to prevent clickjacking

### Security Headers
- **X-Content-Type-Options**: `nosniff` - Prevents MIME type sniffing
- **X-Frame-Options**: `DENY` - Prevents clickjacking attacks
- **X-XSS-Protection**: `1; mode=block` - Enables XSS protection
- **Referrer-Policy**: `strict-origin-when-cross-origin` - Controls referrer information
- **Permissions-Policy**: Restricts access to camera, microphone, geolocation, and payment APIs
- **Strict-Transport-Security**: Enforces HTTPS with 1-year max age

### Input Validation
- **File Uploads**: Restricted to PNG, JPEG, and BMP files with 10MB size limit
- **Numeric Inputs**: All numeric fields have min/max constraints and step values
- **Range Inputs**: Sliders have proper min/max constraints

### Data Handling
- **Local Storage**: Only stores user filament preferences locally
- **No Server Communication**: All processing happens client-side
- **No Sensitive Data**: No personal or sensitive information is collected

### External Dependencies
- **Tailwind CSS**: Loaded from CDN with integrity checks
- **Google Fonts**: Loaded with `crossorigin` attribute
- **Plausible Analytics**: Privacy-focused analytics with no cookies

## Vulnerability Reporting
If you discover a security vulnerability, please report it to the project maintainers.

## Updates
This security policy is reviewed and updated regularly to ensure best practices are maintained. 