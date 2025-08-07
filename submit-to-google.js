const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Configuration
const SERVICE_ACCOUNT_KEY_PATH = './colorstack-api-bceea317d5af.json';
const SCOPES = ['https://www.googleapis.com/auth/indexing'];

// URLs to submit for indexing
const URLs_TO_SUBMIT = [
  'https://colorstack.app/',
  'https://colorstack.app/privacy.html',
  'https://colorstack.app/terms.html'
];

async function submitUrlsToGoogleIndexing() {
  try {
    console.log('🚀 Starting Google Indexing API submission...\n');

    // Check if service account key file exists
    if (!fs.existsSync(SERVICE_ACCOUNT_KEY_PATH)) {
      throw new Error(`Service account key file not found: ${SERVICE_ACCOUNT_KEY_PATH}`);
    }

    // Load service account credentials
    const credentials = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_KEY_PATH, 'utf8'));
    
    // Create JWT client
    const auth = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      SCOPES
    );

    // Create Indexing API client
    const indexing = google.indexing({ version: 'v3', auth });

    console.log(`📋 Submitting ${URLs_TO_SUBMIT.length} URLs for indexing...\n`);

    // Submit each URL
    for (const url of URLs_TO_SUBMIT) {
      try {
        console.log(`📤 Submitting: ${url}`);
        
        const response = await indexing.urlNotifications.publish({
          requestBody: {
            url: url,
            type: 'URL_UPDATED'
          }
        });

        console.log(`✅ Successfully submitted: ${url}`);
        console.log(`   Response: ${response.data.urlNotificationMetadata?.latestUpdate?.notifyTime || 'No metadata'}\n`);

      } catch (error) {
        console.error(`❌ Failed to submit ${url}:`);
        console.error(`   Error: ${error.message}`);
        
        if (error.response?.data) {
          console.error(`   API Error: ${JSON.stringify(error.response.data, null, 2)}`);
        }
        console.log('');
      }
    }

    console.log('🎉 URL submission process completed!');

  } catch (error) {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  submitUrlsToGoogleIndexing();
}

module.exports = { submitUrlsToGoogleIndexing }; 