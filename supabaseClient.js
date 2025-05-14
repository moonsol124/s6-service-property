// supabaseClient.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config(); // Load environment variables from .env file

// Prioritize test environment variables if they are set
const supabaseUrl = process.env.SUPABASE_TEST_URL;
const supabaseKey = process.env.SUPABASE_TEST_KEY; // Note: Using KEY, not ANON_KEY

// IMPORTANT: Keep this check to ensure credentials are provided in either env
if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase URL and Key are required (either test or standard). Check your .env file or CI secrets.");
    throw new Error("Supabase configuration missing.");
}

// Create a single supabase client for interacting with your database
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;