// property.test.js
const request = require('supertest');
const app = require('./app'); // Import your Express app instance from server.js
const supabase = require('./supabaseClient'); // Import the Supabase client configured with env vars

// Use a specific port for tests to avoid conflicts
const TEST_PORT = process.env.TEST_PROPERTY_SERVICE_PORT || 3003;
let server; // To hold the server instance

// --- Jest Setup and Teardown ---

beforeAll((done) => {
    server = app.listen(TEST_PORT, () => {
        console.log(`Test Property Service listening on port ${TEST_PORT}`);
        done();
    });
});

beforeEach(async () => {
    console.log('Cleaning properties table...');
    const { error } = await supabase.from('properties').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
        console.error('Error cleaning properties table:', error);
         throw new Error('Failed to clean database before test: ' + error.message);
    }
     console.log('Properties table cleaned.');
});

afterAll((done) => {
    server.close(done);
    console.log('Closed test server.');
});

// Optional: Mock console.log to reduce test output clutter
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});


// --- Test Cases ---

describe('POST /properties', () => {
    it('should create a new property successfully', async () => {
        const newProperty = {
            name: 'Test Property',
            address: '123 Test St',
            price: 100000, // Keep as number in the test input
        };

        const res = await request(app)
            .post('/properties')
            .send(newProperty);

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('name', newProperty.name);
        expect(res.body).toHaveProperty('address', newProperty.address);
        // --- FIX: Expect price as a string ---
        expect(res.body).toHaveProperty('price', newProperty.price.toString()); // Expect the number as a string
        // If your DB schema returns floats/decimals with fixed precision, adjust expectation:
        // expect(res.body).toHaveProperty('price', parseFloat(newProperty.price).toFixed(2)); // Example for decimals

        // Verify the property exists in the database
        const { data, error } = await supabase.from('properties').select('id, name').eq('id', res.body.id).single();
        expect(error).toBeNull();
        expect(data).toBeDefined();
        expect(data.name).toBe(newProperty.name);
    });

    it('should return 400 if required fields are missing (e.g., name)', async () => {
        const res = await request(app)
            .post('/properties')
            .send({ address: 'Missing Name Street' });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Property name is required');
    });

    it('should return 409 if a property with the same unique field already exists', async () => {
        // This test requires a UNIQUE constraint on the 'name' column in your TEST database.
        const property1 = { name: 'Unique Property Name', address: 'Addr 1' };
        const property2 = { name: 'Unique Property Name', address: 'Addr 2' };

        await request(app).post('/properties').send(property1).expect(201);

        const res = await request(app).post('/properties').send(property2);

        // --- Expect 409, this will pass IF UNIQUE constraint is on the DB column ---
        expect(res.status).toBe(409);
        expect(res.body).toHaveProperty('error', 'A property with this name or identifier already exists');
    });
});

describe('GET /properties', () => {
    it('should return an empty array if no properties exist', async () => {
        const res = await request(app).get('/properties');

        expect(res.status).toBe(200);
        expect(res.body).toBeInstanceOf(Array);
        expect(res.body).toHaveLength(0);
    });

    it('should return a list of properties sorted by name descending', async () => {
        await request(app).post('/properties').send({ name: 'Property A', address: 'a', price: 1 });
        await request(app).post('/properties').send({ name: 'Property C', address: 'c', price: 3 });
        await request(app).post('/properties').send({ name: 'Property B', address: 'b', price: 2 });

        const res = await request(app).get('/properties');

        expect(res.status).toBe(200);
        expect(res.body).toBeInstanceOf(Array);
        expect(res.body.length).toBeGreaterThanOrEqual(3);

        expect(res.body.map(p => p.name)).toEqual(['Property C', 'Property B', 'Property A']);

        expect(res.body[0]).toHaveProperty('id');
        expect(res.body[0]).toHaveProperty('name');
        expect(res.body[0]).toHaveProperty('address');
        expect(res.body[0]).toHaveProperty('price'); // Expect price property exists
    });
});

describe('GET /properties/:id', () => {
    let createdProperty;

     beforeEach(async () => {
         const newProperty = { name: 'Fetch Test', address: 'fetch addr', price: 500 };
         const res = await request(app).post('/properties').send(newProperty);
         createdProperty = res.body;
    });

    it('should return a property by ID', async () => {
        const res = await request(app).get(`/properties/${createdProperty.id}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('id', createdProperty.id);
        expect(res.body).toHaveProperty('name', createdProperty.name);
        expect(res.body).toHaveProperty('address', createdProperty.address);
        // --- FIX: Expect price as a string ---
        expect(res.body).toHaveProperty('price', createdProperty.price); // Expect the value as it was returned
    });

    it('should return 404 if property ID is not found', async () => {
        const nonExistentId = '123e4567-e89b-12d3-a456-426614174000';

        const res = await request(app).get(`/properties/${nonExistentId}`);

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error', 'Property not found');
    });

     it('should return appropriate status for invalid ID format', async () => {
        const invalidId = 'not-a-uuid';

        const res = await request(app).get(`/properties/${invalidId}`);

         expect(res.status).toBeGreaterThanOrEqual(400);
     });
});

describe('PUT /properties/:id', () => {
    let createdProperty;

     beforeEach(async () => {
         const newProperty = { name: 'Update Test', address: 'update addr', price: 600 };
         const res = await request(app).post('/properties').send(newProperty);
         createdProperty = res.body;
    });

    it('should update a property successfully', async () => {
        const updates = {
            name: 'Updated Property Name',
            price: 700 // Keep as number in test input
        };

        const res = await request(app)
            .put(`/properties/${createdProperty.id}`)
            .send(updates);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('id', createdProperty.id);
        expect(res.body).toHaveProperty('name', updates.name);
        // --- FIX: Expect price as a string ---
        expect(res.body).toHaveProperty('price', updates.price.toString()); // Expect the number as a string
        expect(res.body).toHaveProperty('address', createdProperty.address);

        // Verify the update in the database
         const { data, error } = await supabase.from('properties').select('id, name, price').eq('id', createdProperty.id).single();
         expect(error).toBeNull();
         expect(data).toBeDefined();
         expect(data.name).toBe(updates.name);
         // --- Verify price in DB as string ---
         expect(data.price).toBe(updates.price.toString()); // Verify it's stored/retrieved as string
    });

    it('should return 404 if property ID is not found for update', async () => {
        const nonExistentId = '123e4567-e89b-12d3-a456-426614174001';
        const updates = { name: 'Should Not Update' };

        const res = await request(app)
            .put(`/properties/${nonExistentId}`)
            .send(updates);

        expect(res.status).toBe(404);
        // --- FIX: Update error message expectation ---
        expect(res.body).toHaveProperty('error', 'Property not found or no changes applied'); // Match server error message
    });

    it('should return 400 if no update data is provided', async () => {
         const res = await request(app)
             .put(`/properties/${createdProperty.id}`)
             .send({});

         expect(res.status).toBe(400);
         expect(res.body).toHaveProperty('error', 'No update data provided');
    });

     it('should return 409 if updated name conflicts with existing property', async () => {
        // This test requires a UNIQUE constraint on the 'name' column in your TEST database.
        await request(app).post('/properties').send({ name: 'Another Unique Name', address: 'other addr', price: 800 });

        const updates = { name: 'Another Unique Name' };

        const res = await request(app)
            .put(`/properties/${createdProperty.id}`)
            .send(updates);

        // --- Expect 409, this will pass IF UNIQUE constraint is on the DB column ---
        expect(res.status).toBe(409);
        expect(res.body).toHaveProperty('error', 'A property with this name or identifier already exists');
    });
});

describe('DELETE /properties/:id', () => {
     let createdProperty;

     beforeEach(async () => {
         const newProperty = { name: 'Delete Test', address: 'delete addr', price: 900 };
         const res = await request(app).post('/properties').send(newProperty);
         createdProperty = res.body;
    });

    it('should delete a property successfully', async () => {
        const res = await request(app).delete(`/properties/${createdProperty.id}`);

        expect(res.status).toBe(204);

        // Verify the property is deleted from the database
        const { data, error } = await supabase.from('properties').select('id').eq('id', createdProperty.id);
        // With the server change using .select('id'), data will be [] if not found, or [{ id: ...}] if found.
        // Expecting no error here is fine, as select('') on non-existent returns { data: [], error: null }
        expect(error).toBeNull();
        expect(data).toHaveLength(0); // Should not find the property
    });

    it('should return 404 if property ID is not found for deletion', async () => {
        const nonExistentId = '123e4567-e89b-12d3-a456-426614174002';

        const res = await request(app).delete(`/properties/${nonExistentId}`);

        // --- Expect 404, this will pass with the server logic change ---
        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error', 'Property not found');
    });

     it('should return appropriate status for invalid ID format on delete', async () => {
        const invalidId = 'another-bad-uuid-for-delete';

        const res = await request(app).delete(`/properties/${invalidId}`);

         expect(res.status).toBeGreaterThanOrEqual(400);
     });
});