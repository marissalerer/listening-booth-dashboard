// ticket-data-analyzer.js - Find where pricing data is stored
require('dotenv').config();
const axios = require('axios');

async function analyzeTicketData() {
    const API_TOKEN = process.env.WIX_API_TOKEN;
    const SITE_ID = process.env.WIX_SITE_ID;
    
    console.log('🔍 ANALYZING TICKET DATA STRUCTURE FOR PRICING');
    console.log('===============================================');
    
    const headers = {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
        'wix-site-id': SITE_ID
    };
    
    // Get some events that have tickets sold
    const highSalesEvents = [
        'fd15c5fe-56ad-4985-98fd-48123ba32384', // New Year's Eve (12 tickets)
        // We'll add more if we find them
    ];
    
    // First, let's get some sample tickets from events we know have sales
    console.log('1️⃣ Getting sample tickets from events with sales...\n');
    
    try {
        // Get tickets from the first event
        const ticketsResponse = await axios.get(`https://www.wixapis.com/events/v1/events/${highSalesEvents[0]}/tickets?limit=10`, {
            headers: headers
        });
        
        const tickets = ticketsResponse.data.tickets || [];
        
        if (tickets.length > 0) {
            console.log(`✅ Found ${tickets.length} tickets for analysis`);
            console.log('\n📋 COMPLETE TICKET DATA STRUCTURE:');
            console.log('=====================================');
            
            // Show the complete structure of the first ticket
            console.log(JSON.stringify(tickets[0], null, 2));
            
            console.log('\n🔍 SEARCHING FOR PRICE-RELATED FIELDS:');
            console.log('=====================================');
            
            // Function to recursively find all price-related fields
            function findPriceFields(obj, path = '') {
                const priceFields = [];
                
                if (typeof obj === 'object' && obj !== null) {
                    Object.keys(obj).forEach(key => {
                        const fullPath = path ? `${path}.${key}` : key;
                        const value = obj[key];
                        
                        // Check if field name suggests it contains price info
                        if (key.toLowerCase().includes('price') || 
                            key.toLowerCase().includes('cost') || 
                            key.toLowerCase().includes('amount') || 
                            key.toLowerCase().includes('fee') || 
                            key.toLowerCase().includes('total') ||
                            key.toLowerCase().includes('revenue') ||
                            key.toLowerCase().includes('payment')) {
                            priceFields.push({ path: fullPath, value: value });
                        }
                        
                        // Recursively search nested objects
                        if (typeof value === 'object' && value !== null) {
                            priceFields.push(...findPriceFields(value, fullPath));
                        }
                    });
                }
                
                return priceFields;
            }
            
            const priceFields = findPriceFields(tickets[0]);
            
            if (priceFields.length > 0) {
                priceFields.forEach(field => {
                    console.log(`   ${field.path}: ${JSON.stringify(field.value)}`);
                });
            } else {
                console.log('   ❌ No price-related fields found in ticket data');
            }
            
            // Check all tickets for any price patterns
            console.log('\n📊 ANALYZING ALL TICKETS FOR PRICE PATTERNS:');
            console.log('=============================================');
            
            tickets.forEach((ticket, index) => {
                console.log(`\nTicket ${index + 1}:`);
                console.log(`   ID: ${ticket.id || 'N/A'}`);
                console.log(`   Status: ${ticket.status || 'N/A'}`);
                console.log(`   Created: ${ticket.created || 'N/A'}`);
                
                const ticketPriceFields = findPriceFields(ticket);
                if (ticketPriceFields.length > 0) {
                    console.log(`   Price fields found:`);
                    ticketPriceFields.forEach(field => {
                        console.log(`      ${field.path}: ${JSON.stringify(field.value)}`);
                    });
                } else {
                    console.log(`   No price data found`);
                }
            });
            
        } else {
            console.log('❌ No tickets found for this event');
        }
        
    } catch (error) {
        console.log('❌ Error fetching tickets:', error.response?.data || error.message);
    }
    
    // Also check if there's pricing info in the event data itself
    console.log('\n2️⃣ Checking event data for pricing information...\n');
    
    try {
        const eventResponse = await axios.get(`https://www.wixapis.com/events/v1/events/${highSalesEvents[0]}`, {
            headers: headers
        });
        
        const event = eventResponse.data.event || eventResponse.data;
        
        console.log('🎫 EVENT PRICING FIELDS:');
        console.log('========================');
        
        function findPriceFields(obj, path = '') {
            const priceFields = [];
            
            if (typeof obj === 'object' && obj !== null) {
                Object.keys(obj).forEach(key => {
                    const fullPath = path ? `${path}.${key}` : key;
                    const value = obj[key];
                    
                    if (key.toLowerCase().includes('price') || 
                        key.toLowerCase().includes('cost') || 
                        key.toLowerCase().includes('ticket') ||
                        key.toLowerCase().includes('fee') || 
                        key.toLowerCase().includes('payment') ||
                        key.toLowerCase().includes('registration')) {
                        priceFields.push({ path: fullPath, value: value });
                    }
                    
                    if (typeof value === 'object' && value !== null) {
                        priceFields.push(...findPriceFields(value, fullPath));
                    }
                });
            }
            
            return priceFields;
        }
        
        const eventPriceFields = findPriceFields(event);
        
        if (eventPriceFields.length > 0) {
            eventPriceFields.forEach(field => {
                console.log(`   ${field.path}: ${JSON.stringify(field.value)}`);
            });
        } else {
            console.log('   ❌ No pricing fields found in event data');
        }
        
    } catch (error) {
        console.log('❌ Error fetching event:', error.response?.data || error.message);
    }
    
    // Check orders endpoint for pricing (if it works)
    console.log('\n3️⃣ Checking orders for pricing information...\n');
    
    try {
        const ordersResponse = await axios.get('https://www.wixapis.com/events/v1/orders?limit=5', {
            headers: headers
        });
        
        const orders = ordersResponse.data.orders || [];
        
        if (orders.length > 0) {
            console.log(`✅ Found ${orders.length} orders for analysis`);
            console.log('\n📋 SAMPLE ORDER DATA:');
            console.log('====================');
            console.log(JSON.stringify(orders[0], null, 2));
            
            // Look for price fields in orders
            console.log('\n💰 ORDER PRICING FIELDS:');
            orders.forEach((order, index) => {
                console.log(`\nOrder ${index + 1}:`);
                console.log(`   ID: ${order.id || 'N/A'}`);
                console.log(`   Event ID: ${order.eventId || 'N/A'}`);
                console.log(`   Status: ${order.status || 'N/A'}`);
                
                function findPriceFields(obj, path = '') {
                    const priceFields = [];
                    
                    if (typeof obj === 'object' && obj !== null) {
                        Object.keys(obj).forEach(key => {
                            const fullPath = path ? `${path}.${key}` : key;
                            const value = obj[key];
                            
                            if (key.toLowerCase().includes('price') || 
                                key.toLowerCase().includes('cost') || 
                                key.toLowerCase().includes('amount') || 
                                key.toLowerCase().includes('total') ||
                                key.toLowerCase().includes('fee') || 
                                key.toLowerCase().includes('payment')) {
                                priceFields.push({ path: fullPath, value: value });
                            }
                            
                            if (typeof value === 'object' && value !== null) {
                                priceFields.push(...findPriceFields(value, fullPath));
                            }
                        });
                    }
                    
                    return priceFields;
                }
                
                const orderPriceFields = findPriceFields(order);
                if (orderPriceFields.length > 0) {
                    console.log(`   Price fields:`);
                    orderPriceFields.forEach(field => {
                        console.log(`      ${field.path}: ${JSON.stringify(field.value)}`);
                    });
                } else {
                    console.log(`   No price data found`);
                }
            });
            
        } else {
            console.log('❌ No orders found');
        }
        
    } catch (error) {
        console.log('❌ Error fetching orders:', error.response?.data || error.message);
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('==================');
    console.log('Based on the analysis above:');
    console.log('1. Look for the actual price fields in the ticket/order data');
    console.log('2. Check if prices are stored in the event configuration');
    console.log('3. Determine if revenue calculation is possible with available data');
    console.log('4. Consider alternative approaches if pricing data is not in the API');
}

analyzeTicketData().catch(console.error);