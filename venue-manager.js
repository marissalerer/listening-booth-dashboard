// venue-manager.js - Your complete venue events management tool
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

class VenueEventsManager {
    constructor() {
        this.apiToken = process.env.WIX_API_TOKEN;
        this.siteId = process.env.WIX_SITE_ID;
        this.baseUrl = 'https://www.wixapis.com';
        
        if (!this.apiToken || !this.siteId) {
            throw new Error('Missing WIX_API_TOKEN or WIX_SITE_ID in .env file');
        }
        
        console.log('🎵 Venue Events Manager initialized');
        console.log(`   Site ID: ${this.siteId.substring(0, 8)}...`);
    }

    // Standard headers for all API calls
    getHeaders() {
        return {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
            'wix-site-id': this.siteId
        };
    }

    // Get all events (with pagination to handle 551+ events)
    async getAllEvents() {
        try {
            console.log('📅 Fetching all events...');
            
            let allEvents = [];
            let offset = 0;
            const limit = 100; // Maximum allowed per request
            let totalAvailable = 0;
            
            // First request to get total count
            const firstResponse = await axios.get(`${this.baseUrl}/events/v1/events?limit=${limit}&offset=0`, {
                headers: this.getHeaders()
            });
            
            totalAvailable = firstResponse.data.total;
            allEvents = firstResponse.data.events || [];
            
            console.log(`   Found ${totalAvailable} total events, fetching in batches...`);
            
            // Get remaining events in batches of 100
            while (allEvents.length < totalAvailable) {
                offset += limit;
                console.log(`   Fetching batch ${Math.floor(offset/limit) + 1}/${Math.ceil(totalAvailable/limit)}...`);
                
                const response = await axios.get(`${this.baseUrl}/events/v1/events?limit=${limit}&offset=${offset}`, {
                    headers: this.getHeaders()
                });
                
                const newEvents = response.data.events || [];
                allEvents.push(...newEvents);
                
                // Safety check to avoid infinite loop
                if (newEvents.length === 0) break;
            }
            
            console.log(`✅ Retrieved ${allEvents.length} events total`);
            
            return {
                success: true,
                events: allEvents,
                total: allEvents.length
            };
        } catch (error) {
            console.error('Error fetching events:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }

    // Get upcoming events only (with pagination)
    async getUpcomingEvents() {
        try {
            console.log('🔮 Fetching upcoming events...');
            
            // Get all events first (they're already sorted by default)
            const allEventsResult = await this.getAllEvents();
            if (!allEventsResult.success) {
                return allEventsResult;
            }
            
            const now = new Date();
            const upcomingEvents = allEventsResult.events.filter(event => {
                const eventDate = new Date(event.scheduling?.config?.startDate);
                return eventDate > now;
            });
            
            // Sort by date (earliest first)
            upcomingEvents.sort((a, b) => 
                new Date(a.scheduling?.config?.startDate) - new Date(b.scheduling?.config?.startDate)
            );
            
            return {
                success: true,
                events: upcomingEvents,
                total: upcomingEvents.length
            };
        } catch (error) {
            console.error('Error fetching upcoming events:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }

    // Get past events (with pagination)
    async getPastEvents() {
        try {
            console.log('📜 Fetching past events...');
            
            // Get all events first
            const allEventsResult = await this.getAllEvents();
            if (!allEventsResult.success) {
                return allEventsResult;
            }
            
            const now = new Date();
            const pastEvents = allEventsResult.events.filter(event => {
                const eventDate = new Date(event.scheduling?.config?.startDate);
                return eventDate <= now;
            });
            
            // Sort by date (most recent first)
            pastEvents.sort((a, b) => 
                new Date(b.scheduling?.config?.startDate) - new Date(a.scheduling?.config?.startDate)
            );
            
            return {
                success: true,
                events: pastEvents,
                total: pastEvents.length
            };
        } catch (error) {
            console.error('Error fetching past events:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }

    // Get event by ID with RSVP info
    async getEventDetails(eventId) {
        try {
            console.log(`🔍 Fetching details for event: ${eventId}`);
            
            // Get basic event info
            const eventResponse = await axios.get(`${this.baseUrl}/events/v1/events/${eventId}`, {
                headers: this.getHeaders()
            });
            
            // Try to get RSVPs
            let rsvpInfo = { total: 0, rsvps: [] };
            try {
                const rsvpResponse = await axios.get(`${this.baseUrl}/events/v1/events/${eventId}/rsvps`, {
                    headers: this.getHeaders()
                });
                rsvpInfo = {
                    total: rsvpResponse.data.total || 0,
                    rsvps: rsvpResponse.data.rsvps || []
                };
            } catch (rsvpError) {
                console.log('Could not fetch RSVPs for this event');
            }
            
            return {
                success: true,
                event: eventResponse.data.event,
                rsvpCount: rsvpInfo.total,
                attendees: rsvpInfo.rsvps
            };
        } catch (error) {
            console.error('Error fetching event details:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }

    // Create a summary dashboard (optimized - single API call)
    async getDashboard() {
        try {
            console.log('📊 Creating venue dashboard...');
            
            // Get all events once
            const allEventsResult = await this.getAllEvents();
            if (!allEventsResult.success) {
                return allEventsResult;
            }
            
            const allEvents = allEventsResult.events;
            const now = new Date();
            
            // Split into upcoming and past
            const upcomingEvents = allEvents.filter(event => {
                const eventDate = new Date(event.scheduling?.config?.startDate);
                return eventDate > now;
            }).sort((a, b) => 
                new Date(a.scheduling?.config?.startDate) - new Date(b.scheduling?.config?.startDate)
            );
            
            const pastEvents = allEvents.filter(event => {
                const eventDate = new Date(event.scheduling?.config?.startDate);
                return eventDate <= now;
            }).sort((a, b) => 
                new Date(b.scheduling?.config?.startDate) - new Date(a.scheduling?.config?.startDate)
            );
            
            const dashboard = {
                totalEvents: allEvents.length,
                upcomingEvents: upcomingEvents.length,
                pastEvents: pastEvents.length,
                nextEvent: upcomingEvents[0] || null,
                recentEvent: pastEvents[0] || null
            };
            
            return { success: true, dashboard };
        } catch (error) {
            console.error('Error creating dashboard:', error.message);
            return { success: false, error: error.message };
        }
    }

    // Export events to different formats
    async exportEvents(format = 'json', filename = null) {
        try {
            const eventsData = await this.getAllEvents();
            if (!eventsData.success) {
                throw new Error(eventsData.error);
            }
            
            const timestamp = new Date().toISOString().slice(0, 10);
            
            if (format.toLowerCase() === 'json') {
                const file = filename || `venue-events-${timestamp}.json`;
                fs.writeFileSync(file, JSON.stringify(eventsData.events, null, 2));
                console.log(`✅ Events exported to ${file}`);
                return { success: true, filename: file, count: eventsData.events.length };
            }
            
            if (format.toLowerCase() === 'csv') {
                const file = filename || `venue-events-${timestamp}.csv`;
                let csv = 'Title,Date,Time,Location,Status,RSVP Count\n';
                
                for (const event of eventsData.events) {
                    const date = event.scheduling?.startDate ? new Date(event.scheduling.startDate).toLocaleDateString() : '';
                    const time = event.scheduling?.startDate ? new Date(event.scheduling.startDate).toLocaleTimeString() : '';
                    const location = event.location?.address || '';
                    const status = event.status || '';
                    
                    csv += `"${event.title}","${date}","${time}","${location}","${status}","0"\n`;
                }
                
                fs.writeFileSync(file, csv);
                console.log(`✅ Events exported to ${file}`);
                return { success: true, filename: file, count: eventsData.events.length };
            }
            
        } catch (error) {
            console.error('Error exporting events:', error.message);
            return { success: false, error: error.message };
        }
    }

    // Print a nice summary
    async printSummary() {
        const dashboard = await this.getDashboard();
        
        if (!dashboard.success) {
            console.log('❌ Could not create dashboard');
            return;
        }
        
        const d = dashboard.dashboard;
        
        console.log('\n🎵 VENUE EVENTS SUMMARY');
        console.log('========================');
        console.log(`📊 Total Events: ${d.totalEvents}`);
        console.log(`🔮 Upcoming: ${d.upcomingEvents}`);
        console.log(`📜 Past: ${d.pastEvents}`);
        
        if (d.nextEvent) {
            const nextEventDate = new Date(d.nextEvent.scheduling?.config?.startDate);
            const formattedDate = d.nextEvent.scheduling?.formatted || nextEventDate.toLocaleString();
            
            console.log('\n🎯 NEXT EVENT:');
            console.log(`   📅 ${d.nextEvent.title}`);
            console.log(`   🗓️  ${formattedDate}`);
            console.log(`   📍 ${d.nextEvent.location?.name || d.nextEvent.location?.address || 'Location TBD'}`);
        } else {
            console.log('\n🎯 No upcoming events scheduled');
        }
        
        if (d.recentEvent) {
            const recentEventDate = new Date(d.recentEvent.scheduling?.config?.startDate);
            const formattedDate = d.recentEvent.scheduling?.formatted || recentEventDate.toLocaleString();
            
            console.log('\n📜 MOST RECENT EVENT:');
            console.log(`   📅 ${d.recentEvent.title}`);
            console.log(`   🗓️  ${formattedDate}`);
        }
        
        console.log('\n💡 Available commands:');
        console.log('   node venue-manager.js summary    - Show this summary');
        console.log('   node venue-manager.js upcoming   - List upcoming events');
        console.log('   node venue-manager.js past      - List past events');
        console.log('   node venue-manager.js export    - Export all events to JSON');
        console.log('   node venue-manager.js csv       - Export all events to CSV');
    }

    // List events in a nice format
    async listEvents(type = 'all') {
        let eventsData;
        
        switch (type) {
            case 'upcoming':
                eventsData = await this.getUpcomingEvents();
                console.log('\n🔮 UPCOMING EVENTS');
                break;
            case 'past':
                eventsData = await this.getPastEvents();
                console.log('\n📜 PAST EVENTS');
                break;
            default:
                eventsData = await this.getAllEvents();
                console.log('\n📅 ALL EVENTS');
        }
        
        console.log('================');
        
        if (!eventsData.success) {
            console.log('❌ Error fetching events:', eventsData.error);
            return;
        }
        
        if (eventsData.events.length === 0) {
            console.log('No events found.');
            return;
        }
        
        eventsData.events.forEach((event, index) => {
            // Use the formatted date from API or fall back to parsing
            const date = event.scheduling?.formatted || 
                        (event.scheduling?.config?.startDate ? 
                         new Date(event.scheduling.config.startDate).toLocaleString() : 'Date TBD');
            const location = event.location?.name || event.location?.address || 'Location TBD';
            
            console.log(`\n${index + 1}. ${event.title}`);
            console.log(`   🗓️  ${date}`);
            console.log(`   📍 ${location}`);
            console.log(`   🆔 ${event.id}`);
            if (event.about) {
                console.log(`   📝 ${event.about.substring(0, 100)}...`);
            } else if (event.description) {
                console.log(`   📝 ${event.description.substring(0, 100)}...`);
            }
        });
        
        console.log(`\n📊 Total: ${eventsData.events.length} events`);
    }
}

// Command line interface
async function main() {
    try {
        const manager = new VenueEventsManager();
        const command = process.argv[2] || 'summary';
        
        switch (command.toLowerCase()) {
            case 'summary':
            case 'dashboard':
                await manager.printSummary();
                break;
                
            case 'upcoming':
                await manager.listEvents('upcoming');
                break;
                
            case 'past':
                await manager.listEvents('past');
                break;
                
            case 'all':
                await manager.listEvents('all');
                break;
                
            case 'export':
                const result = await manager.exportEvents('json');
                if (result.success) {
                    console.log(`✅ Exported ${result.count} events to ${result.filename}`);
                }
                break;
                
            case 'csv':
                const csvResult = await manager.exportEvents('csv');
                if (csvResult.success) {
                    console.log(`✅ Exported ${csvResult.count} events to ${csvResult.filename}`);
                }
                break;
                
            default:
                console.log('Unknown command. Available commands:');
                console.log('  summary, upcoming, past, all, export, csv');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Export for use as module
module.exports = VenueEventsManager;

// Run if called directly
if (require.main === module) {
    main();
}