// server.js - Updated with fixed email and better metrics display
require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const FinalTicketManager = require('./final-ticket-manager');

const app = express();
const PORT = process.env.PORT || 3000;

// Store latest report in memory
let latestReport = null;
let lastUpdated = null;

// Initialize managers
const ticketManager = new FinalTicketManager();

// Email configuration
const emailConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
};

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// API endpoint for live events data
app.get('/api/events', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const reportData = await ticketManager.generateTicketReport(limit);
        
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

// API endpoint for cached data (faster loading)
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

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        lastUpdate: lastUpdated,
        hasData: !!latestReport,
        uptime: process.uptime(),
        totalEvents: latestReport?.summary?.totalUpcomingEvents || 0,
        totalTickets: latestReport?.summary?.totalTicketsSold || 0,
        ticketedEvents: latestReport?.summary?.ticketedEventsCount || 0
    });
});

// Email configuration endpoint
app.post('/api/email/test', async (req, res) => {
    try {
        if (!process.env.EMAIL_USER) {
            return res.status(400).json({ error: 'Email not configured' });
        }
        
        await sendTestEmail();
        res.json({ success: true, message: 'Test email sent' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Main dashboard route
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>The Listening Booth - Live Dashboard</title>
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
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            min-height: 100vh;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            position: sticky;
            top: 0;
            z-index: 100;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
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
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }
        
        .live-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            background: #10b981;
            border-radius: 50%;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        
        .toolbar {
            background: #f8f9fa;
            padding: 20px 30px;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 15px;
        }
        
        .refresh-button, .email-button {
            background: #667eea;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1em;
            transition: background 0.3s ease;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .refresh-button:hover, .email-button:hover {
            background: #5a67d8;
        }
        
        .refresh-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        
        .last-updated {
            color: #666;
            font-size: 0.9em;
        }
        
        .content {
            padding: 30px;
        }
        
        .loading {
            text-align: center;
            padding: 100px;
            font-size: 1.2em;
            color: #666;
        }
        
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 25px;
            margin-bottom: 40px;
        }
        
        .summary-card {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            padding: 30px;
            border-radius: 12px;
            text-align: center;
            transition: transform 0.3s ease;
        }
        
        .summary-card:hover {
            transform: translateY(-5px);
        }
        
        .summary-number {
            font-size: 3em;
            font-weight: bold;
            margin: 0;
        }
        
        .summary-label {
            margin: 10px 0 0 0;
            opacity: 0.9;
            font-size: 1.1em;
        }
        
        .note {
            background: #e0f2fe;
            border: 1px solid #b3e5fc;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 30px;
            color: #01579b;
            font-size: 0.9em;
        }
        
        .urgent-alert {
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
            color: #b91c1c;
        }
        
        .urgent-alert h3 {
            margin: 0 0 10px 0;
            font-size: 1.2em;
        }
        
        .sections {
            display: grid;
            grid-template-columns: 1fr 400px;
            gap: 30px;
            margin-bottom: 40px;
        }
        
        .events-section {
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .section-header {
            background: #f8f9fa;
            padding: 20px;
            border-bottom: 1px solid #e5e7eb;
            font-weight: 600;
            font-size: 1.2em;
        }
        
        .sidebar {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }
        
        .top-events, .this-week {
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .events-grid {
            display: grid;
            gap: 20px;
            padding: 20px;
        }
        
        .event-card {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 20px;
            transition: all 0.3s ease;
        }
        
        .event-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 15px rgba(0,0,0,0.1);
        }
        
        .event-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }
        
        .event-type {
            color: white;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 0.8em;
            font-weight: 600;
        }
        
        .days-away {
            background: #f3f4f6;
            color: #374151;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 0.8em;
            font-weight: 600;
        }
        
        .event-title {
            font-size: 1.2em;
            font-weight: 600;
            color: #333;
            margin-bottom: 8px;
        }
        
        .event-date, .event-venue {
            color: #666;
            margin-bottom: 6px;
            font-size: 0.9em;
        }
        
        .event-url {
            margin-bottom: 12px;
        }
        
        .event-url a {
            color: #667eea;
            text-decoration: none;
            font-size: 0.85em;
            transition: color 0.3s ease;
        }
        
        .event-url a:hover {
            color: #5a67d8;
            text-decoration: underline;
        }
        
        .event-sales {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 12px;
        }
        
        .tickets-sold {
            padding: 6px 12px;
            border-radius: 15px;
            color: white;
            font-weight: 600;
            font-size: 0.85em;
        }
        
        .status-high { background: #10b981; }
        .status-medium { background: #f59e0b; }
        .status-low { background: #6b7280; }
        .status-urgent { background: #ef4444; }
        
        .event-badge {
            font-size: 0.75em;
            padding: 3px 6px;
            border-radius: 8px;
            background: #f3f4f6;
            color: #374151;
        }
        
        .sidebar-list {
            padding: 0;
            margin: 0;
            list-style: none;
        }
        
        .sidebar-item {
            padding: 15px 20px;
            border-bottom: 1px solid #f3f4f6;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .sidebar-item:last-child {
            border-bottom: none;
        }
        
        .item-title {
            font-weight: 500;
            color: #333;
        }
        
        .item-count {
            background: #667eea;
            color: white;
            padding: 4px 8px;
            border-radius: 10px;
            font-size: 0.8em;
            font-weight: 600;
        }
        
        @media (max-width: 1200px) {
            .sections {
                grid-template-columns: 1fr;
            }
            
            .sidebar {
                flex-direction: row;
            }
        }
        
        @media (max-width: 768px) {
            .summary {
                grid-template-columns: 1fr 1fr;
            }
            
            .sidebar {
                flex-direction: column;
            }
            
            .venue-name {
                font-size: 2em;
            }
            
            .toolbar {
                flex-direction: column;
                align-items: stretch;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="venue-name">The Listening Booth</h1>
            <p class="venue-subtitle">
                <span class="live-indicator"></span>
                Live Events Dashboard | Lewes, Delaware
            </p>
        </div>
        
        <div class="toolbar">
            <div class="last-updated">
                <span id="last-updated-text">Loading...</span>
            </div>
            <div style="display: flex; gap: 10px;">
                <button class="email-button" onclick="sendTestEmail()">
                    Test Email
                </button>
                <button class="refresh-button" onclick="refreshData()">
                    Refresh Data
                </button>
            </div>
        </div>
        
        <div class="content">
            <div id="loading" class="loading">
                Loading events data...
            </div>
            
            <div id="dashboard" style="display: none;">
                <div id="urgent-alert" class="urgent-alert" style="display: none;">
                    <h3>Urgent Attention Needed</h3>
                    <p id="urgent-message"></p>
                </div>
                
                <div class="summary" id="summary">
                    <!-- Summary cards will be inserted here -->
                </div>
                
                <div id="average-note" class="note" style="display: none;">
                    <strong>Note:</strong> Average calculated only for ticketed events. Excludes free/RSVP-only events like open mics and workshops.
                </div>
                
                <div class="sections">
                    <div class="events-section">
                        <div class="section-header">All Upcoming Events</div>
                        <div class="events-grid" id="events-grid">
                            <!-- Event cards will be inserted here -->
                        </div>
                    </div>
                    
                    <div class="sidebar">
                        <div class="top-events">
                            <div class="section-header">Top Selling</div>
                            <ul class="sidebar-list" id="top-events">
                                <!-- Top events will be inserted here -->
                            </ul>
                        </div>
                        
                        <div class="this-week">
                            <div class="section-header">This Week</div>
                            <ul class="sidebar-list" id="this-week">
                                <!-- This week events will be inserted here -->
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        let isRefreshing = false;
        
        async function loadDashboard() {
            try {
                // Try cached data first
                let response = await fetch('/api/events/cached');
                if (!response.ok) {
                    // If no cached data, fetch fresh
                    response = await fetch('/api/events');
                }
                
                if (!response.ok) {
                    throw new Error('Failed to fetch events');
                }
                
                const data = await response.json();
                renderDashboard(data);
            } catch (error) {
                console.error('Error loading dashboard:', error);
                document.getElementById('loading').innerHTML = 'Error loading events data. Please try refreshing.';
            }
        }
        
        async function refreshData() {
            if (isRefreshing) return;
            
            isRefreshing = true;
            const button = document.querySelector('.refresh-button');
            button.disabled = true;
            button.innerHTML = 'Refreshing...';
            
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
                button.innerHTML = 'Refresh Data';
            }
        }
        
        async function sendTestEmail() {
            try {
                const response = await fetch('/api/email/test', { method: 'POST' });
                const result = await response.json();
                
                if (result.success) {
                    alert('Test email sent successfully!');
                } else {
                    alert('Email test failed: ' + result.error);
                }
            } catch (error) {
                alert('Error sending test email: ' + error.message);
            }
        }
        
        function renderDashboard(data) {
            // Hide loading, show dashboard
            document.getElementById('loading').style.display = 'none';
            document.getElementById('dashboard').style.display = 'block';
            
            // Show the average note if there are both ticketed and free events
            if (data.summary.ticketedEventsCount && data.summary.freeEventsCount) {
                document.getElementById('average-note').style.display = 'block';
            }
            
            // Handle urgent events alert
            const urgentEvents = data.summary.urgentEvents || [];
            const urgentAlert = document.getElementById('urgent-alert');
            if (urgentEvents.length > 0) {
                urgentAlert.style.display = 'block';
                document.getElementById('urgent-message').innerHTML = 
                    urgentEvents.length + ' events this week have no tickets sold: ' + urgentEvents.map(e => e.title).join(', ');
            } else {
                urgentAlert.style.display = 'none';
            }
            
            // Render summary cards
            const summaryHTML = 
                '<div class="summary-card">' +
                    '<div class="summary-number">' + data.summary.totalUpcomingEvents + '</div>' +
                    '<div class="summary-label">Total Events</div>' +
                '</div>' +
                '<div class="summary-card">' +
                    '<div class="summary-number">' + data.summary.totalTicketsSold + '</div>' +
                    '<div class="summary-label">Tickets Sold</div>' +
                '</div>' +
                '<div class="summary-card">' +
                    '<div class="summary-number">' + data.summary.ticketedEventsCount + '</div>' +
                    '<div class="summary-label">Ticketed Events</div>' +
                '</div>' +
                '<div class="summary-card">' +
                    '<div class="summary-number">' + data.summary.averageTicketsPerEvent + '</div>' +
                    '<div class="summary-label">Avg per Ticketed Event</div>' +
                '</div>';
            document.getElementById('summary').innerHTML = summaryHTML;
            
            // Render events
            const typeColors = {
                'Concert': '#667eea',
                'Open Mic': '#f59e0b',
                'Jam Session': '#10b981',
                'Workshop': '#8b5cf6',
                'Fundraiser': '#ef4444'
            };
            
            const eventsHTML = data.events.map(event => {
                const statusClass = 'status-' + event.salesStatus;
                const typeColor = typeColors[event.eventType] || '#6b7280';
                
                let ticketInfo;
                let eventBadge = '';
                
                if (event.isRSVPOnly) {
                    ticketInfo = 'RSVP only';
                    eventBadge = '<span class="event-badge">RSVP</span>';
                } else if (event.isPaid) {
                    ticketInfo = event.paidTickets + ' paid';
                    eventBadge = '<span class="event-badge">PAID</span>';
                } else if (event.isFree) {
                    ticketInfo = event.freeTickets + ' free';
                    eventBadge = '<span class="event-badge">FREE</span>';
                } else {
                    ticketInfo = event.ticketsSold + ' tickets';
                }
                
                // Construct event URL from slug
                const eventUrl = event.slug ? 'https://listeningbooth.com/events/' + event.slug : '#';
                
                return '<div class="event-card">' +
                        '<div class="event-header">' +
                            '<span class="event-type" style="background: ' + typeColor + '">' + event.eventType + '</span>' +
                            '<span class="days-away">' + event.daysFromNow + ' days</span>' +
                        '</div>' +
                        '<div class="event-title">' + event.title + '</div>' +
                        '<div class="event-date">' + event.date + '</div>' +
                        '<div class="event-venue">' + event.venue + '</div>' +
                        '<div class="event-url"><a href="' + eventUrl + '" target="_blank" rel="noopener">View Event Details</a></div>' +
                        '<div class="event-sales">' +
                            '<span class="tickets-sold ' + statusClass + '">' + ticketInfo + '</span>' +
                            eventBadge +
                        '</div>' +
                    '</div>';
            }).join('');
            document.getElementById('events-grid').innerHTML = eventsHTML;
            
            // Render top events sidebar
            const topEventsHTML = (data.summary.topSellingEvents || []).map(event => 
                '<li class="sidebar-item">' +
                    '<span class="item-title">' + event.title + '</span>' +
                    '<span class="item-count">' + event.tickets + '</span>' +
                '</li>'
            ).join('');
            document.getElementById('top-events').innerHTML = topEventsHTML || '<li class="sidebar-item"><span class="item-title">No sales yet</span></li>';
            
            // Render this week events
            const thisWeekHTML = (data.summary.thisWeekEvents || []).map(event => 
                '<li class="sidebar-item">' +
                    '<span class="item-title">' + event.title + '</span>' +
                    '<span class="item-count">' + event.daysFromNow + 'd</span>' +
                '</li>'
            ).join('');
            document.getElementById('this-week').innerHTML = thisWeekHTML || '<li class="sidebar-item"><span class="item-title">No events this week</span></li>';
            
            // Update last updated time
            const lastUpdated = data.lastUpdated || data.generatedAt;
            document.getElementById('last-updated-text').innerHTML = 
                'Last updated: ' + new Date(lastUpdated).toLocaleString();
        }
        
        // Auto-refresh every 10 minutes
        setInterval(() => {
            if (!isRefreshing) {
                refreshData();
            }
        }, 10 * 60 * 1000);
        
        // Load dashboard on page load
        loadDashboard();
    </script>
</body>
</html>
    `);
});

// Update cache automatically
async function updateCache() {
    try {
        console.log('Updating events cache...');
        const reportData = await ticketManager.generateTicketReport(20);
        
        if (reportData.success) {
            latestReport = reportData.report;
            lastUpdated = new Date().toISOString();
            console.log(`Cache updated with ${reportData.report.events.length} events, ${reportData.report.summary.totalTicketsSold} tickets sold across ${reportData.report.summary.ticketedEventsCount} ticketed events`);
            
            // Send daily report if it's 9 AM
            const now = new Date();
            if (now.getHours() === 9 && now.getMinutes() < 30) {
                await sendDailyReport(reportData.report);
            }
        } else {
            console.error('Failed to update cache:', reportData.error);
        }
    } catch (error) {
        console.error('Cache update error:', error.message);
    }
}

// Email functions - FIXED createTransport method
async function sendTestEmail() {
    if (!process.env.EMAIL_USER) {
        throw new Error('Email not configured. Set EMAIL_USER and EMAIL_PASS environment variables.');
    }
    
    const transporter = nodemailer.createTransport(emailConfig);
    
    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        subject: 'The Listening Booth - Dashboard Test Email',
        html: `
            <h2>Dashboard Test Email</h2>
            <p>Your Listening Booth dashboard email system is working correctly!</p>
            <p>Access your live dashboard: <a href="${process.env.DASHBOARD_URL || 'http://localhost:3000'}">View Dashboard</a></p>
            <p>Sent at: ${new Date().toLocaleString()}</p>
        `
    });
}

async function sendDailyReport(report) {
    if (!process.env.EMAIL_USER || !process.env.DAILY_REPORT_EMAILS) {
        console.log('Skipping daily report - email not configured');
        return;
    }
    
    const transporter = nodemailer.createTransport(emailConfig);
    const recipients = process.env.DAILY_REPORT_EMAILS.split(',');
    
    const urgentEvents = report.summary.urgentEvents || [];
    const topEvents = report.summary.topSellingEvents || [];
    const thisWeekEvents = report.summary.thisWeekEvents || [];
    
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
                <h1>The Listening Booth</h1>
                <h2>Daily Events Report</h2>
                <p>${new Date().toLocaleDateString()}</p>
            </div>
            
            <div style="padding: 30px;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 30px;">
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 2em; font-weight: bold; color: #667eea;">${report.summary.totalUpcomingEvents}</div>
                        <div>Total Events</div>
                    </div>
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 2em; font-weight: bold; color: #667eea;">${report.summary.totalTicketsSold}</div>
                        <div>Tickets Sold</div>
                    </div>
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 2em; font-weight: bold; color: #667eea;">${report.summary.ticketedEventsCount}</div>
                        <div>Ticketed Events</div>
                    </div>
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 2em; font-weight: bold; color: #667eea;">${report.summary.averageTicketsPerEvent}</div>
                        <div>Avg per Ticketed Event</div>
                    </div>
                </div>
                
                <div style="background: #e3f2fd; border: 1px solid #bbdefb; padding: 15px; border-radius: 8px; margin-bottom: 30px; font-size: 0.9em;">
                    <strong>Note:</strong> Average calculated only for ticketed events (${report.summary.ticketedEventsCount} events). 
                    Excludes ${report.summary.freeEventsCount} free/RSVP-only events.
                </div>
                
                ${urgentEvents.length > 0 ? `
                <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
                    <h3 style="color: #b91c1c; margin: 0 0 10px 0;">Urgent Attention Needed</h3>
                    <p style="color: #b91c1c; margin: 0;">${urgentEvents.length} events this week have no tickets sold</p>
                    <ul style="color: #b91c1c; margin: 10px 0 0 0;">
                        ${urgentEvents.map(e => `<li>${e.title} (${e.daysFromNow} days away)</li>`).join('')}
                    </ul>
                </div>
                ` : ''}
                
                ${topEvents.length > 0 ? `
                <div style="margin-bottom: 30px;">
                    <h3>Top Selling Events</h3>
                    <ul>
                        ${topEvents.map(e => `<li>${e.title} - ${e.tickets} tickets</li>`).join('')}
                    </ul>
                </div>
                ` : ''}
                
                <div style="text-align: center; margin-top: 40px;">
                    <a href="${process.env.DASHBOARD_URL || 'http://localhost:3000'}" 
                       style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                        View Live Dashboard
                    </a>
                </div>
            </div>
        </div>
    `;
    
    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: recipients,
        subject: `The Listening Booth Daily Report - ${report.summary.totalTicketsSold} tickets sold`,
        html: html
    });
    
    console.log('Daily report sent to:', recipients.join(', '));
}

// Schedule automatic updates every hour
cron.schedule('0 * * * *', updateCache);

// Schedule daily reports at 9 AM
cron.schedule('0 9 * * *', async () => {
    if (latestReport) {
        await sendDailyReport(latestReport);
    }
});

// Update cache on startup
updateCache();

// Start server
app.listen(PORT, () => {
    console.log('The Listening Booth Dashboard Server');
    console.log('====================================');
    console.log(`Dashboard URL: http://localhost:${PORT}`);
    console.log(`Live events data with auto-refresh`);
    console.log(`Email reports ${process.env.EMAIL_USER ? 'configured' : 'not configured'}`);
    console.log(`Auto-update: Every hour`);
    console.log(`Daily reports: 9:00 AM`);
    console.log(`Venue: The Listening Booth, Lewes, DE`);
});

module.exports = app;