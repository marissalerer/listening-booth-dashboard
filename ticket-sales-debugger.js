// ticket-sales-debugger.js - Find your ticket sales data
require('dotenv').config();
const axios = require('axios');

async function debugTicketSales() {
    const API_TOKEN = process.env.WIX_API_TOKEN;
    const SITE_ID = process.env.WIX_SITE_ID;
    
    console.log('🎫 DEBUGGING TICKET SALES DATA');
    console.log('===============================');
    
    const headers = {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
        'wix-site-id': SITE_ID
    };
    
    // Get a sample event to test with
    console.log('📅 Getting sample event...');
    let sampleEvent = null;
    try {
        const eventsResponse = await axios.get('https://www.wixapis.com/events/v1/events?limit=1', {
            headers: headers
        });
        sampleEvent = eventsResponse.data.events?.[0];
        if (sampleEvent) {
            console.log(`✅ Sample event: "${sampleEvent.title}" (ID: ${sampleEvent.id})`);
        } else {
            console.log('❌ No events found');
            return;
        }
    } catch (error) {
        console.log('❌ Failed to get events:', error.response?.data);
        return;
    }
    
    console.log('\n🔍 Testing ticket/booking endpoints...\n');
    
    // 1. Test Wix Bookings API
    console.log('1️⃣ Testing Wix Bookings API...');
    const bookingEndpoints = [
        '/bookings/v2/bookings',
        '/bookings/v1/bookings',
        '/bookings/v2/sessions',
        '/bookings/v1/sessions',
        `/bookings/v2/bookings?eventId=${sampleEvent.id}`,
        `/bookings/v1/bookings?serviceId=${sampleEvent.id}`,
        '/bookings/v2/services',
        '/bookings/v1/services'
    ];
    
    for (const endpoint of bookingEndpoints) {
        try {
            console.log(`   Testing: ${endpoint}`);
            const response = await axios.get(`https://www.wixapis.com${endpoint}`, {
                headers: headers
            });
            
            console.log(`   ✅ SUCCESS: ${response.status}`);
            console.log(`   📊 Response: ${JSON.stringify(response.data).substring(0, 200)}...`);
            
            if (response.data.bookings && response.data.bookings.length > 0) {
                console.log(`   🎫 Found ${response.data.bookings.length} bookings!`);
                console.log(`   📝 Sample booking:`, JSON.stringify(response.data.bookings[0], null, 2));
            }
            
        } catch (error) {
            console.log(`   ❌ Failed: ${error.response?.status} - ${error.response?.statusText}`);
        }
    }
    
    // 2. Test Wix Events specific endpoints
    console.log('\n2️⃣ Testing Events-specific endpoints...');
    const eventEndpoints = [
        `/events/v1/events/${sampleEvent.id}/registrations`,
        `/events/v1/events/${sampleEvent.id}/tickets`,
        `/events/v1/events/${sampleEvent.id}/orders`,
        `/events/v1/events/${sampleEvent.id}/attendees`,
        `/events/v1/events/${sampleEvent.id}/rsvps`,
        `/events/v1/events/${sampleEvent.id}/sales`,
        '/events/v1/registrations',
        '/events/v1/tickets',
        '/events/v1/orders'
    ];
    
    for (const endpoint of eventEndpoints) {
        try {
            console.log(`   Testing: ${endpoint}`);
            const response = await axios.get(`https://www.wixapis.com${endpoint}`, {
                headers: headers
            });
            
            console.log(`   ✅ SUCCESS: ${response.status}`);
            console.log(`   📊 Response: ${JSON.stringify(response.data).substring(0, 200)}...`);
            
            if (response.data.registrations) {
                console.log(`   🎫 Found registrations: ${response.data.registrations.length}`);
            }
            if (response.data.tickets) {
                console.log(`   🎫 Found tickets: ${response.data.tickets.length}`);
            }
            if (response.data.orders) {
                console.log(`   🎫 Found orders: ${response.data.orders.length}`);
            }
            
        } catch (error) {
            console.log(`   ❌ Failed: ${error.response?.status} - ${error.response?.statusText}`);
        }
    }
    
    // 3. Test Wix Stores/Ecommerce (if events are sold as products)
    console.log('\n3️⃣ Testing Wix Stores/Ecommerce endpoints...');
    const storeEndpoints = [
        '/stores/v1/orders',
        '/stores/v2/orders',
        '/ecom/v1/orders',
        '/ecom/v1/carts',
        '/stores/v1/products',
        '/ecom/v1/products'
    ];
    
    for (const endpoint of storeEndpoints) {
        try {
            console.log(`   Testing: ${endpoint}`);
            const response = await axios.get(`https://www.wixapis.com${endpoint}`, {
                headers: headers
            });
            
            console.log(`   ✅ SUCCESS: ${response.status}`);
            console.log(`   📊 Response: ${JSON.stringify(response.data).substring(0, 200)}...`);
            
            if (response.data.orders && response.data.orders.length > 0) {
                console.log(`   🛒 Found ${response.data.orders.length} orders!`);
                // Check if any orders contain event-related items
                const eventOrders = response.data.orders.filter(order => 
                    order.lineItems?.some(item => 
                        item.name?.toLowerCase().includes('ticket') || 
                        item.name?.toLowerCase().includes('event') ||
                        item.productName?.toLowerCase().includes('ticket')
                    )
                );
                if (eventOrders.length > 0) {
                    console.log(`   🎫 Found ${eventOrders.length} event-related orders!`);
                    console.log(`   📝 Sample order:`, JSON.stringify(eventOrders[0], null, 2));
                }
            }
            
        } catch (error) {
            console.log(`   ❌ Failed: ${error.response?.status} - ${error.response?.statusText}`);
        }
    }
    
    // 4. Test Wix Pricing Plans (if you use membership/subscription model)
    console.log('\n4️⃣ Testing Wix Pricing Plans endpoints...');
    const pricingEndpoints = [
        '/pricing-plans/v2/plans',
        '/pricing-plans/v1/plans',
        '/pricing-plans/v2/orders',
        '/pricing-plans/v1/orders'
    ];
    
    for (const endpoint of pricingEndpoints) {
        try {
            console.log(`   Testing: ${endpoint}`);
            const response = await axios.get(`https://www.wixapis.com${endpoint}`, {
                headers: headers
            });
            
            console.log(`   ✅ SUCCESS: ${response.status}`);
            console.log(`   📊 Response: ${JSON.stringify(response.data).substring(0, 200)}...`);
            
        } catch (error) {
            console.log(`   ❌ Failed: ${error.response?.status} - ${error.response?.statusText}`);
        }
    }
    
    // 5. Check the sample event for ticket/registration info in the event data itself
    console.log('\n5️⃣ Analyzing event data structure...');
    console.log('Full event data:');
    console.log(JSON.stringify(sampleEvent, null, 2));
    
    // Look for ticket/registration related fields
    const ticketFields = [];
    function findTicketFields(obj, path = '') {
        if (typeof obj === 'object' && obj !== null) {
            Object.keys(obj).forEach(key => {
                const fullPath = path ? `${path}.${key}` : key;
                if (key.toLowerCase().includes('ticket') || 
                    key.toLowerCase().includes('registration') || 
                    key.toLowerCase().includes('booking') ||
                    key.toLowerCase().includes('capacity') ||
                    key.toLowerCase().includes('limit') ||
                    key.toLowerCase().includes('sold') ||
                    key.toLowerCase().includes('available')) {
                    ticketFields.push({ path: fullPath, value: obj[key] });
                }
                findTicketFields(obj[key], fullPath);
            });
        }
    }
    
    findTicketFields(sampleEvent);
    
    if (ticketFields.length > 0) {
        console.log('\n🎫 Found potential ticket-related fields in event data:');
        ticketFields.forEach(field => {
            console.log(`   ${field.path}: ${JSON.stringify(field.value)}`);
        });
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('Based on the test results, here are the next steps:');
    console.log('1. Check which endpoints returned data');
    console.log('2. Look for any orders/bookings that might be ticket sales');
    console.log('3. Check if your events use Wix Bookings vs Wix Stores for ticketing');
    console.log('4. Review the event data structure for built-in ticket counts');
}

debugTicketSales().catch(console.error);