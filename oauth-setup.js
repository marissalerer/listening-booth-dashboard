// oauth-setup.js - Run this once to get your tokens
require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();

// Your app credentials (put these in .env file)
const CLIENT_ID = process.env.WIX_CLIENT_ID;
const CLIENT_SECRET = process.env.WIX_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/auth/callback';

console.log('🔐 Wix OAuth Token Generator');
console.log('================================');

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ Missing WIX_CLIENT_ID or WIX_CLIENT_SECRET in .env file');
    process.exit(1);
}

// Step 1: Start the OAuth flow
app.get('/', (req, res) => {
    const authUrl = `https://www.wix.com/oauth/authorize?` +
        `client_id=${CLIENT_ID}&` +
        `response_type=code&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `scope=${encodeURIComponent('events.read bookings.read')}`;
    
    res.send(`
        <h1>🎵 Get Your Wix Tokens</h1>
        <p>Click the link below to authorize your app and get your tokens:</p>
        <p><a href="${authUrl}" target="_blank" style="background: #0073e6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Authorize with Wix
        </a></p>
        <p><small>This will redirect you back here with your tokens</small></p>
    `);
});

// Step 2: Handle the callback and exchange code for tokens
app.get('/auth/callback', async (req, res) => {
    const { code } = req.query;
    
    if (!code) {
        return res.status(400).send('❌ No authorization code received');
    }

    try {
        console.log('🔄 Exchanging code for tokens...');
        
        const response = await axios.post('https://www.wix.com/oauth/access', {
            grant_type: 'authorization_code',
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code: code,
            redirect_uri: REDIRECT_URI
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const { access_token, refresh_token, expires_in } = response.data;

        console.log('\n🎉 SUCCESS! Here are your tokens:');
        console.log('=====================================');
        console.log('Add these to your .env file:\n');
        console.log(`WIX_ACCESS_TOKEN=${access_token}`);
        console.log(`WIX_REFRESH_TOKEN=${refresh_token}`);
        console.log(`\nAccess token expires in: ${expires_in} seconds`);
        console.log('=====================================\n');

        res.send(`
            <h1>🎉 Success!</h1>
            <p>Your tokens have been generated. Check your terminal for the values to add to your .env file.</p>
            <h3>Add these to your .env file:</h3>
            <pre style="background: #f0f0f0; padding: 10px; border-radius: 5px;">
WIX_ACCESS_TOKEN=${access_token}
WIX_REFRESH_TOKEN=${refresh_token}
            </pre>
            <p><strong>Important:</strong> Keep these tokens secure and never share them publicly!</p>
            <p>You can now close this window and use your Wix Events API.</p>
        `);

        // Optionally save to .env file automatically
        const fs = require('fs');
        let envContent = '';
        try {
            envContent = fs.readFileSync('.env', 'utf8').toString();
        } catch (e) {
            // .env doesn't exist, create it
            envContent = '';
        }
        
        // Update or add tokens
        if (envContent.includes('WIX_ACCESS_TOKEN=')) {
            envContent = envContent.replace(/WIX_ACCESS_TOKEN=.*/, `WIX_ACCESS_TOKEN=${access_token}`);
        } else {
            envContent += `\nWIX_ACCESS_TOKEN=${access_token}`;
        }
        
        if (envContent.includes('WIX_REFRESH_TOKEN=')) {
            envContent = envContent.replace(/WIX_REFRESH_TOKEN=.*/, `WIX_REFRESH_TOKEN=${refresh_token}`);
        } else {
            envContent += `\nWIX_REFRESH_TOKEN=${refresh_token}`;
        }
        
        fs.writeFileSync('.env', envContent);
        console.log('✅ Tokens automatically saved to .env file');
        
        setTimeout(() => {
            process.exit(0);
        }, 2000);

    } catch (error) {
        console.error('❌ Error exchanging code for tokens:', error.response?.data || error.message);
        res.status(500).send(`Error: ${error.response?.data?.error_description || error.message}`);
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`\n🚀 OAuth server running at http://localhost:${PORT}`);
    console.log('💡 Open http://localhost:3000 in your browser to start');
});

// Auto-open browser (optional)
// const open = require('open');
// setTimeout(() => {
//     open(`http://localhost:3000`);
// }, 1000);
