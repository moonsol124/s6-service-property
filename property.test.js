// property.test.js
const request = require('supertest');
const app = require('./server'); // Import your Express app instance from server.js
const supabase = require('./supabaseClient'); // Import the Supabase client configured with env vars

// Use a specific port for tests to avoid conflicts
const TEST_PORT = process.env.TEST_PROPERTY_SERVICE_PORT || 3003; // Use a different port
let server; // To hold the server instance

// --- Jest Setup and Teardown ---

beforeAll((done) => {
    // Start the server before running tests
    server = app.listen(TEST_PORT, () => {
        console.log(`Test Property Service listening on port ${TEST_PORT}`);
        done();
    });
});

beforeEach(async () => {
    // !!! CRITICAL: Clear the properties table before each test !!!
    // !!! THIS ASSUMES YOU ARE USING A DEDICATED TEST DATABASE !!!
    console.log('Cleaning properties table...');
    const { error } = await supabase.from('properties').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Safe delete
    if (error) {
        console.error('Error cleaning properties table:', error);
         throw new Error('Failed to clean database before test: ' + error.message);
    }
     console.log('Properties table cleaned.');
});

afterAll((done) => {
    // Close the server after all tests are done
    server.close(done);
    console.log('Closed test server.');
});

// Optional: Mock console.log to reduce test output clutter
beforeEach(() => {
  // Temporarily disable logging from the service during tests
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  // Restore original console behavior
  jest.restoreAllMocks();
});


// --- Test Cases ---

describe('POST /properties', () => {
    it('should create a new property successfully', async () => {
        const newProperty = {
            name: 'Test Property',
            address: '123 Test St',
            price: 100000,
            // Add other required fields based on your schema
        };

        const res = await request(app)
            .post('/properties')
            .send(newProperty);

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('id'); // Check if an ID was assigned (UUID or serial)
        expect(res.body).toHaveProperty('name', newProperty.name);
        expect(res.body).toHaveProperty('address', newProperty.address);
        expect(res.body).toHaveProperty('price', newProperty.price);
        // Add expectations for other fields you expect back

        // Verify the property exists in the database
        const { data, error } = await supabase.from('properties').select('id, name').eq('id', res.body.id).single();
        expect(error).toBeNull();
        expect(data).toBeDefined();
        expect(data.name).toBe(newProperty.name);
    });

    it('should return 400 if required fields are missing (e.g., name)', async () => {
        const res = await request(app)
            .post('/properties')
            .send({ address: 'Missing Name Street' }); // Missing name

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Property name is required');
    });

    it('should return 409 if a property with the same unique field already exists', async () => {
        // Assume 'name' or another field has a unique constraint
        const property1 = { name: 'Unique Property Name', address: 'Addr 1' };
        const property2 = { name: 'Unique Property Name', address: 'Addr 2' }; // Same name as property1

        await request(app).post('/properties').send(property1).expect(201);

        const res = await request(app).post('/properties').send(property2);

        expect(res.status).toBe(409); // Expect conflict error
        expect(res.body).toHaveProperty('error', 'A property with this name or identifier already exists');
    });

     // Add more POST tests for validation, etc.
});

describe('GET /properties', () => {
    it('should return an empty array if no properties exist', async () => {
        const res = await request(app).get('/properties');

        expect(res.status).toBe(200);
        expect(res.body).toBeInstanceOf(Array);
        expect(res.body).toHaveLength(0);
    });

    it('should return a list of properties sorted by name descending', async () => {
        // Insert properties
        await request(app).post('/properties').send({ name: 'Property A', address: 'a', price: 1 });
        await request(app).post('/properties').send({ name: 'Property C', address: 'c', price: 3 });
        await request(app).post('/properties').send({ name: 'Property B', address: 'b', price: 2 });

        const res = await request(app).get('/properties');

        expect(res.status).toBe(200);
        expect(res.body).toBeInstanceOf(Array);
        expect(res.body.length).toBeGreaterThanOrEqual(3); // Should be exactly 3 if cleanup is perfect

        // Check the sorting (Descending by name)
        expect(res.body.map(p => p.name)).toEqual(['Property C', 'Property B', 'Property A']);

        // Check structure of items
        expect(res.body[0]).toHaveProperty('id');
        expect(res.body[0]).toHaveProperty('name');
        expect(res.body[0]).toHaveProperty('address');
        expect(res.body[0]).toHaveProperty('price');
    });

     // Add more GET ALL tests for filtering, pagination, etc. if implemented
});

describe('GET /properties/:id', () => {
    let createdProperty;

     beforeEach(async () => {
         // Create a property to fetch
         const newProperty = { name: 'Fetch Test', address: 'fetch addr', price: 500 };
         const res = await request(app).post('/properties').send(newProperty);
         createdProperty = res.body; // Store the created property data
    });

    it('should return a property by ID', async () => {
        const res = await request(app).get(`/properties/${createdProperty.id}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('id', createdProperty.id);
        expect(res.body).toHaveProperty('name', createdProperty.name);
        expect(res.body).toHaveProperty('address', createdProperty.address);
        expect(res.body).toHaveProperty('price', createdProperty.price);
        // Check other fields
    });

    it('should return 404 if property ID is not found', async () => {
        const nonExistentId = '123e4567-e89b-12d3-a456-426614174000'; // Example valid UUID format

        const res = await request(app).get(`/properties/${nonExistentId}`);

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error', 'Property not found');
    });

     it('should return appropriate status for invalid ID format', async () => {
        const invalidId = 'not-a-uuid'; // Malformed ID

        const res = await request(app).get(`/properties/${invalidId}`);

        // Expect either 400 or 500 depending on how Supabase/PostgreSQL handles it
         expect(res.status).toBeGreaterThanOrEqual(400);
     });
});

describe('PUT /properties/:id', () => {
    let createdProperty;

     beforeEach(async () => {
         // Create a property to update
         const newProperty = { name: 'Update Test', address: 'update addr', price: 600 };
         const res = await request(app).post('/properties').send(newProperty);
         createdProperty = res.body; // Store the created property data
    });

    it('should update a property successfully', async () => {
        const updates = {
            name: 'Updated Property Name',
            price: 700
            // Only send fields you intend to change
        };

        const res = await request(app)
            .put(`/properties/${createdProperty.id}`)
            .send(updates);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('id', createdProperty.id);
        expect(res.body).toHaveProperty('name', updates.name);
        expect(res.body).toHaveProperty('price', updates.price);
        expect(res.body).toHaveProperty('address', createdProperty.address); // Ensure unchanged fields are still there and correct

        // Verify the update in the database
         const { data, error } = await supabase.from('properties').select('id, name, price').eq('id', createdProperty.id).single();
         expect(error).toBeNull();
         expect(data).toBeDefined();
         expect(data.name).toBe(updates.name);
         expect(data.price).toBe(updates.price);
    });

    it('should return 404 if property ID is not found for update', async () => {
        const nonExistentId = '123e4567-e89b-12d3-a456-426614174001'; // Example valid UUID format
        const updates = { name: 'Should Not Update' };

        const res = await request(app)
            .put(`/properties/${nonExistentId}`)
            .send(updates);

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error', 'Property not found or no changes applied'); // Use the specific error message from your code
    });

    it('should return 400 if no update data is provided', async () => {
         const res = await request(app)
             .put(`/properties/${createdProperty.id}`)
             .send({}); // Empty body

         expect(res.status).toBe(400);
         expect(res.body).toHaveProperty('error', 'No update data provided');
    });

     it('should return 409 if updated name conflicts with existing property', async () => {
        // Create a second property with a name that will conflict
        await request(app).post('/properties').send({ name: 'Another Unique Name', address: 'other addr', price: 800 });

        const updates = { name: 'Another Unique Name' }; // Conflict name

        const res = await request(app)
            .put(`/properties/${createdProperty.id}`)
            .send(updates);

        expect(res.status).toBe(409); // Expect conflict error
        expect(res.body).toHaveProperty('error', 'A property with this name or identifier already exists');
    });

     // Add more PUT tests for specific field validations, etc.
});

describe('DELETE /properties/:id', () => {
     let createdProperty;

     beforeEach(async () => {
         // Create a property to delete
         const newProperty = { name: 'Delete Test', address: 'delete addr', price: 900 };
         const res = await request(app).post('/properties').send(newProperty);
         createdProperty = res.body; // Store the created property data
    });

    it('should delete a property successfully', async () => {
        const res = await request(app).delete(`/properties/${createdProperty.id}`);

        expect(res.status).toBe(204); // 204 No Content on success

        // Verify the property is deleted from the database
        const { data, error } = await supabase.from('properties').select('id').eq('id', createdProperty.id);
        // Supabase select().eq().single() on a non-existent row returns error.code 'PGRST116'
        // or select().eq() returns empty array data: []
        // We can check for an empty array or the specific error code. Checking data length is simpler.
        expect(error).toBeNull(); // No error expected if data is just empty array
        expect(data).toHaveLength(0); // Should not find the property
    });

    it('should return 404 if property ID is not found for deletion', async () => {
        const nonExistentId = '123e4567-e89b-12d3-a456-426614174002'; // Example valid UUID format

        const res = await request(app).delete(`/properties/${nonExistentId}`);

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error', 'Property not found'); // Use specific error message
    });

     it('should return appropriate status for invalid ID format on delete', async () => {
        const invalidId = 'another-bad-uuid-for-delete'; // Malformed ID

        const res = await request(app).delete(`/properties/${invalidId}`);

        // Expect 400 or 500 depending on backend/DB handling
         expect(res.status).toBeGreaterThanOrEqual(400);
     });
});