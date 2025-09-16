// enhanced-venue-manager.js - With RSVP/ticket tracking
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

class EnhancedVenueManager {
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

    // Get upcoming events with RSVP data
    async getUpcomingEventsWithRSVPs(limit = 20) {
        try {
            console.log(`📅 Fetching next ${limit} events with RSVP data...`);
            
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
                
                // Stop if we have enough or no more events
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
            
            // Get RSVP data for each event
            const eventsWithRSVPs = await Promise.all(
                upcomingEvents.map(async (event) => {
                    try {
                        const rsvpResponse = await axios.get(`${this.baseUrl}/events/v1/events/${event.id}/rsvps`, {
                            headers: this.getHeaders()
                        });
                        
                        const rsvpData = rsvpResponse.data;
                        return {
                            ...event,
                            rsvpCount: rsvpData.total || 0,
                            rsvpList: rsvpData.rsvps || [],
                            attendeeDetails: rsvpData.rsvps?.map(rsvp => ({
                                name: rsvp.contactDetails?.name || 'Unknown',
                                email: rsvp.contactDetails?.email || '',
                                status: rsvp.status || 'GOING',
                                created: rsvp.created
                            })) || []
                        };
                    } catch (rsvpError) {
                        // If RSVP endpoint fails, continue with 0 count
                        console.log(`   Could not fetch RSVPs for: ${event.title}`);
                        return {
                            ...event,
                            rsvpCount: 0,
                            rsvpList: [],
                            attendeeDetails: []
                        };
                    }
                })
            );
            
            console.log(`✅ Retrieved ${eventsWithRSVPs.length} events with RSVP data`);
            
            return {
                success: true,
                events: eventsWithRSVPs,
                total: eventsWithRSVPs.length,
                generatedAt: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('Error fetching events with RSVPs:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }

    // Generate a detailed report
    async generateUpcomingEventsReport(limit = 20) {
        try {
            const data = await this.getUpcomingEventsWithRSVPs(limit);
            
            if (!data.success) {
                throw new Error(data.error);
            }
            
            const report = {
                venue: {
                    name: "The Listening Booth",
                    location: "Lewes, Delaware",
                    website: "listeningbooth.com"
                },
                summary: {
                    totalUpcomingEvents: data.events.length,
                    totalRSVPs: data.events.reduce((sum, event) => sum + event.rsvpCount, 0),
                    averageRSVPsPerEvent: data.events.length > 0 ? 
                        Math.round(data.events.reduce((sum, event) => sum + event.rsvpCount, 0) / data.events.length * 10) / 10 : 0
                },
                events: data.events.map(event => ({
                    title: event.title,
                    date: event.scheduling?.formatted || new Date(event.scheduling?.config?.startDate).toLocaleString(),
                    rawDate: event.scheduling?.config?.startDate,
                    location: event.location?.name || event.location?.address || 'The Listening Booth',
                    description: event.about || event.description || '',
                    rsvpCount: event.rsvpCount,
                    attendees: event.attendeeDetails,
                    eventUrl: `https://www.wix.com/events/${event.slug}`,
                    eventId: event.id,
                    status: event.status,
                    daysFromNow: Math.ceil((new Date(event.scheduling?.config?.startDate) - new Date()) / (1000 * 60 * 60 * 24))
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

    // Save report to file
    async saveReport(format = 'json', filename = null) {
        try {
            const reportData = await this.generateUpcomingEventsReport(20);
            
            if (!reportData.success) {
                throw new Error(reportData.error);
            }
            
            const timestamp = new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-');
            
            if (format === 'json') {
                const file = filename || `listening-booth-events-${timestamp}.json`;
                fs.writeFileSync(file, JSON.stringify(reportData.report, null, 2));
                console.log(`✅ Report saved to ${file}`);
                return { success: true, filename: file, report: reportData.report };
            }
            
            if (format === 'html') {
                const file = filename || `listening-booth-events-${timestamp}.html`;
                const html = this.generateHTMLReport(reportData.report);
                fs.writeFileSync(file, html);
                console.log(`✅ HTML report saved to ${file}`);
                return { success: true, filename: file, report: reportData.report };
            }
            
        } catch (error) {
            console.error('Error saving report:', error.message);
            return { success: false, error: error.message };
        }
    }

    // Generate HTML report
    generateHTMLReport(report) {
        const eventsHTML = report.events.map(event => `
            <tr>
                <td class="event-title">${event.title}</td>
                <td class="event-date">${event.date}</td>
                <td class="rsvp-count ${event.rsvpCount > 10 ? 'high-rsvp' : event.rsvpCount > 5 ? 'medium-rsvp' : 'low-rsvp'}">${event.rsvpCount}</td>
                <td class="days-away">${event.daysFromNow} days</td>
                <td class="location">${event.location}</td>
            </tr>
        `).join('');

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>The Listening Booth - Upcoming Events Report</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            background: white;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #667eea;
            padding-bottom: 20px;
        }
        .venue-name {
            font-size: 2.5em;
            color: #667eea;
            margin: 0;
            font-weight: 300;
        }
        .venue-subtitle {
            color: #666;
            font-size: 1.2em;
            margin: 5px 0;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        .summary-card {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        .summary-number {
            font-size: 2.5em;
            font-weight: bold;
            margin: 0;
        }
        .summary-label {
            margin: 5px 0 0 0;
            opacity: 0.9;
        }
        .events-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .events-table th {
            background: #667eea;
            color: white;
            padding: 15px;
            text-align: left;
            font-weight: 600;
        }
        .events-table td {
            padding: 12px 15px;
            border-bottom: 1px solid #eee;
        }
        .events-table tr:hover {
            background: #f8f9ff;
        }
        .event-title {
            font-weight: 600;
            color: #333;
        }
        .rsvp-count {
            font-weight: bold;
            text-align: center;
            padding: 8px 15px;
            border-radius: 20px;
            color: white;
        }
        .high-rsvp { background: #10b981; }
        .medium-rsvp { background: #f59e0b; }
        .low-rsvp { background: #ef4444; }
        .days-away {
            text-align: center;
            font-weight: 500;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #666;
        }
        .last-updated {
            font-style: italic;
            color: #888;
        }
        @media (max-width: 768px) {
            .events-table {
                font-size: 14px;
            }
            .events-table th,
            .events-table td {
                padding: 8px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="venue-name">🎵 The Listening Booth</h1>
            <p class="venue-subtitle">Upcoming Events Report | Lewes, Delaware</p>
        </div>

        <div class="summary">
            <div class="summary-card">
                <div class="summary-number">${report.summary.totalUpcomingEvents}</div>
                <div class="summary-label">Upcoming Events</div>
            </div>
            <div class="summary-card">
                <div class="summary-number">${report.summary.totalRSVPs}</div>
                <div class="summary-label">Total RSVPs</div>
            </div>
            <div class="summary-card">
                <div class="summary-number">${report.summary.averageRSVPsPerEvent}</div>
                <div class="summary-label">Avg RSVPs/Event</div>
            </div>
        </div>

        <table class="events-table">
            <thead>
                <tr>
                    <th>Event</th>
                    <th>Date</th>
                    <th>RSVPs</th>
                    <th>Days Away</th>
                    <th>Location</th>
                </tr>
            </thead>
            <tbody>
                ${eventsHTML}
            </tbody>
        </table>

        <div class="footer">
            <p class="last-updated">Last Updated: ${new Date(report.generatedAt).toLocaleString()}</p>
            <p>Generated by The Listening Booth Events System</p>
        </div>
    </div>
</body>
</html>`;
    }

    // Print console report
    async printUpcomingReport(limit = 20) {
        const reportData = await this.generateUpcomingEventsReport(limit);
        
        if (!reportData.success) {
            console.log('❌ Error generating report:', reportData.error);
            return;
        }
        
        const report = reportData.report;
        
        console.log('\n🎵 THE LISTENING BOOTH - UPCOMING EVENTS REPORT');
        console.log('================================================');
        console.log(`📊 ${report.summary.totalUpcomingEvents} upcoming events | ${report.summary.totalRSVPs} total RSVPs | ${report.summary.averageRSVPsPerEvent} avg RSVPs/event\n`);
        
        report.events.forEach((event, index) => {
            const rsvpStatus = event.rsvpCount > 10 ? '🔥' : event.rsvpCount > 5 ? '👍' : '📢';
            
            console.log(`${index + 1}. ${event.title}`);
            console.log(`   📅 ${event.date} (${event.daysFromNow} days away)`);
            console.log(`   ${rsvpStatus} ${event.rsvpCount} RSVPs`);
            console.log(`   📍 ${event.location}`);
            if (event.description) {
                console.log(`   📝 ${event.description.substring(0, 80)}...`);
            }
            console.log('');
        });
        
        console.log(`\n📋 Report generated: ${new Date(report.generatedAt).toLocaleString()}`);
    }
}

// Command line interface
async function main() {
    try {
        const manager = new EnhancedVenueManager();
        const command = process.argv[2] || 'report';
        const limit = parseInt(process.argv[3]) || 20;
        
        switch (command.toLowerCase()) {
            case 'report':
            case 'upcoming':
                await manager.printUpcomingReport(limit);
                break;
                
            case 'html':
                const htmlResult = await manager.saveReport('html');
                if (htmlResult.success) {
                    console.log(`✅ HTML report generated: ${htmlResult.filename}`);
                    console.log('📂 Open this file in your browser to view the report');
                }
                break;
                
            case 'json':
                const jsonResult = await manager.saveReport('json');
                if (jsonResult.success) {
                    console.log(`✅ JSON report generated: ${jsonResult.filename}`);
                }
                break;
                
            default:
                console.log('Available commands:');
                console.log('  report [number] - Show upcoming events report (default: 20)');
                console.log('  html [number]   - Generate HTML report file');
                console.log('  json [number]   - Generate JSON report file');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

module.exports = EnhancedVenueManager;

if (require.main === module) {
    main();
}