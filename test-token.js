// test-token.js - Test your Wix API token
require('dotenv').config();
const axios = require('axios');

async function testWixToken() {
    const API_TOKEN = process.env.WIX_API_TOKEN;
    const SITE_ID = process.env.WIX_SITE_ID; // You might need this too
    
    console.log('🧪 Testing Wix API Token');
    console.log('========================');
    
    if (!API_TOKEN) {
        console.log('❌ No WIX_API_TOKEN found in .env file');
        console.log('Add your token to .env:');
        console.log('WIX_API_TOKEN=your_token_here');
        return;
    }
    
    console.log('✅ Token found:', API_TOKEN.substring(0, 10) + '...');
    
    // Test different API endpoints to see what works
    const endpoints = [
        {
            name: 'Events API',
            url: 'https://www.wixapis.com/events/v1/events',
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json'
            }
        },
        {
            name: 'Events API (with site)',
            url: 'https://www.wixapis.com/events/v1/events',
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json',
                'wix-site-id': SITE_ID
            }
        },
        {
            name: 'Events API (API Key style)',
            url: 'https://www.wixapis.com/events/v1/events',
            headers: {
                'Authorization': `API ${API_TOKEN}`,
                'Content-Type': 'application/json'
            }
        }
    ];
    
    for (const endpoint of endpoints) {
        console.log(`\n🔍 Testing: ${endpoint.name}`);
        
        try {
            const response = await axios.get(endpoint.url, {
                headers: endpoint.headers,
                timeout: 10000
            });
            
            console.log('✅ SUCCESS!');
            console.log(`Status: ${response.status}`);
            console.log(`Events found: ${response.data.events?.length || 0}`);
            
            if (response.data.events && response.data.events.length > 0) {
                console.log('📅 Sample event:');
                const event = response.data.events[0];
                console.log(`   Title: ${event.title || 'No title'}`);
                console.log(`   Date: ${event.scheduling?.startDate || 'No date'}`);
                console.log(`   ID: ${event._id || 'No ID'}`);
            }
            
            // If this one works, no need to test the others
            console.log('\n🎉 This authentication method works!');
            return endpoint;
            
        } catch (error) {
            console.log('❌ Failed');
            if (error.response) {
                console.log(`   Status: ${error.response.status}`);
                console.log(`   Error: ${error.response.data?.message || error.response.statusText}`);
            } else {
                console.log(`   Error: ${error.message}`);
            }
        }
    }
    
    console.log('\n🤔 None of the authentication methods worked.');
    console.log('This might mean:');
    console.log('1. The token needs different permissions');
    console.log('2. You need a Site ID as well');
    console.log('3. The token format is different');
    console.log('4. The token is for a different API');
}

// Also test bookings if events work
async function testBookingsAPI() {
    const API_TOKEN = process.env.WIX_API_TOKEN;
    
    try {
        console.log('\n🎫 Testing Bookings API...');
        const response = await axios.get('https://www.wixapis.com/bookings/v2/bookings', {
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        
        console.log('✅ Bookings API works!');
        console.log(`Bookings found: ${response.data.bookings?.length || 0}`);
        
    } catch (error) {
        console.log('❌ Bookings API failed');
        console.log(`   Error: ${error.response?.data?.message || error.message}`);
    }
}

async function main() {
    const workingMethod = await testWixToken();
    if (workingMethod) {
        await testBookingsAPI();
        
        console.log('\n🚀 Ready to build your venue dashboard!');
        console.log('Your working authentication:');
        console.log(`   Method: ${workingMethod.name}`);
    }
}

main().catch(console.error);