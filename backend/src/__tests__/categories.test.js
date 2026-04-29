import 'dotenv/config';
import request from 'supertest';
import app from '../app.js';
import pool from '../config/database.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE = '/api/categories';
const AUTH_BASE = '/api/auth';

// ---------------------------------------------------------------------------
// Shared state — populated in beforeAll
// ---------------------------------------------------------------------------

let token;
let userId;
let otherToken;

// ---------------------------------------------------------------------------
// Database reset + user bootstrap
// ---------------------------------------------------------------------------

beforeAll(async () => {
  // Clean all data and reset auto-increment sequences
  await pool.query('TRUNCATE todos, categories, users RESTART IDENTITY CASCADE');

  // Primary test user
  const signUp = await request(app)
    .post(`${AUTH_BASE}/sign-up`)
    .send({ email: 'cat_test@example.com', password: 'password123' });

  token = signUp.body.data.token;
  userId = signUp.body.data.user.id;

  // Secondary user — used to verify ownership enforcement (403)
  const otherSignUp = await request(app)
    .post(`${AUTH_BASE}/sign-up`)
    .send({ email: 'cat_other@example.com', password: 'password123' });

  otherToken = otherSignUp.body.data.token;
});

afterAll(async () => {
  await pool.end();
});

// ---------------------------------------------------------------------------
// GET /api/categories
// ---------------------------------------------------------------------------

describe('GET /api/categories', () => {
  test('200 – authenticated user receives an empty array initially', async () => {
    const res = await request(app)
      .get(BASE)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  test('401 – request without token is rejected', async () => {
    const res = await request(app).get(BASE);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.type).toBe('AUTH_ERROR');
  });
});

// ---------------------------------------------------------------------------
// POST /api/categories
// ---------------------------------------------------------------------------

describe('POST /api/categories', () => {
  test('201 – successfully creates a category', async () => {
    const res = await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '업무' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ name: '업무' });
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('created_at');
  });

  test('400 – empty string name is rejected', async () => {
    const res = await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.type).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBe('카테고리 이름은 필수입니다.');
  });

  test('400 – name longer than 20 characters is rejected', async () => {
    const res = await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'a'.repeat(21) });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.type).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBe('카테고리 이름은 20자 이하이어야 합니다.');
  });

  test('409 – duplicate category name for the same user is rejected', async () => {
    // '업무' was already created in the first test of this suite
    const res = await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '업무' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.type).toBe('CONFLICT_ERROR');
    expect(res.body.error.message).toBe('이미 존재하는 카테고리 이름입니다.');
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/categories/:id
// ---------------------------------------------------------------------------

describe('PATCH /api/categories/:id', () => {
  let categoryId;

  beforeAll(async () => {
    // Create a fresh category for update tests
    const res = await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '개인' });

    categoryId = res.body.data.id;
  });

  test('200 – successfully updates the category name', async () => {
    const res = await request(app)
      .patch(`${BASE}/${categoryId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '취미' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ id: categoryId, name: '취미' });
  });

  test('404 – non-existent category id returns not found', async () => {
    const res = await request(app)
      .patch(`${BASE}/999999`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '없는카테고리' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.type).toBe('NOT_FOUND_ERROR');
  });

  test('403 – updating another user\'s category is forbidden', async () => {
    // categoryId belongs to the primary user; otherToken belongs to a different user
    const res = await request(app)
      .patch(`${BASE}/${categoryId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: '침범' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.type).toBe('FORBIDDEN_ERROR');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/categories/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/categories/:id', () => {
  let categoryId;

  beforeAll(async () => {
    // Create a fresh category to be deleted
    const res = await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '삭제대상' });

    categoryId = res.body.data.id;
  });

  test('200 – successfully deletes the category and sets todo category_id to NULL', async () => {
    // Insert a todo linked to this category directly via pool to verify ON DELETE SET NULL
    const todoRes = await pool.query(
      `INSERT INTO todos (user_id, category_id, title)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [userId, categoryId, '테스트 할일'],
    );
    const todoId = todoRes.rows[0].id;

    // Delete the category
    const deleteRes = await request(app)
      .delete(`${BASE}/${categoryId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    // Verify the todo's category_id was set to NULL by the DB constraint
    const { rows } = await pool.query(
      'SELECT category_id FROM todos WHERE id = $1',
      [todoId],
    );
    expect(rows[0].category_id).toBeNull();
  });

  test('404 – deleting a non-existent category returns not found', async () => {
    const res = await request(app)
      .delete(`${BASE}/999999`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.type).toBe('NOT_FOUND_ERROR');
  });

  test('403 – deleting another user\'s category is forbidden', async () => {
    // Create a category owned by the primary user to try to delete with otherToken
    const createRes = await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '침범금지' });

    const targetId = createRes.body.data.id;

    const res = await request(app)
      .delete(`${BASE}/${targetId}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.type).toBe('FORBIDDEN_ERROR');
  });
});
