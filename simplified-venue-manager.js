// simplified-venue-manager.js - Works great even without RSVP data
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

class SimplifiedVenueManager {
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

    // Get upcoming events with optional RSVP attempts
    async getUpcomingEvents(limit = 20) {
        try {
            console.log(`📅 Fetching next ${limit} events...`);
            
            // Get all events with pagination
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
            
            console.log(`✅ Found ${upcomingEvents.length} upcoming events`);
            
            // Try to get RSVP data (but don't fail if it doesn't work)
            const eventsWithData = await Promise.all(
                upcomingEvents.map(async (event) => {
                    let rsvpCount = 0;
                    let ticketsSold = 0;
                    
                    // Try multiple endpoints for attendance data
                    try {
                        // Try RSVPs endpoint
                        const rsvpResponse = await axios.get(`${this.baseUrl}/events/v1/events/${event.id}/rsvps`, {
                            headers: this.getHeaders()
                        });
                        rsvpCount = rsvpResponse.data.total || 0;
                    } catch (e) {
                        // RSVP failed, try other methods
                    }
                    
                    try {
                        // Try bookings/tickets endpoint
                        const bookingResponse = await axios.get(`${this.baseUrl}/bookings/v2/bookings?eventId=${event.id}`, {
                            headers: this.getHeaders()
                        });
                        ticketsSold = bookingResponse.data.bookings?.length || 0;
                    } catch (e) {
                        // Bookings failed too
                    }
                    
                    // Calculate days until event
                    const eventDate = new Date(event.scheduling?.config?.startDate);
                    const daysFromNow = Math.ceil((eventDate - new Date()) / (1000 * 60 * 60 * 24));
                    
                    // Determine event status/popularity based on various factors
                    let popularityStatus = 'info';
                    let statusText = 'Event Scheduled';
                    
                    if (rsvpCount > 0 || ticketsSold > 0) {
                        const totalAttendance = rsvpCount + ticketsSold;
                        if (totalAttendance > 20) {
                            popularityStatus = 'high';
                            statusText = 'High Interest';
                        } else if (totalAttendance > 10) {
                            popularityStatus = 'medium';
                            statusText = 'Good Interest';
                        } else {
                            popularityStatus = 'low';
                            statusText = 'Some Interest';
                        }
                    }
                    
                    // Check if it's a recurring event (usually more established)
                    const isRecurring = event.title.toLowerCase().includes('open mic') || 
                                       event.title.toLowerCase().includes('jam night') ||
                                       event.title.toLowerCase().includes('voice lessons');
                    
                    if (isRecurring) {
                        statusText = 'Regular Event';
                        popularityStatus = 'recurring';
                    }
                    
                    // Check if it's coming up soon
                    if (daysFromNow <= 7) {
                        statusText += ' - Coming Soon!';
                    }
                    
                    return {
                        ...event,
                        rsvpCount,
                        ticketsSold,
                        totalAttendance: rsvpCount + ticketsSold,
                        daysFromNow,
                        popularityStatus,
                        statusText,
                        isRecurring,
                        eventType: this.categorizeEvent(event.title),
                        venue: event.location?.name || 'The Listening Booth'
                    };
                })
            );
            
            return {
                success: true,
                events: eventsWithData,
                total: eventsWithData.length,
                generatedAt: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('Error fetching events:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }

    // Categorize events by type
    categorizeEvent(title) {
        const titleLower = title.toLowerCase();
        
        if (titleLower.includes('open mic')) return 'Open Mic';
        if (titleLower.includes('jam')) return 'Jam Session';
        if (titleLower.includes('lessons') || titleLower.includes('songwriting')) return 'Workshop';
        if (titleLower.includes('fundraiser')) return 'Fundraiser';
        return 'Concert';
    }

    // Generate a comprehensive report
    async generateReport(limit = 20) {
        try {
            const data = await this.getUpcomingEvents(limit);
            
            if (!data.success) {
                throw new Error(data.error);
            }
            
            // Calculate summary statistics
            const totalAttendance = data.events.reduce((sum, event) => sum + event.totalAttendance, 0);
            const eventTypes = {};
            const venues = {};
            
            data.events.forEach(event => {
                eventTypes[event.eventType] = (eventTypes[event.eventType] || 0) + 1;
                venues[event.venue] = (venues[event.venue] || 0) + 1;
            });
            
            const report = {
                venue: {
                    name: "The Listening Booth",
                    location: "Lewes, Delaware",
                    website: "listeningbooth.com"
                },
                summary: {
                    totalUpcomingEvents: data.events.length,
                    totalAttendance: totalAttendance,
                    averageAttendancePerEvent: data.events.length > 0 ? 
                        Math.round(totalAttendance / data.events.length * 10) / 10 : 0,
                    eventTypes: eventTypes,
                    venues: venues,
                    eventsThisWeek: data.events.filter(e => e.daysFromNow <= 7).length,
                    eventsThisMonth: data.events.filter(e => e.daysFromNow <= 30).length
                },
                events: data.events.map(event => ({
                    title: event.title,
                    date: event.scheduling?.formatted || new Date(event.scheduling?.config?.startDate).toLocaleString(),
                    rawDate: event.scheduling?.config?.startDate,
                    venue: event.venue,
                    eventType: event.eventType,
                    description: event.about || event.description || '',
                    attendance: event.totalAttendance,
                    rsvps: event.rsvpCount,
                    tickets: event.ticketsSold,
                    status: event.statusText,
                    popularityLevel: event.popularityStatus,
                    daysFromNow: event.daysFromNow,
                    isRecurring: event.isRecurring,
                    eventId: event.id
                })),
                generatedAt: data.generatedAt,
                generatedBy: "The Listening Booth Events System"
            };
            
            return { success: true, report };
            
        } catch (error) {
            console.error('Error generating report:', error.message);
            return { success: false, error: error.message };
        }
    }

    // Generate beautiful HTML report
    generateHTMLReport(report) {
        const eventsHTML = report.events.map(event => {
            const statusBadge = {
                'high': 'status-high',
                'medium': 'status-medium', 
                'low': 'status-low',
                'recurring': 'status-recurring',
                'info': 'status-info'
            }[event.popularityLevel] || 'status-info';
            
            const typeColor = {
                'Concert': '#667eea',
                'Open Mic': '#f59e0b',
                'Jam Session': '#10b981',
                'Workshop': '#8b5cf6',
                'Fundraiser': '#ef4444'
            }[event.eventType] || '#6b7280';
            
            return `
                <div class="event-card">
                    <div class="event-header">
                        <span class="event-type" style="background: ${typeColor}">${event.eventType}</span>
                        <span class="days-away">${event.daysFromNow} days</span>
                    </div>
                    <h3 class="event-title">${event.title}</h3>
                    <div class="event-date">📅 ${event.date}</div>
                    <div class="event-venue">📍 ${event.venue}</div>
                    <div class="event-status">
                        <span class="status-badge ${statusBadge}">${event.status}</span>
                        ${event.attendance > 0 ? `<span class="attendance">${event.attendance} attending</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        const eventTypesHTML = Object.entries(report.summary.eventTypes)
            .map(([type, count]) => `<li>${type}: ${count}</li>`)
            .join('');

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>The Listening Booth - Events Report</title>
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
        
        .venue-subtitle {
            font-size: 1.3em;
            margin: 10px 0;
            opacity: 0.9;
        }
        
        .content {
            padding: 40px;
        }
        
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
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
        
        .summary-label {
            opacity: 0.9;
            font-size: 1.1em;
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
            box-shadow: 0 10px 20px rgba(0,0,0,0.15);
        }
        
        .event-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
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
            line-height: 1.3;
        }
        
        .event-date, .event-venue {
            color: #666;
            margin-bottom: 8px;
            font-size: 1em;
        }
        
        .event-status {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 15px;
        }
        
        .status-badge {
            padding: 6px 12px;
            border-radius: 20px;
            color: white;
            font-size: 0.85em;
            font-weight: 600;
        }
        
        .status-high { background: #10b981; }
        .status-medium { background: #f59e0b; }
        .status-low { background: #ef4444; }
        .status-recurring { background: #8b5cf6; }
        .status-info { background: #6b7280; }
        
        .attendance {
            color: #667eea;
            font-weight: 600;
            font-size: 0.9em;
        }
        
        .event-breakdown {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 30px 0;
        }
        
        .footer {
            text-align: center;
            color: #666;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
        }
        
        @media (max-width: 768px) {
            .events-grid, .summary-grid {
                grid-template-columns: 1fr;
            }
            .venue-name { font-size: 2em; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="venue-name">🎵 The Listening Booth</h1>
            <p class="venue-subtitle">Upcoming Events Report | Lewes, Delaware</p>
        </div>
        
        <div class="content">
            <div class="summary-grid">
                <div class="summary-card">
                    <div class="summary-number">${report.summary.totalUpcomingEvents}</div>
                    <div class="summary-label">Upcoming Events</div>
                </div>
                <div class="summary-card">
                    <div class="summary-number">${report.summary.eventsThisWeek}</div>
                    <div class="summary-label">This Week</div>
                </div>
                <div class="summary-card">
                    <div class="summary-number">${report.summary.totalAttendance}</div>
                    <div class="summary-label">Total Interest</div>
                </div>
            </div>
            
            <div class="event-breakdown">
                <h3>Event Types</h3>
                <ul>${eventTypesHTML}</ul>
            </div>
            
            <div class="events-grid">
                ${eventsHTML}
            </div>
            
            <div class="footer">
                <p>Last Updated: ${new Date(report.generatedAt).toLocaleString()}</p>
                <p>Generated by The Listening Booth Events System</p>
            </div>
        </div>
    </div>
</body>
</html>`;
    }

    // Save report to file
    async saveReport(format = 'html', filename = null) {
        try {
            const reportData = await this.generateReport(20);
            
            if (!reportData.success) {
                throw new Error(reportData.error);
            }
            
            const timestamp = new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-');
            
            if (format === 'html') {
                const file = filename || `listening-booth-report-${timestamp}.html`;
                const html = this.generateHTMLReport(reportData.report);
                fs.writeFileSync(file, html);
                console.log(`✅ HTML report saved to ${file}`);
                return { success: true, filename: file, report: reportData.report };
            }
            
            if (format === 'json') {
                const file = filename || `listening-booth-report-${timestamp}.json`;
                fs.writeFileSync(file, JSON.stringify(reportData.report, null, 2));
                console.log(`✅ JSON report saved to ${file}`);
                return { success: true, filename: file, report: reportData.report };
            }
            
        } catch (error) {
            console.error('Error saving report:', error.message);
            return { success: false, error: error.message };
        }
    }

    // Print console report
    async printReport(limit = 20) {
        const reportData = await this.generateReport(limit);
        
        if (!reportData.success) {
            console.log('❌ Error generating report:', reportData.error);
            return;
        }
        
        const report = reportData.report;
        
        console.log('\n🎵 THE LISTENING BOOTH - UPCOMING EVENTS');
        console.log('==========================================');
        console.log(`📊 ${report.summary.totalUpcomingEvents} events | ${report.summary.eventsThisWeek} this week | ${report.summary.totalAttendance} total interest\n`);
        
        // Show event type breakdown
        console.log('📈 Event Types:');
        Object.entries(report.summary.eventTypes).forEach(([type, count]) => {
            console.log(`   ${type}: ${count}`);
        });
        console.log('');
        
        report.events.forEach((event, index) => {
            const icon = {
                'Concert': '🎤',
                'Open Mic': '🎙️',
                'Jam Session': '🎸',
                'Workshop': '📚',
                'Fundraiser': '💝'
            }[event.eventType] || '🎵';
            
            console.log(`${index + 1}. ${event.title}`);
            console.log(`   📅 ${event.date} (${event.daysFromNow} days away)`);
            console.log(`   ${icon} ${event.eventType} | 📍 ${event.venue}`);
            console.log(`   📊 ${event.status}${event.attendance > 0 ? ` | ${event.attendance} interested` : ''}`);
            console.log('');
        });
        
        console.log(`📋 Report generated: ${new Date(report.generatedAt).toLocaleString()}`);
    }
}

// Command line interface
async function main() {
    try {
        const manager = new SimplifiedVenueManager();
        const command = process.argv[2] || 'report';
        const limit = parseInt(process.argv[3]) || 20;
        
        switch (command.toLowerCase()) {
            case 'report':
                await manager.printReport(limit);
                break;
                
            case 'html':
                const htmlResult = await manager.saveReport('html');
                if (htmlResult.success) {
                    console.log(`🎉 Beautiful HTML report created: ${htmlResult.filename}`);
                    console.log('📂 Open this file in your browser to see your events!');
                }
                break;
                
            case 'json':
                const jsonResult = await manager.saveReport('json');
                if (jsonResult.success) {
                    console.log(`✅ JSON report saved: ${jsonResult.filename}`);
                }
                break;
                
            default:
                console.log('Available commands:');
                console.log('  report [number] - Show upcoming events report');
                console.log('  html [number]   - Generate beautiful HTML report');
                console.log('  json [number]   - Generate JSON report');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

module.exports = SimplifiedVenueManager;

if (require.main === module) {
    main();
}