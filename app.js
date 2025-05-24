// server.js
require('dotenv').config(); // Ensure environment variables are loaded
const express = require('express');
// const cors = require('cors');
const supabase = require('./supabaseClient'); // Import the Supabase client

const app = express();
const port = process.env.PORT || 3004; // Use port from .env or default to 3001

// Allow ONLY your frontend origin for direct calls
// const corsOptions = {
//     origin: process.env.FRONTEND_URL, // Or use process.env.FRONTEND_URL if defined here
//     methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', // Allow all standard methods
//     allowedHeaders: ['Content-Type', 'Authorization'], // Allow common headers (Authorization might be needed later if you add direct auth)
//     optionsSuccessStatus: 204 // Set success status for preflight requests
//     // credentials: false // Generally false/omit for direct calls not expecting cookies from frontend
//   };
//   console.log(`[Properties Service] CORS enabled for origin: ${corsOptions.origin}`); // Log CORS config
  
//   // --- Middleware ---
//   app.use(cors(corsOptions)); // <<< ENABLE CORS WITH OPTIONS

// --- Middleware ---
// app.use(cors()); // Enable CORS for all origins (adjust in production if needed)
app.use(express.json()); // Parse JSON request bodies

// --- Basic Route for Testing ---
app.get('/', (req, res) => {
    res.send('Properties CRUD API with Supabase');
});

// --- CRUD Routes ---

// CREATE: Add a new property
app.post('/properties', async (req, res) => {
    const propertyData = req.body; // Get property data from request body

    // Basic validation (Add more robust validation as needed)
    if (!propertyData.name) {
        return res.status(400).json({ error: 'Property name is required' });
    }

    try {
        const { data, error } = await supabase
            .from('properties')
            .insert([propertyData]) // insert expects an array of objects
            .select() // Return the newly created object(s)
            .single(); // Expecting only one row back

        if (error) {
            console.error('Supabase Insert Error:', error);
            // Check for specific Supabase errors if needed
            return res.status(500).json({ error: error.message || 'Failed to create property' });
        }

        res.status(201).json(data); // Send back the created property
    } catch (err) {
        console.error('Server Insert Error:', err);
        res.status(500).json({ error: 'An unexpected error occurred' });
    }
});

// READ: Get all properties
app.get('/properties', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('properties')
            .select('*')
            // --- ADD THIS LINE ---
            .order('name', { ascending: false }); // Order by 'name' column, descending

        if (error) {
            console.error('Supabase Select All Error:', error);
            return res.status(500).json({ error: error.message || 'Failed to fetch properties' });
        }

        res.status(200).json(data || []); // Send back the sorted array
    } catch (err) {
        console.error('Server Select All Error:', err);
        res.status(500).json({ error: 'An unexpected error occurred' });
    }
});

// READ: Get a single property by ID
app.get('/properties/:id', async (req, res) => {
    const { id } = req.params; // Get the ID from the route parameters

    try {
        const { data, error } = await supabase
            .from('properties')
            .select('*')
            .eq('id', id) // Filter by the 'id' column
            .single();    // Expect exactly one result (or null)

        if (error) {
            // Supabase might return an error if *no rows* match with .single()
            console.error(`Supabase Select One Error (ID: ${id}):`, error);
            // Check if it's a 'not found' type error (PGRST116 is common for .single() not found)
            if (error.code === 'PGRST116') {
                 return res.status(404).json({ error: 'Property not found' });
            }
            return res.status(500).json({ error: error.message || 'Failed to fetch property' });
        }

        // Handle case where .single() returns null data without an error explicitly
        if (!data) {
             return res.status(404).json({ error: 'Property not found' });
        }

        res.status(200).json(data); // Send back the property data
    } catch (err) {
        console.error(`Server Select One Error (ID: ${id}):`, err);
        res.status(500).json({ error: 'An unexpected error occurred' });
    }
});

// UPDATE: Modify an existing property by ID
app.put('/properties/:id', async (req, res) => {
    const { id } = req.params;
    const updates = req.body; // Get the fields to update from the request body

    // Remove 'id' from updates if present, as we don't want to update the primary key
    delete updates.id;

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No update data provided' });
    }

    try {
        const { data, error } = await supabase
            .from('properties')
            .update(updates)
            .eq('id', id)
            .select() // Return the updated object(s)
            .single(); // Expect one updated row

        if (error) {
            console.error(`Supabase Update Error (ID: ${id}):`, error);
             // Check if it's a 'not found' type error (e.g., update matched 0 rows)
            if (error.code === 'PGRST116') { // Check if this code applies to update errors too
                 return res.status(404).json({ error: 'Property not found or no changes made' });
            }
            return res.status(500).json({ error: error.message || 'Failed to update property' });
        }

         if (!data) {
             // If no rows were updated (e.g., ID didn't exist)
             return res.status(404).json({ error: 'Property not found or no changes applied' });
        }

        res.status(200).json(data); // Send back the updated property
    } catch (err) {
        console.error(`Server Update Error (ID: ${id}):`, err);
        res.status(500).json({ error: 'An unexpected error occurred' });
    }
});

// DELETE: Remove a property by ID
app.delete('/properties/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // Note: .delete() in supabase-js v2 might not return the deleted data by default.
        // It often returns an object with data (potentially null or empty array) and count.
        const { error, count } = await supabase
            .from('properties')
            .delete()
            .eq('id', id); // Filter by ID

        if (error) {
            console.error(`Supabase Delete Error (ID: ${id}):`, error);
            return res.status(500).json({ error: error.message || 'Failed to delete property' });
        }

        // Check if any row was actually deleted
        if (count === 0) {
             return res.status(404).json({ error: 'Property not found' });
        }

        // Successfully deleted
        res.status(204).send(); // 204 No Content is standard for successful DELETE

        // Or send a success message:
        // res.status(200).json({ message: 'Property deleted successfully' });

    } catch (err) {
        console.error(`Server Delete Error (ID: ${id}):`, err);
        res.status(500).json({ error: 'An unexpected error occurred' });
    }
});

// GET: Get ALL property objects for a specific user ID
// Endpoint is now /properties/user/:userId
app.get('/properties/user/:userId', async (req, res) => { // <--- Changed to GET and updated path
    const { userId } = req.params; // Get the user ID from the URL parameters
    console.log(`[Properties Service GET /properties/user/:userId] Received request to get properties for user ID: ${userId}`);

    try {
        // Query the 'properties' table
        // Select all columns ('*') where the 'user_id' column matches the provided userId
        const { data: properties, error: dbError } = await supabase
            .from('properties')
            .select('*')         // Select all columns
            .eq('user_id', userId); // Filter by the user_id column

        console.log(`[Properties Service GET /properties/user/:userId] Supabase fetch result for User ID ${userId}:`, properties, dbError);


        if (dbError) {
            console.error(`[Properties Service GET /properties/user/:userId] Supabase fetch error (User ID: ${userId}):`, dbError);
            // Return a 500 status for a database error
            return res.status(500).json({ error: dbError.message || 'Failed to fetch properties' });
        }

        console.log(`[Properties Service GET /properties/user/:userId] Found ${properties ? properties.length : 0} properties for user ID: ${userId}.`);
        // Return 200 OK and the array of property objects (or an empty array if none found)
        res.status(200).json(properties || []); // Ensure we always return an array

    } catch (err) {
        // This catch block handles unexpected server errors during the process
        console.error(`[Properties Service GET /properties/user/:userId] Unhandled server error (User ID: ${userId}):`, err);
        res.status(500).json({ error: 'An unexpected error occurred while fetching properties' });
    }
});

// DELETE: Remove ALL properties for a given user ID
// Endpoint changed from /properties/:id to /users/:userId/properties
app.delete('/properties/user/:userId', async (req, res) => {
    // 1. Get the user ID from the URL parameters
    const { userId } = req.params;

    try {
        // 2. Delete ALL rows in the 'properties' table where 'user_id' matches the provided userId
        // This is the key change from deleting by property ID
        const { error, count } = await supabase
            .from('properties')
            .delete()
            .eq('user_id', userId); // <-- Filter by the user_id column

        if (error) {
            console.error(`Supabase Delete Error (User ID: ${userId}):`, error);
            return res.status(500).json({ error: error.message || 'Failed to delete properties' });
        }

        console.log(`[Server DELETE /users/:userId/properties] Deleted ${count} properties for user ID: ${userId}`);

        // If count is 0, it means the user exists but had no properties.
        // This is a successful operation from the perspective of "ensure no properties for this user".
        // Returning 204 No Content is appropriate.
        if (count === 0) {
             console.log(`[Server DELETE /users/:userId/properties] No properties found for user ID: ${userId} (0 rows deleted).`);
             // Optionally, you could return 404 here if you specifically want to indicate
             // that no resources matching the criteria were found *to* delete, but 204
             // is more standard for "the state you requested (no properties for this user) is now achieved".
             // return res.status(404).json({ error: 'No properties found for this user' });
        }


        // Successfully deleted (or no properties found to delete)
        res.status(204).send(); // 204 No Content is standard for successful DELETE

        // If you prefer a response body, you could do:
        // res.status(200).json({ message: `Deleted ${count} properties for user ${userId}` });

    } catch (err) {
        console.error(`Server Delete Error (User ID: ${userId}):`, err);
        res.status(500).json({ error: 'An unexpected error occurred' });
    }
});

module.exports = app; // <--- ADD THIS LINE TO EXPORT THE APP INSTANCE

// // --- Start the Server ---
// app.listen(port, () => {
//     console.log(`Server listening at http://localhost:${port}`);
// });