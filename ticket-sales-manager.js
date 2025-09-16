// ticket-sales-manager.js - Get real ticket sales data
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

class TicketSalesManager {
    constructor() {
        this.apiToken = process.env.WIX_API_TOKEN;
        this.siteId = process.env.WIX_SITE_ID;
        this.baseUrl = 'https://www.wixapis.com';
        
        if (!this.apiToken || !this.siteId) {
            throw new Error('Missing WIX_API_TOKEN or WIX_SITE_ID in .env file');
        }
    }

    getHeaders() {
        return {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
            'wix-site-id': this.siteId
        };
    }

    // Get tickets for a specific event
    async getEventTickets(eventId) {
        try {
            console.log(`🎫 Fetching tickets for event: ${eventId}`);
            
            let allTickets = [];
            let offset = 0;
            const limit = 100;
            
            while (true) {
                const response = await axios.get(`${this.baseUrl}/events/v1/events/${eventId}/tickets?limit=${limit}&offset=${offset}`, {
                    headers: this.getHeaders()
                });
                
                const tickets = response.data.tickets || [];
                allTickets.push(...tickets);
                
                console.log(`   Batch: ${tickets.length} tickets (total: ${response.data.total})`);
                
                if (tickets.length < limit || allTickets.length >= response.data.total) {
                    break;
                }
                offset += limit;
            }
            
            return {
                success: true,
                tickets: allTickets,
                total: allTickets.length
            };
        } catch (error) {
            console.error(`Error fetching tickets for event ${eventId}:`, error.response?.data || error.message);
            return { success: false, error: error.message, tickets: [], total: 0 };
        }
    }

    // Get orders for a specific event
    async getEventOrders(eventId) {
        try {
            console.log(`📋 Fetching orders for event: ${eventId}`);
            
            let allOrders = [];
            let offset = 0;
            const limit = 100;
            
            while (true) {
                const response = await axios.get(`${this.baseUrl}/events/v1/orders?limit=${limit}&offset=${offset}`, {
                    headers: this.getHeaders()
                });
                
                const orders = response.data.orders || [];
                
                // Filter orders for this specific event
                const eventOrders = orders.filter(order => order.eventId === eventId);
                allOrders.push(...eventOrders);
                
                if (orders.length < limit) {
                    break;
                }
                offset += limit;
            }
            
            return {
                success: true,
                orders: allOrders,
                total: allOrders.length
            };
        } catch (error) {
            console.error(`Error fetching orders for event ${eventId}:`, error.response?.data || error.message);
            return { success: false, error: error.message, orders: [], total: 0 };
        }
    }

    // Get all tickets (for analysis)
    async getAllTickets(limit = 1000) {
        try {
            console.log(`🎫 Fetching all tickets (limit: ${limit})...`);
            
            let allTickets = [];
            let offset = 0;
            const batchSize = 100;
            
            while (allTickets.length < limit) {
                const response = await axios.get(`${this.baseUrl}/events/v1/tickets?limit=${batchSize}&offset=${offset}`, {
                    headers: this.getHeaders()
                });
                
                const tickets = response.data.tickets || [];
                allTickets.push(...tickets);
                
                console.log(`   Fetched ${tickets.length} tickets (total so far: ${allTickets.length}/${response.data.total})`);
                
                if (tickets.length < batchSize || allTickets.length >= limit) {
                    break;
                }
                offset += batchSize;
            }
            
            return {
                success: true,
                tickets: allTickets,
                total: allTickets.length
            };
        } catch (error) {
            console.error('Error fetching all tickets:', error.response?.data || error.message);
            return { success: false, error: error.message, tickets: [], total: 0 };
        }
    }

    // Get all orders (for analysis)
    async getAllOrders(limit = 1000) {
        try {
            console.log(`📋 Fetching all orders (limit: ${limit})...`);
            
            let allOrders = [];
            let offset = 0;
            const batchSize = 100;
            
            while (allOrders.length < limit) {
                const response = await axios.get(`${this.baseUrl}/events/v1/orders?limit=${batchSize}&offset=${offset}`, {
                    headers: this.getHeaders()
                });
                
                const orders = response.data.orders || [];
                allOrders.push(...orders);
                
                console.log(`   Fetched ${orders.length} orders (total so far: ${allOrders.length}/${response.data.total})`);
                
                if (orders.length < batchSize || allOrders.length >= limit) {
                    break;
                }
                offset += batchSize;
            }
            
            return {
                success: true,
                orders: allOrders,
                total: allOrders.length
            };
        } catch (error) {
            console.error('Error fetching all orders:', error.response?.data || error.message);
            return { success: false, error: error.message, orders: [], total: 0 };
        }
    }

    // Get upcoming events with real ticket sales data
    async getUpcomingEventsWithSales(limit = 20) {
        try {
            console.log(`📅 Fetching next ${limit} events with ticket sales...`);
            
            // Get upcoming events
            let allEvents = [];
            let offset = 0;
            const batchSize = 100;
            
            while (true) {
                const response = await axios.get(`${this.baseUrl}/events/v1/events?limit=${batchSize}&offset=${offset}`, {
                    headers: this.getHeaders()
                });
                
                const events = response.data.events || [];
                if (events.length === 0) break;
                
                allEvents.push(...events);
                offset += batchSize;
                
                if (events.length < batchSize) break;
            }
            
            // Filter for upcoming events
            const now = new Date();
            const upcomingEvents = allEvents
                .filter(event => {
                    const eventDate = new Date(event.scheduling?.config?.startDate);
                    return eventDate > now;
                })
                .sort((a, b) => 
                    new Date(a.scheduling?.config?.startDate) - new Date(b.scheduling?.config?.startDate)
                )
                .slice(0, limit);
            
            console.log(`   Found ${upcomingEvents.length} upcoming events`);
            
            // Get ticket sales for each event
            const eventsWithSales = await Promise.all(
                upcomingEvents.map(async (event) => {
                    const [ticketsResult, ordersResult] = await Promise.all([
                        this.getEventTickets(event.id),
                        this.getEventOrders(event.id)
                    ]);
                    
                    const ticketsSold = ticketsResult.total;
                    const ordersCount = ordersResult.total;
                    
                    // Calculate revenue if we have ticket data
                    let totalRevenue = 0;
                    if (ticketsResult.success && ticketsResult.tickets.length > 0) {
                        totalRevenue = ticketsResult.tickets.reduce((sum, ticket) => {
                            return sum + (parseFloat(ticket.price?.amount) || 0);
                        }, 0);
                    }
                    
                    // Calculate days until event
                    const eventDate = new Date(event.scheduling?.config?.startDate);
                    const daysFromNow = Math.ceil((eventDate - new Date()) / (1000 * 60 * 60 * 24));
                    
                    return {
                        ...event,
                        ticketsSold,
                        ordersCount,
                        totalRevenue,
                        daysFromNow,
                        salesStatus: this.getSalesStatus(ticketsSold, daysFromNow),
                        ticketData: ticketsResult.tickets,
                        orderData: ordersResult.orders
                    };
                })
            );
            
            return {
                success: true,
                events: eventsWithSales,
                total: eventsWithSales.length,
                generatedAt: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('Error fetching events with sales:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }

    // Determine sales status
    getSalesStatus(ticketsSold, daysFromNow) {
        if (ticketsSold === 0) {
            return daysFromNow <= 7 ? 'urgent' : 'low';
        } else if (ticketsSold < 10) {
            return 'low';
        } else if (ticketsSold < 25) {
            return 'medium';
        } else {
            return 'high';
        }
    }

    // Generate sales report
    async generateSalesReport(limit = 20) {
        try {
            const data = await this.getUpcomingEventsWithSales(limit);
            
            if (!data.success) {
                throw new Error(data.error);
            }
            
            const totalTicketsSold = data.events.reduce((sum, event) => sum + event.ticketsSold, 0);
            const totalRevenue = data.events.reduce((sum, event) => sum + event.totalRevenue, 0);
            const averageTicketsPerEvent = data.events.length > 0 ? 
                Math.round(totalTicketsSold / data.events.length * 10) / 10 : 0;
            
            const report = {
                venue: {
                    name: "The Listening Booth",
                    location: "Lewes, Delaware"
                },
                summary: {
                    totalUpcomingEvents: data.events.length,
                    totalTicketsSold,
                    totalRevenue,
                    averageTicketsPerEvent,
                    highSalesEvents: data.events.filter(e => e.salesStatus === 'high').length,
                    lowSalesEvents: data.events.filter(e => e.salesStatus === 'low').length,
                    urgentEvents: data.events.filter(e => e.salesStatus === 'urgent').length
                },
                events: data.events.map(event => ({
                    title: event.title,
                    date: event.scheduling?.formatted,
                    daysFromNow: event.daysFromNow,
                    ticketsSold: event.ticketsSold,
                    revenue: event.totalRevenue,
                    salesStatus: event.salesStatus,
                    venue: event.location?.name || 'The Listening Booth',
                    eventId: event.id
                })),
                generatedAt: data.generatedAt
            };
            
            return { success: true, report };
            
        } catch (error) {
            console.error('Error generating sales report:', error.message);
            return { success: false, error: error.message };
        }
    }

    // Print sales report
    async printSalesReport(limit = 20) {
        const reportData = await this.generateSalesReport(limit);
        
        if (!reportData.success) {
            console.log('❌ Error generating sales report:', reportData.error);
            return;
        }
        
        const report = reportData.report;
        
        console.log('\n🎫 THE LISTENING BOOTH - TICKET SALES REPORT');
        console.log('==============================================');
        console.log(`📊 ${report.summary.totalUpcomingEvents} events | ${report.summary.totalTicketsSold} tickets sold | $${report.summary.totalRevenue.toFixed(2)} revenue`);
        console.log(`📈 Avg: ${report.summary.averageTicketsPerEvent} tickets/event | High sales: ${report.summary.highSalesEvents} | Urgent: ${report.summary.urgentEvents}\n`);
        
        report.events.forEach((event, index) => {
            const statusIcon = {
                'high': '🔥',
                'medium': '👍', 
                'low': '📢',
                'urgent': '⚠️'
            }[event.salesStatus] || '📊';
            
            console.log(`${index + 1}. ${event.title}`);
            console.log(`   📅 ${event.date} (${event.daysFromNow} days away)`);
            console.log(`   ${statusIcon} ${event.ticketsSold} tickets sold | $${event.revenue.toFixed(2)} revenue`);
            console.log(`   📍 ${event.venue}`);
            console.log('');
        });
        
        console.log(`📋 Report generated: ${new Date(report.generatedAt).toLocaleString()}`);
    }

    // Sample a few tickets to understand the data structure
    async analyzeSalesData() {
        console.log('🔍 ANALYZING TICKET SALES DATA STRUCTURE');
        console.log('=========================================');
        
        // Get sample tickets
        const ticketsResult = await this.getAllTickets(10);
        if (ticketsResult.success && ticketsResult.tickets.length > 0) {
            console.log('\n🎫 Sample Ticket Data:');
            console.log(JSON.stringify(ticketsResult.tickets[0], null, 2));
        }
        
        // Get sample orders
        const ordersResult = await this.getAllOrders(10);
        if (ordersResult.success && ordersResult.orders.length > 0) {
            console.log('\n📋 Sample Order Data:');
            console.log(JSON.stringify(ordersResult.orders[0], null, 2));
        }
        
        // Test specific event
        console.log('\n🎯 Testing New Year\'s Eve Event:');
        const neyEventId = 'fd15c5fe-56ad-4985-98fd-48123ba32384';
        const nyeTickets = await this.getEventTickets(neyEventId);
        console.log(`NYE Tickets: ${nyeTickets.total}`);
        
        if (nyeTickets.success && nyeTickets.tickets.length > 0) {
            console.log('NYE Ticket Sample:');
            console.log(JSON.stringify(nyeTickets.tickets[0], null, 2));
        }
    }
}

// Command line interface
async function main() {
    try {
        const manager = new TicketSalesManager();
        const command = process.argv[2] || 'report';
        const limit = parseInt(process.argv[3]) || 20;
        
        switch (command.toLowerCase()) {
            case 'report':
                await manager.printSalesReport(limit);
                break;
                
            case 'analyze':
                await manager.analyzeSalesData();
                break;
                
            case 'nye':
                // Test the New Year's Eve event specifically
                const nyeTickets = await manager.getEventTickets('fd15c5fe-56ad-4985-98fd-48123ba32384');
                console.log(`🎊 New Year's Eve: ${nyeTickets.total} tickets sold`);
                if (nyeTickets.tickets.length > 0) {
                    console.log('Sample ticket:', nyeTickets.tickets[0]);
                }
                break;
                
            default:
                console.log('Available commands:');
                console.log('  report [number] - Sales report for upcoming events');
                console.log('  analyze         - Analyze ticket sales data structure');
                console.log('  nye            - Test New Year\'s Eve event specifically');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

module.exports = TicketSalesManager;

if (require.main === module) {
    main();
}