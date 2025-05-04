// supabaseClient.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config(); // Load environment variables from .env file

const supabaseUrl = 'https://zyuusockfwqsvnftfuyj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5dXVzb2NrZndxc3ZuZnRmdXlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU2NzUxMTUsImV4cCI6MjA2MTI1MTExNX0.h6DRgXA3gFWKO3r0uCEFlMRD6N1BaDtfzzuAJsj2t2I';

if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase URL and Service Key are required. Check your .env file.");
}

// Create a single supabase client for interacting with your database
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;