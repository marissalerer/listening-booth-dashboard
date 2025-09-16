// debug-events.js - Deep dive into what's happening with your events
require('dotenv').config();
const axios = require('axios');

async function debugEventsAPI() {
    const API_TOKEN = process.env.WIX_API_TOKEN;
    const SITE_ID = process.env.WIX_SITE_ID;
    
    console.log('🔍 DEBUGGING WIX EVENTS API');
    console.log('=============================');
    console.log(`Site ID: ${SITE_ID}`);
    console.log(`Token: ${API_TOKEN.substring(0, 20)}...`);
    
    const headers = {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
        'wix-site-id': SITE_ID
    };
    
    // 1. Test the basic events endpoint with full response
    console.log('\n1️⃣ Testing basic events endpoint...');
    try {
        const response = await axios.get('https://www.wixapis.com/events/v1/events', {
            headers: headers
        });
        
        console.log('✅ Response Status:', response.status);
        console.log('📊 Full Response Data:');
        console.log(JSON.stringify(response.data, null, 2));
        
        if (response.data.events && response.data.events.length > 0) {
            console.log(`\n📅 Found ${response.data.events.length} events`);
        } else {
            console.log('\n❌ No events found in response');
            console.log('   This could mean:');
            console.log('   - Wrong site ID');
            console.log('   - Events are in a different format');
            console.log('   - API permissions issue');
            console.log('   - Events are stored differently in Wix');
        }
        
    } catch (error) {
        console.log('❌ Basic events API failed:');
        console.log('Status:', error.response?.status);
        console.log('Error:', error.response?.data);
    }
    
    // 2. Test with different query parameters
    console.log('\n2️⃣ Testing with query parameters...');
    const queryParams = [
        '',
        '?limit=100',
        '?limit=1000', 
        '?offset=0&limit=100',
        '?sort=created:desc',
        '?sort=modified:desc'
    ];
    
    for (const params of queryParams) {
        try {
            console.log(`\n   Testing: /events/v1/events${params}`);
            const response = await axios.get(`https://www.wixapis.com/events/v1/events${params}`, {
                headers: headers
            });
            console.log(`   ✅ Status: ${response.status}, Events: ${response.data.events?.length || 0}`);
            
            if (response.data.total !== undefined) {
                console.log(`   📊 Total available: ${response.data.total}`);
            }
            if (response.data.pagingMetadata) {
                console.log(`   📄 Paging:`, response.data.pagingMetadata);
            }
            
        } catch (error) {
            console.log(`   ❌ Failed: ${error.response?.status} - ${error.response?.data?.message}`);
        }
    }
    
    // 3. Check if it's a paging issue
    console.log('\n3️⃣ Testing pagination...');
    try {
        const response = await axios.get('https://www.wixapis.com/events/v1/events?limit=1', {
            headers: headers
        });
        
        console.log('Pagination test response:');
        console.log(JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.log('❌ Pagination test failed:', error.response?.data);
    }
    
    // 4. Test different endpoints that might have events
    console.log('\n4️⃣ Testing alternative endpoints...');
    const alternativeEndpoints = [
        '/events/v1/events',
        '/events/v2/events', 
        '/booking-events/v1/events',
        '/wix-events/v1/events',
        '/events/v1/event-definitions'
    ];
    
    for (const endpoint of alternativeEndpoints) {
        try {
            console.log(`\n   Testing: ${endpoint}`);
            const response = await axios.get(`https://www.wixapis.com${endpoint}`, {
                headers: headers
            });
            console.log(`   ✅ ${endpoint}: ${response.status} - ${JSON.stringify(response.data).substring(0, 200)}...`);
            
        } catch (error) {
            console.log(`   ❌ ${endpoint}: ${error.response?.status} - ${error.response?.statusText}`);
        }
    }
    
    // 5. Check token permissions
    console.log('\n5️⃣ Checking token info...');
    try {
        // Try to decode the JWT token
        const tokenParts = API_TOKEN.split('.');
        if (tokenParts.length >= 2) {
            const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
            console.log('📋 Token payload:');
            console.log(JSON.stringify(payload, null, 2));
            
            if (payload.siteId && payload.siteId !== SITE_ID) {
                console.log(`⚠️  WARNING: Token site ID (${payload.siteId}) doesn't match your SITE_ID (${SITE_ID})`);
            }
        }
    } catch (e) {
        console.log('Could not decode token');
    }
    
    // 6. Test site info endpoint
    console.log('\n6️⃣ Testing site info...');
    try {
        const response = await axios.get('https://www.wixapis.com/site-properties/v4/properties', {
            headers: headers
        });
        console.log('✅ Site info accessible');
        console.log('Site data:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.log('❌ Site info failed:', error.response?.status, error.response?.data);
    }
}

debugEventsAPI().catch(console.error);