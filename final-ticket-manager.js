// final-ticket-manager.js - Complete solution without revenue calculation
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

class FinalTicketManager {
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

    async delay(ms = 1000) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getEventTickets(eventId, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const response = await axios.get(`${this.baseUrl}/events/v1/events/${eventId}/tickets?limit=100`, {
                    headers: this.getHeaders(),
                    timeout: 10000
                });
                
                return {
                    success: true,
                    tickets: response.data.tickets || [],
                    total: response.data.total || 0
                };
            } catch (error) {
                if (error.response?.status === 429 && attempt < retries) {
                    console.log(`   Rate limited, waiting ${attempt * 2} seconds...`);
                    await this.delay(attempt * 2000);
                    continue;
                }
                
                return { success: false, error: error.message, tickets: [], total: 0 };
            }
        }
    }

    async getUpcomingEventsWithTickets(limit = 20) {
        try {
            console.log(`📅 Fetching next ${limit} events with ticket sales...`);
            
            // Get all events
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
                await this.delay(500);
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
            console.log(`   Getting ticket counts...`);
            
            // Get ticket data for each event
            const eventsWithTickets = [];
            for (let i = 0; i < upcomingEvents.length; i++) {
                const event = upcomingEvents[i];
                
                console.log(`   ${i + 1}/${upcomingEvents.length}: ${event.title}`);
                
                const ticketsResult = await this.getEventTickets(event.id);
                const ticketsSold = ticketsResult.total;
                
                // Calculate days until event
                const eventDate = new Date(event.scheduling?.config?.startDate);
                const daysFromNow = Math.ceil((eventDate - new Date()) / (1000 * 60 * 60 * 24));
                
                // Determine sales status
                let salesStatus = 'low';
                if (daysFromNow <= 7 && ticketsSold === 0) {
                    salesStatus = 'urgent';
                } else if (ticketsSold >= 25) {
                    salesStatus = 'high';
                } else if (ticketsSold >= 10) {
                    salesStatus = 'medium';
                }
                
                // Analyze payment methods (as a proxy for activity)
                const paidTickets = ticketsResult.tickets?.filter(ticket => !ticket.free) || [];
                const freeTickets = ticketsResult.tickets?.filter(ticket => ticket.free) || [];
                
                eventsWithTickets.push({
                    ...event,
                    ticketsSold,
                    paidTickets: paidTickets.length,
                    freeTickets: freeTickets.length,
                    daysFromNow,
                    salesStatus,
                    eventType: this.categorizeEvent(event.title),
                    venue: event.location?.name || 'The Listening Booth',
                    isPaid: paidTickets.length > 0,
                    isFree: freeTickets.length === ticketsSold && ticketsSold > 0
                });
                
                if (i < upcomingEvents.length - 1) {
                    await this.delay(1000);
                }
            }
            
            return {
                success: true,
                events: eventsWithTickets,
                total: eventsWithTickets.length,
                generatedAt: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('Error fetching events with tickets:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }

    categorizeEvent(title) {
        const titleLower = title.toLowerCase();
        
        if (titleLower.includes('open mic')) return 'Open Mic';
        if (titleLower.includes('jam')) return 'Jam Session';
        if (titleLower.includes('lessons') || titleLower.includes('songwriting')) return 'Workshop';
        if (titleLower.includes('fundraiser')) return 'Fundraiser';
        return 'Concert';
    }

    async generateTicketReport(limit = 20) {
        try {
            const data = await this.getUpcomingEventsWithTickets(limit);
            
            if (!data.success) {
                throw new Error(data.error);
            }
            
            const totalTicketsSold = data.events.reduce((sum, event) => sum + event.ticketsSold, 0);
            const totalPaidTickets = data.events.reduce((sum, event) => sum + event.paidTickets, 0);
            const totalFreeTickets = data.events.reduce((sum, event) => sum + event.freeTickets, 0);
            const averageTicketsPerEvent = data.events.length > 0 ? 
                Math.round(totalTicketsSold / data.events.length * 10) / 10 : 0;
            
            // Event type breakdown
            const eventTypes = {};
            data.events.forEach(event => {
                eventTypes[event.eventType] = (eventTypes[event.eventType] || 0) + 1;
            });
            
            // Sales performance
            const salesBreakdown = {
                high: data.events.filter(e => e.salesStatus === 'high').length,
                medium: data.events.filter(e => e.salesStatus === 'medium').length,
                low: data.events.filter(e => e.salesStatus === 'low').length,
                urgent: data.events.filter(e => e.salesStatus === 'urgent').length
            };
            
            // Venue breakdown
            const venueBreakdown = {};
            data.events.forEach(event => {
                venueBreakdown[event.venue] = (venueBreakdown[event.venue] || 0) + 1;
            });
            
            const report = {
                venue: {
                    name: "The Listening Booth",
                    location: "Lewes, Delaware"
                },
                summary: {
                    totalUpcomingEvents: data.events.length,
                    totalTicketsSold,
                    totalPaidTickets,
                    totalFreeTickets,
                    averageTicketsPerEvent,
                    eventTypes,
                    salesBreakdown,
                    venueBreakdown,
                    topSellingEvents: data.events
                        .filter(e => e.ticketsSold > 0)
                        .sort((a, b) => b.ticketsSold - a.ticketsSold)
                        .slice(0, 5)
                        .map(e => ({ 
                            title: e.title, 
                            tickets: e.ticketsSold,
                            type: e.isPaid ? 'paid' : e.isFree ? 'free' : 'unknown'
                        })),
                    urgentEvents: data.events.filter(e => e.salesStatus === 'urgent'),
                    thisWeekEvents: data.events.filter(e => e.daysFromNow <= 7)
                },
                events: data.events.map(event => ({
                    title: event.title,
                    date: event.scheduling?.formatted,
                    daysFromNow: event.daysFromNow,
                    ticketsSold: event.ticketsSold,
                    paidTickets: event.paidTickets,
                    freeTickets: event.freeTickets,
                    salesStatus: event.salesStatus,
                    eventType: event.eventType,
                    venue: event.venue,
                    isPaid: event.isPaid,
                    isFree: event.isFree,
                    eventId: event.id
                })),
                generatedAt: data.generatedAt
            };
            
            return { success: true, report };
            
        } catch (error) {
            console.error('Error generating ticket report:', error.message);
            return { success: false, error: error.message };
        }
    }

    async printTicketReport(limit = 20) {
        const reportData = await this.generateTicketReport(limit);
        
        if (!reportData.success) {
            console.log('❌ Error generating ticket report:', reportData.error);
            return;
        }
        
        const report = reportData.report;
        
        console.log('\n🎫 THE LISTENING BOOTH - TICKET SALES REPORT');
        console.log('==============================================');
        console.log(`📊 ${report.summary.totalUpcomingEvents} events | ${report.summary.totalTicketsSold} tickets sold`);
        console.log(`🎟️  ${report.summary.totalPaidTickets} paid tickets | ${report.summary.totalFreeTickets} free tickets`);
        console.log(`📈 Average: ${report.summary.averageTicketsPerEvent} tickets/event`);
        
        const sb = report.summary.salesBreakdown;
        console.log(`🎯 Performance: ${sb.high} high sales | ${sb.medium} medium | ${sb.low} low | ${sb.urgent} urgent\n`);
        
        // Top selling events
        if (report.summary.topSellingEvents.length > 0) {
            console.log('🔥 TOP SELLING EVENTS:');
            report.summary.topSellingEvents.forEach((event, index) => {
                const typeIcon = event.type === 'paid' ? '💰' : event.type === 'free' ? '🆓' : '🎫';
                console.log(`   ${index + 1}. ${event.title} - ${event.tickets} tickets ${typeIcon}`);
            });
            console.log('');
        }
        
        // This week's events
        if (report.summary.thisWeekEvents.length > 0) {
            console.log(`📅 THIS WEEK (${report.summary.thisWeekEvents.length} events):`);
            report.summary.thisWeekEvents.forEach(event => {
                const statusIcon = {
                    'high': '🔥',
                    'medium': '👍', 
                    'low': '📢',
                    'urgent': '⚠️'
                }[event.salesStatus];
                console.log(`   ${statusIcon} ${event.title} - ${event.ticketsSold} tickets (${event.daysFromNow} days)`);
            });
            console.log('');
        }
        
        // Event types
        console.log('🎭 Event Types:');
        Object.entries(report.summary.eventTypes).forEach(([type, count]) => {
            console.log(`   ${type}: ${count}`);
        });
        console.log('');
        
        // Venues
        console.log('📍 Venues:');
        Object.entries(report.summary.venueBreakdown).forEach(([venue, count]) => {
            console.log(`   ${venue}: ${count} events`);
        });
        console.log('');
        
        // Individual events
        console.log('📅 ALL UPCOMING EVENTS:');
        report.events.forEach((event, index) => {
            const statusIcon = {
                'high': '🔥',
                'medium': '👍', 
                'low': '📢',
                'urgent': '⚠️'
            }[event.salesStatus];
            
            const typeIcon = {
                'Concert': '🎤',
                'Open Mic': '🎙️',
                'Jam Session': '🎸',
                'Workshop': '📚',
                'Fundraiser': '💝'
            }[event.eventType] || '🎵';
            
            const ticketInfo = event.isPaid ? `${event.paidTickets} paid` : 
                             event.isFree ? `${event.freeTickets} free` : 
                             `${event.ticketsSold} tickets`;
            
            console.log(`${index + 1}. ${event.title}`);
            console.log(`   📅 ${event.date} (${event.daysFromNow} days away)`);
            console.log(`   ${statusIcon} ${ticketInfo} | ${typeIcon} ${event.eventType}`);
            console.log(`   📍 ${event.venue}`);
            console.log('');
        });
        
        // Urgent events warning
        if (report.summary.urgentEvents.length > 0) {
            console.log(`⚠️  URGENT: ${report.summary.urgentEvents.length} events this week with no tickets sold:`);
            report.summary.urgentEvents.forEach(event => {
                console.log(`   • ${event.title} (${event.daysFromNow} days away)`);
            });
            console.log('');
        }
        
        console.log(`📋 Report generated: ${new Date(report.generatedAt).toLocaleString()}`);
        
        // Revenue note
        console.log('\n💡 Note: Revenue calculation requires external pricing data not available in the Wix Events API.');
    }

    async saveHTMLReport(filename = null) {
        const reportData = await this.generateTicketReport(20);
        
        if (!reportData.success) {
            console.log('❌ Error generating report:', reportData.error);
            return;
        }
        
        const timestamp = new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-');
        const file = filename || `listening-booth-tickets-${timestamp}.html`;
        
        const html = this.generateHTML(reportData.report);
        fs.writeFileSync(file, html);
        
        console.log(`✅ HTML ticket report saved to ${file}`);
        console.log('📂 Perfect for sharing with your team!');
        
        return { success: true, filename: file };
    }

    generateHTML(report) {
        const eventsHTML = report.events.map(event => {
            const statusClass = {
                'high': 'status-high',
                'medium': 'status-medium',
                'low': 'status-low',
                'urgent': 'status-urgent'
            }[event.salesStatus];
            
            const typeColor = {
                'Concert': '#667eea',
                'Open Mic': '#f59e0b',
                'Jam Session': '#10b981',
                'Workshop': '#8b5cf6',
                'Fundraiser': '#ef4444'
            }[event.eventType] || '#6b7280';
            
            const ticketInfo = event.isPaid ? `${event.paidTickets} paid` : 
                             event.isFree ? `${event.freeTickets} free` : 
                             `${event.ticketsSold} tickets`;
            
            return `
                <div class="event-card">
                    <div class="event-header">
                        <span class="event-type" style="background: ${typeColor}">${event.eventType}</span>
                        <span class="days-away">${event.daysFromNow} days</span>
                    </div>
                    <h3 class="event-title">${event.title}</h3>
                    <div class="event-date">📅 ${event.date}</div>
                    <div class="event-venue">📍 ${event.venue}</div>
                    <div class="event-sales">
                        <span class="tickets-sold ${statusClass}">${ticketInfo}</span>
                        ${event.isPaid ? '<span class="paid-badge">💰 PAID</span>' : ''}
                        ${event.isFree ? '<span class="free-badge">🆓 FREE</span>' : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>The Listening Booth - Ticket Sales Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }
        .venue-name {
            font-size: 3em;
            margin: 0;
            font-weight: 300;
        }
        .content {
            padding: 40px;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 25px;
            margin-bottom: 40px;
        }
        .summary-card {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            padding: 25px;
            border-radius: 12px;
            text-align: center;
        }
        .summary-number {
            font-size: 2.5em;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .events-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 25px;
        }
        .event-card {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 25px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: transform 0.3s ease;
        }
        .event-card:hover {
            transform: translateY(-5px);
        }
        .event-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 15px;
        }
        .event-type {
            color: white;
            padding: 6px 12px;
            border-radius: 15px;
            font-size: 0.85em;
            font-weight: 600;
        }
        .days-away {
            background: #f3f4f6;
            color: #374151;
            padding: 6px 12px;
            border-radius: 15px;
            font-size: 0.85em;
            font-weight: 600;
        }
        .event-title {
            font-size: 1.4em;
            color: #333;
            margin-bottom: 12px;
        }
        .event-date, .event-venue {
            color: #666;
            margin-bottom: 8px;
        }
        .event-sales {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 15px;
        }
        .tickets-sold {
            padding: 8px 15px;
            border-radius: 20px;
            color: white;
            font-weight: 600;
            font-size: 0.9em;
        }
        .status-high { background: #10b981; }
        .status-medium { background: #f59e0b; }
        .status-low { background: #6b7280; }
        .status-urgent { background: #ef4444; }
        .paid-badge, .free-badge {
            font-size: 0.8em;
            padding: 4px 8px;
            border-radius: 10px;
            background: #f3f4f6;
            color: #374151;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            color: #666;
            border-top: 1px solid #e5e7eb;
            padding-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="venue-name">🎫 The Listening Booth</h1>
            <p>Ticket Sales Report | Lewes, Delaware</p>
        </div>
        
        <div class="content">
            <div class="summary-grid">
                <div class="summary-card">
                    <div class="summary-number">${report.summary.totalUpcomingEvents}</div>
                    <div>Upcoming Events</div>
                </div>
                <div class="summary-card">
                    <div class="summary-number">${report.summary.totalTicketsSold}</div>
                    <div>Total Tickets</div>
                </div>
                <div class="summary-card">
                    <div class="summary-number">${report.summary.totalPaidTickets}</div>
                    <div>Paid Tickets</div>
                </div>
                <div class="summary-card">
                    <div class="summary-number">${report.summary.averageTicketsPerEvent}</div>
                    <div>Avg per Event</div>
                </div>
            </div>
            
            <div class="events-grid">
                ${eventsHTML}
            </div>
            
            <div class="footer">
                <p>Last Updated: ${new Date(report.generatedAt).toLocaleString()}</p>
                <p>The Listening Booth Events System</p>
                <p><small>Note: Revenue data requires external pricing information</small></p>
            </div>
        </div>
    </div>
</body>
</html>`;
    }
}

// Command line interface
async function main() {
    try {
        const manager = new FinalTicketManager();
        const command = process.argv[2] || 'report';
        const limit = parseInt(process.argv[3]) || 20;
        
        switch (command.toLowerCase()) {
            case 'report':
                await manager.printTicketReport(limit);
                break;
                
            case 'html':
                await manager.saveHTMLReport();
                break;
                
            default:
                console.log('Available commands:');
                console.log('  report [number] - Show comprehensive ticket sales report');
                console.log('  html           - Generate HTML report for team sharing');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

module.exports = FinalTicketManager;

if (require.main === module) {
    main();
}