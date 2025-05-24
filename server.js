// index.js
// This file is the main entry point to start the Express server

require('dotenv').config(); // Load environment variables

// Import the Express application instance from app.js
const app = require('./app');

// Get the port from environment variables, defaulting to 3004      
const port = process.env.PORT || 3004;

// Start the server by calling listen on the imported app instance
const server = app.listen(port, () => {
    console.log(`Properties Service listening at http://localhost:${port}`);
    // Optional: Log other relevant environment variables at startup
    console.log(`  -> SUPABASE_URL: ${process.env.SUPABASE_URL ? 'Loaded' : 'Not Set!'}`);
    console.log(`  -> SUPABASE_KEY: ${process.env.SUPABASE_KEY ? 'Loaded' : 'Not Set!'}`);
});

// Optional: Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});