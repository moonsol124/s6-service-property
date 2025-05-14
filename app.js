// server.js
require('dotenv').config();
const express = require('express');
const supabase = require('./supabaseClient'); // Import the Supabase client

const app = express(); // <-- Define app here

const port = process.env.PORT || 3004;

app.use(express.json());

// --- Basic Route ---
app.get('/', (req, res) => {
    res.send('Properties CRUD API with Supabase');
});

// --- CRUD Routes ---

// CREATE: Add a new property
app.post('/properties', async (req, res) => {
    const propertyData = req.body;

    if (!propertyData.name) {
        return res.status(400).json({ error: 'Property name is required' });
    }

    try {
        const { data, error } = await supabase
            .from('properties')
            .insert([propertyData])
            .select()
            .single();

        if (error) {
            console.error('[Properties Service POST /properties] Supabase Insert Error:', error);
             if (error.code === '23505') { // PostgreSQL unique violation error code
                 // Adjust message based on which column(s) are unique if needed
                 return res.status(409).json({ error: 'A property with this name or identifier already exists' });
             }
            return res.status(500).json({ error: error.message || 'Failed to create property' });
        }

        res.status(201).json(data);
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
            .order('name', { ascending: false });

        if (error) {
            console.error('[Properties Service GET /properties] Supabase Select All Error:', error);
            return res.status(500).json({ error: error.message || 'Failed to fetch properties' });
        }

        res.status(200).json(data || []);
    } catch (err) {
        console.error('[Properties Service GET /properties] Server Select All Error:', err);
        res.status(500).json({ error: 'An unexpected error occurred' });
    }
});

// READ: Get a single property by ID
app.get('/properties/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const { data, error } = await supabase
            .from('properties')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error(`[Properties Service GET /properties/:id] Supabase Select One Error (ID: ${id}):`, error);
            if (error.code === 'PGRST116') {
                 return res.status(404).json({ error: 'Property not found' });
            }
            return res.status(500).json({ error: error.message || 'Failed to fetch property' });
        }

        if (!data) {
             return res.status(404).json({ error: 'Property not found' });
        }

        res.status(200).json(data);
    } catch (err) {
        console.error(`[Properties Service GET /properties/:id] Server Select One Error (ID: ${id}):`, err);
        res.status(500).json({ error: 'An unexpected error occurred' });
    }
});

// UPDATE: Modify an existing property by ID
app.put('/properties/:id', async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    delete updates.id;

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No update data provided' });
    }

    try {
        const { data, error } = await supabase
            .from('properties')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error(`[Properties Service PUT /properties/:id] Supabase Update Error (ID: ${id}):`, error);
             if (error.code === 'PGRST116') {
                 // --- FIX: Make error message consistent with test expectation ---
                 return res.status(404).json({ error: 'Property not found or no changes applied' }); // Changed 'made' to 'applied'
             }
             if (error.code === '23505') { // PostgreSQL unique violation error code
                 return res.status(409).json({ error: 'A property with this name or identifier already exists' });
             }
            return res.status(500).json({ error: error.message || 'Failed to update property' });
        }

         if (!data) {
             return res.status(404).json({ error: 'Property not found or no changes applied' });
        }

        res.status(200).json(data);
    } catch (err) {
        console.error(`[Properties Service PUT /properties/:id] Server Update Error (ID: ${id}):`, err);
        res.status(500).json({ error: 'An unexpected error occurred' });
    }
});

// DELETE: Remove a property by ID
app.delete('/properties/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // --- FIX: Use .select('id') and check data.length for reliable 404 check ---
        const { data, error } = await supabase
            .from('properties')
            .delete()
            .eq('id', id)
            .select('id'); // Select ID to check if any row was deleted

        if (error) {
            console.error(`[Properties Service DELETE /properties/:id] Supabase Delete Error (ID: ${id}):`, error);
            return res.status(500).json({ error: error.message || 'Failed to delete property' });
        }

        // Check if any data was returned (meaning a row was deleted)
        if (!data || data.length === 0) {
             console.warn(`[Properties Service DELETE /properties/:id] No rows deleted for ID: ${id}. Not found?`);
             return res.status(404).json({ error: 'Property not found' });
        }

        // If we get here, data has elements, meaning deletion was successful
        console.log(`[Properties Service DELETE /properties/:id] Property ${id} deleted successfully.`);
        res.status(204).send();

    } catch (err) {
        console.error(`[Properties Service DELETE /properties/:id] Server Delete Error (ID: ${id}):`, err);
        res.status(500).json({ error: 'An unexpected error occurred' });
    }
});


// --- EXPORT THE APP INSTANCE ---
module.exports = app;


// --- CONDITIONAL SERVER START ---
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Properties Service listening at http://localhost:${port}`);
    });
}