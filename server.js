// server.js - Web dashboard for your team
require('dotenv').config();
const express = require('express');
const path = require('path');
const cron = require('node-cron');
const EnhancedVenueManager = require('./enhanced-venue-manager');

const app = express();
const PORT = process.env.PORT || 3000;

// Store the latest report in memory
let latestReport = null;
let lastUpdated = null;

// Initialize venue manager
const venueManager = new EnhancedVenueManager();

// Serve static files
app.use(express.static('public'));

// API endpoint for events data
app.get('/api/events', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const reportData = await venueManager.generateUpcomingEventsReport(limit);
        
        if (reportData.success) {
            latestReport = reportData.report;
            lastUpdated = new Date().toISOString();
            res.json(reportData.report);
        } else {
            res.status(500).json({ error: reportData.error });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API endpoint for cached data (faster)
app.get('/api/events/cached', (req, res) => {
    if (latestReport) {
        res.json({
            ...latestReport,
            lastUpdated: lastUpdated
        });
    } else {
        res.status(404).json({ error: 'No cached data available' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        lastUpdate: lastUpdated,
        hasData: !!latestReport 
    });
});

// Main dashboard route
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>The Listening Booth - Live Events Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .venue-name {
            font-size: 2.5em;
            margin: 0;
            font-weight: 300;
        }
        
        .venue-subtitle {
            font-size: 1.2em;
            margin: 10px 0 0 0;
            opacity: 0.9;
        }
        
        .live-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            background: #10b981;
            border-radius: 50%;
            margin-right: 8px;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        
        .content {
            padding: 30px;
        }
        
        .loading {
            text-align: center;
            padding: 50px;
            font-size: 1.2em;
            color: #666;
        }
        
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .summary-card {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            padding: 25px;
            border-radius: 12px;
            text-align: center;
            transition: transform 0.3s ease;
        }
        
        .summary-card:hover {
            transform: translateY(-5px);
        }
        
        .summary-number {
            font-size: 2.5em;
            font-weight: bold;
            margin: 0;
        }
        
        .summary-label {
            margin: 5px 0 0 0;
            opacity: 0.9;
            font-size: 1.1em;
        }
        
        .events-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 20px;
        }
        
        .event-card {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
        }
        
        .event-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.15);
        }
        
        .event-title {
            font-size: 1.3em;
            font-weight: 600;
            color: #333;
            margin-bottom: 10px;
            line-height: 1.3;
        }
        
        .event-date {
            color: #667eea;
            font-weight: 500;
            margin-bottom: 8px;
            font-size: 1.1em;
        }
        
        .event-location {
            color: #666;
            margin-bottom: 15px;
            font-size: 0.95em;
        }
        
        .rsvp-badge {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 20px;
            color: white;
            font-weight: bold;
            font-size: 0.9em;
        }
        
        .rsvp-high { background: #10b981; }
        .rsvp-medium { background: #f59e0b; }
        .rsvp-low { background: #ef4444; }
        
        .days-away {
            float: right;
            background: #f3f4f6;
            color: #374151;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 0.8em;
            font-weight: 500;
        }
        
        .last-updated {
            text-align: center;
            color: #666;
            font-style: italic;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
        }
        
        .refresh-button {
            background: #667eea;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1em;
            margin: 0 10px;
            transition: background 0.3s ease;
        }
        
        .refresh-button:hover {
            background: #5a67d8;
        }
        
        .refresh-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        
        @media (max-width: 768px) {
            .events-grid {
                grid-template-columns: 1fr;
            }
            
            .summary {
                grid-template-columns: 1fr;
            }
            
            .venue-name {
                font-size: 2em;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="venue-name">🎵 The Listening Booth</h1>
            <p class="venue-subtitle">
                <span class="live-indicator"></span>
                Live Events Dashboard | Lewes, Delaware
            </p>
        </div>
        
        <div class="content">
            <div id="loading" class="loading">
                Loading events data...
            </div>
            
            <div id="dashboard" style="display: none;">
                <div class="summary" id="summary">
                    <!-- Summary cards will be inserted here -->
                </div>
                
                <div class="events-grid" id="events-grid">
                    <!-- Event cards will be inserted here -->
                </div>
                
                <div class="last-updated">
                    <button class="refresh-button" onclick="refreshData()">🔄 Refresh Data</button>
                    <br><br>
                    <span id="last-updated-text">Last updated: Loading...</span>
                </div>
            </div>
        </div>
    </div>

    <script>
        let isRefreshing = false;
        
        async function loadDashboard() {
            try {
                const response = await fetch('/api/events/cached');
                if (!response.ok) {
                    // If no cached data, fetch fresh data
                    const freshResponse = await fetch('/api/events');
                    if (!freshResponse.ok) throw new Error('Failed to fetch events');
                    const data = await freshResponse.json();
                    renderDashboard(data);
                } else {
                    const data = await response.json();
                    renderDashboard(data);
                }
            } catch (error) {
                console.error('Error loading dashboard:', error);
                document.getElementById('loading').innerHTML = '❌ Error loading events data. Please try again.';
            }
        }
        
        async function refreshData() {
            if (isRefreshing) return;
            
            isRefreshing = true;
            const button = document.querySelector('.refresh-button');
            button.disabled = true;
            button.innerHTML = '🔄 Refreshing...';
            
            try {
                const response = await fetch('/api/events');
                if (!response.ok) throw new Error('Failed to refresh events');
                const data = await response.json();
                renderDashboard(data);
            } catch (error) {
                console.error('Error refreshing data:', error);
                alert('Failed to refresh data. Please try again.');
            } finally {
                isRefreshing = false;
                button.disabled = false;
                button.innerHTML = '🔄 Refresh Data';
            }
        }
        
        function renderDashboard(data) {
            // Hide loading, show dashboard
            document.getElementById('loading').style.display = 'none';
            document.getElementById('dashboard').style.display = 'block';
            
            // Render summary cards
            const summaryHTML = \`
                <div class="summary-card">
                    <div class="summary-number">\${data.summary.totalUpcomingEvents}</div>
                    <div class="summary-label">Upcoming Events</div>
                </div>
                <div class="summary-card">
                    <div class="summary-number">\${data.summary.totalRSVPs}</div>
                    <div class="summary-label">Total RSVPs</div>
                </div>
                <div class="summary-card">
                    <div class="summary-number">\${data.summary.averageRSVPsPerEvent}</div>
                    <div class="summary-label">Avg RSVPs/Event</div>
                </div>
            \`;
            document.getElementById('summary').innerHTML = summaryHTML;
            
            // Render event cards
            const eventsHTML = data.events.map(event => {
                const rsvpClass = event.rsvpCount > 10 ? 'rsvp-high' : 
                                 event.rsvpCount > 5 ? 'rsvp-medium' : 'rsvp-low';
                
                return \`
                    <div class="event-card">
                        <div class="days-away">\${event.daysFromNow} days</div>
                        <div class="event-title">\${event.title}</div>
                        <div class="event-date">📅 \${event.date}</div>
                        <div class="event-location">📍 \${event.location}</div>
                        <span class="rsvp-badge \${rsvpClass}">\${event.rsvpCount} RSVPs</span>
                    </div>
                \`;
            }).join('');
            document.getElementById('events-grid').innerHTML = eventsHTML;
            
            // Update last updated time
            const lastUpdated = data.lastUpdated || data.generatedAt;
            document.getElementById('last-updated-text').innerHTML = 
                \`Last updated: \${new Date(lastUpdated).toLocaleString()}\`;
        }
        
        // Auto-refresh every 5 minutes
        setInterval(() => {
            if (!isRefreshing) {
                refreshData();
            }
        }, 5 * 60 * 1000);
        
        // Load dashboard on page load
        loadDashboard();
    </script>
</body>
</html>
    `);
});

// Generate and cache report every hour
async function updateCache() {
    try {
        console.log('🔄 Updating events cache...');
        const reportData = await venueManager.generateUpcomingEventsReport(20);
        
        if (reportData.success) {
            latestReport = reportData.report;
            lastUpdated = new Date().toISOString();
            console.log(`✅ Cache updated with ${reportData.report.events.length} events`);
        } else {
            console.error('❌ Failed to update cache:', reportData.error);
        }
    } catch (error) {
        console.error('❌ Cache update error:', error.message);
    }
}

// Schedule automatic updates every hour
cron.schedule('0 * * * *', updateCache);

// Update cache on startup
updateCache();

// Start server
app.listen(PORT, () => {
    console.log('🚀 The Listening Booth Dashboard Server');
    console.log('=======================================');
    console.log(`🌐 Server running at: http://localhost:${PORT}`);
    console.log(`📊 Dashboard URL: http://localhost:${PORT}`);
    console.log(`🔧 API Endpoints:`);
    console.log(`   GET /api/events - Fresh events data`);
    console.log(`   GET /api/events/cached - Cached events data`);
    console.log(`   GET /api/health - Health check`);
    console.log(`⏰ Auto-refresh: Every hour`);
    console.log(`🎵 Venue: The Listening Booth, Lewes, DE`);
});

module.exports = app;