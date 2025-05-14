// server.js
require('dotenv').config(); // Ensure environment variables are loaded
const express = require('express');
// const cors = require('cors'); // Keep commented out as per your code
const supabase = require('./supabaseClient'); // Import the Supabase client

const app = express(); // <-- Define app here

// Use port from .env or default to 3004
const port = process.env.PORT || 3004; // Use PORT for the property service

// CORS configuration (keep commented out or adjust as needed)
// const corsOptions = { /* ... */ };
// app.use(cors(corsOptions));

// --- Middleware ---
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
            console.error('[Properties Service POST /properties] Supabase Insert Error:', error);
            // Check for specific Supabase errors if needed (e.g., 23505 for unique constraints)
             if (error.code === '23505') {
                 return res.status(409).json({ error: 'A property with this name or identifier already exists' });
             }
            return res.status(500).json({ error: error.message || 'Failed to create property' });
        }

        res.status(201).json(data); // Send back the created property
    } catch (err) {
        console.error('[Properties Service POST /properties] Server Insert Error:', err);
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
            console.error('[Properties Service GET /properties] Supabase Select All Error:', error);
            return res.status(500).json({ error: error.message || 'Failed to fetch properties' });
        }

        res.status(200).json(data || []); // Send back the sorted array
    } catch (err) {
        console.error('[Properties Service GET /properties] Server Select All Error:', err);
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
            console.error(`[Properties Service GET /properties/:id] Supabase Select One Error (ID: ${id}):`, error);
            // Check if it's a 'not found' type error (PGRST116 is common for .single() not found)
            if (error.code === 'PGRST116') {
                 return res.status(404).json({ error: 'Property not found' });
            }
             // If it's not a 'not found' error, it's a server error
            return res.status(500).json({ error: error.message || 'Failed to fetch property' });
        }

        // Handle case where .single() returns null data without an error explicitly (less common)
        if (!data) {
             return res.status(404).json({ error: 'Property not found' });
        }

        res.status(200).json(data); // Send back the property data
    } catch (err) {
        console.error(`[Properties Service GET /properties/:id] Server Select One Error (ID: ${id}):`, err);
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
            console.error(`[Properties Service PUT /properties/:id] Supabase Update Error (ID: ${id}):`, error);
             // Check if it's a 'not found' type error (e.g., update matched 0 rows)
             // Supabase often returns PGRST116 for update/delete with single() finding no rows.
            if (error.code === 'PGRST116') {
                 return res.status(404).json({ error: 'Property not found or no changes made' });
            }
            // Check for unique constraint violations if updating fields like name
             if (error.code === '23505') {
                 return res.status(409).json({ error: 'A property with this name or identifier already exists' });
             }

            return res.status(500).json({ error: error.message || 'Failed to update property' });
        }

         if (!data) {
             // If no rows were updated (e.g., ID didn't exist). Redundant with PGRST116 check, but safe.
             return res.status(404).json({ error: 'Property not found or no changes applied' });
        }

        res.status(200).json(data); // Send back the updated property
    } catch (err) {
        console.error(`[Properties Service PUT /properties/:id] Server Update Error (ID: ${id}):`, err);
        res.status(500).json({ error: 'An unexpected error occurred' });
    }
});

// DELETE: Remove a property by ID
app.delete('/properties/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // Supabase delete() in v2 returns { data, error, count } or just { error, count } if nothing selected.
        const { error, count } = await supabase
            .from('properties')
            .delete()
            .eq('id', id); // Filter by ID

        if (error) {
            console.error(`[Properties Service DELETE /properties/:id] Supabase Delete Error (ID: ${id}):`, error);
            return res.status(500).json({ error: error.message || 'Failed to delete property' });
        }

        // Check if any row was actually deleted (count > 0)
        if (count === 0) {
             return res.status(404).json({ error: 'Property not found' });
        }

        // Successfully deleted
        console.log(`[Properties Service DELETE /properties/:id] Property ${id} deleted successfully.`);
        res.status(204).send(); // 204 No Content is standard for successful DELETE

        // Or send a success message:
        // res.status(200).json({ message: 'Property deleted successfully' });

    } catch (err) {
        console.error(`[Properties Service DELETE /properties/:id] Server Delete Error (ID: ${id}):`, err);
        res.status(500).json({ error: 'An unexpected error occurred' });
    }
});


// --- EXPORT THE APP INSTANCE ---
// This makes the 'app' object (your Express application) available
// when this module is required by other files (like your test file).
module.exports = app;


// --- CONDITIONAL SERVER START ---
// This code will ONLY run if server.js is the main file being executed directly
// (e.g., when you run `node server.js` from the terminal).
// It will NOT run when server.js is imported using `require('./server')` in tests.
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Properties Service listening at http://localhost:${port}`);
    });
}