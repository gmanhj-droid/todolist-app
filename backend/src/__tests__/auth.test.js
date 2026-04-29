import 'dotenv/config';
import request from 'supertest';
import app from '../app.js';
import pool from '../config/database.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE = '/api/auth';

/** Build a unique test email to avoid cross-test pollution. */
const uniqueEmail = (tag = '') =>
  `test-${tag}-${Date.now()}@example.com`;

const VALID_PASSWORD = 'password123';

// ---------------------------------------------------------------------------
// Database reset
// ---------------------------------------------------------------------------

beforeAll(async () => {
  // Wipe all user-related data and reset sequences before the suite runs.
  await pool.query(
    'TRUNCATE todos, categories, users RESTART IDENTITY CASCADE',
  );
});

afterAll(async () => {
  await pool.end();
});

// ---------------------------------------------------------------------------
// POST /api/auth/sign-up
// ---------------------------------------------------------------------------

describe('POST /api/auth/sign-up', () => {
  test('201 – successful registration returns token and user', async () => {
    const email = uniqueEmail('signup-ok');

    const res = await request(app)
      .post(`${BASE}/sign-up`)
      .send({ email, password: VALID_PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.user).toMatchObject({ email });
    expect(res.body.data.user).not.toHaveProperty('password');
  });

  test('409 – duplicate email is rejected', async () => {
    const email = uniqueEmail('signup-dup');

    // First registration succeeds
    await request(app)
      .post(`${BASE}/sign-up`)
      .send({ email, password: VALID_PASSWORD });

    // Second registration with same email must fail
    const res = await request(app)
      .post(`${BASE}/sign-up`)
      .send({ email, password: VALID_PASSWORD });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.type).toBe('CONFLICT_ERROR');
  });

  test('400 – password shorter than 8 characters is rejected', async () => {
    const res = await request(app)
      .post(`${BASE}/sign-up`)
      .send({ email: uniqueEmail('signup-shortpw'), password: '1234567' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.type).toBe('VALIDATION_ERROR');
  });

  test('400 – malformed email address is rejected', async () => {
    const res = await request(app)
      .post(`${BASE}/sign-up`)
      .send({ email: 'not-an-email', password: VALID_PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.type).toBe('VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/sign-in
// ---------------------------------------------------------------------------

describe('POST /api/auth/sign-in', () => {
  const email = uniqueEmail('signin');

  beforeAll(async () => {
    // Seed a known user for sign-in tests
    await request(app)
      .post(`${BASE}/sign-up`)
      .send({ email, password: VALID_PASSWORD });
  });

  test('200 – correct credentials return token and user', async () => {
    const res = await request(app)
      .post(`${BASE}/sign-in`)
      .send({ email, password: VALID_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.user).toMatchObject({ email });
    expect(res.body.data.user).not.toHaveProperty('password');
  });

  test('401 – unknown email returns generic auth error', async () => {
    const res = await request(app)
      .post(`${BASE}/sign-in`)
      .send({ email: 'nobody@example.com', password: VALID_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.type).toBe('AUTH_ERROR');
  });

  test('401 – wrong password returns generic auth error', async () => {
    const res = await request(app)
      .post(`${BASE}/sign-in`)
      .send({ email, password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.type).toBe('AUTH_ERROR');
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/sign-out
// ---------------------------------------------------------------------------

describe('POST /api/auth/sign-out', () => {
  let token;

  beforeAll(async () => {
    const email = uniqueEmail('signout');
    const res = await request(app)
      .post(`${BASE}/sign-up`)
      .send({ email, password: VALID_PASSWORD });
    token = res.body.data.token;
  });

  test('200 – valid token returns success', async () => {
    const res = await request(app)
      .post(`${BASE}/sign-out`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('401 – missing Authorization header is rejected', async () => {
    const res = await request(app).post(`${BASE}/sign-out`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.type).toBe('AUTH_ERROR');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/auth/account
// ---------------------------------------------------------------------------

describe('DELETE /api/auth/account', () => {
  let token;
  let email;

  beforeAll(async () => {
    email = uniqueEmail('delete-account');
    const res = await request(app)
      .post(`${BASE}/sign-up`)
      .send({ email, password: VALID_PASSWORD });
    token = res.body.data.token;
  });

  test('200 – authenticated user can delete their own account', async () => {
    const res = await request(app)
      .delete(`${BASE}/account`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('401 – sign-in fails after account deletion', async () => {
    const res = await request(app)
      .post(`${BASE}/sign-in`)
      .send({ email, password: VALID_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.type).toBe('AUTH_ERROR');
  });
});
