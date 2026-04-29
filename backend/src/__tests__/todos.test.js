import 'dotenv/config';
import request from 'supertest';
import app from '../app.js';
import pool from '../config/database.js';
import { calculateStatus } from '../services/todoService.js';

// ---------------------------------------------------------------------------
// Shared state set up in beforeAll
// ---------------------------------------------------------------------------

let token;
let categoryId;

// A second user and their token — used to test cross-user authorization
let otherToken;

const BASE = '/api/todos';

// ---------------------------------------------------------------------------
// Database reset and seed
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await pool.query('TRUNCATE todos, categories, users RESTART IDENTITY CASCADE');

  // Primary test user
  const authRes = await request(app).post('/api/auth/sign-up').send({
    email: 'todo_test@example.com',
    password: 'password123',
  });
  token = authRes.body.data.token;

  // Category owned by the primary test user
  const catRes = await request(app)
    .post('/api/categories')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test Category' });
  categoryId = catRes.body.data.id;

  // A second user to test ownership restrictions
  const otherRes = await request(app).post('/api/auth/sign-up').send({
    email: 'other_user@example.com',
    password: 'password123',
  });
  otherToken = otherRes.body.data.token;
});

afterAll(async () => {
  await pool.end();
});

// ---------------------------------------------------------------------------
// Unit tests for calculateStatus (pure function, no DB needed)
// ---------------------------------------------------------------------------

describe('calculateStatus (unit)', () => {
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];

  test('returns "completed" when is_completed is true', () => {
    expect(calculateStatus({ is_completed: true, due_date: yesterday })).toBe('completed');
  });

  test('returns "overdue" when due_date is in the past and not completed', () => {
    expect(calculateStatus({ is_completed: false, due_date: yesterday })).toBe('overdue');
  });

  test('returns "active" when due_date is in the future and not completed', () => {
    expect(calculateStatus({ is_completed: false, due_date: tomorrow })).toBe('active');
  });

  test('returns "active" when there is no due_date and not completed', () => {
    expect(calculateStatus({ is_completed: false, due_date: null })).toBe('active');
  });

  test('handles Date objects for due_date', () => {
    const pastDate = new Date(Date.now() - 86_400_000);
    expect(calculateStatus({ is_completed: false, due_date: pastDate })).toBe('overdue');
  });
});

// ---------------------------------------------------------------------------
// GET /api/todos
// ---------------------------------------------------------------------------

describe('GET /api/todos', () => {
  test('200 – returns empty array when no todos exist', async () => {
    const res = await request(app)
      .get(BASE)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  test('401 – missing Authorization header is rejected', async () => {
    const res = await request(app).get(BASE);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.type).toBe('AUTH_ERROR');
  });
});

// ---------------------------------------------------------------------------
// POST /api/todos
// ---------------------------------------------------------------------------

describe('POST /api/todos', () => {
  test('201 – creates a todo with required title only', async () => {
    const res = await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'My first todo' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      title: 'My first todo',
      status: 'active',
    });
    expect(res.body.data).toHaveProperty('id');
  });

  test('400 – title is missing', async () => {
    const res = await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'No title here' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.type).toBe('VALIDATION_ERROR');
  });

  test('400 – title is empty string', async () => {
    const res = await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.type).toBe('VALIDATION_ERROR');
  });

  test('400 – title exceeds 50 characters', async () => {
    const res = await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'A'.repeat(51) });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.type).toBe('VALIDATION_ERROR');
  });

  test('403 – category belonging to another user is rejected', async () => {
    // otherToken's category
    const catRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: 'Other Category' });
    const otherCategoryId = catRes.body.data.id;

    const res = await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Forbidden category', category_id: otherCategoryId });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.type).toBe('FORBIDDEN_ERROR');
  });

  test('201 – creates a todo linked to a valid category', async () => {
    const res = await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Categorized todo', category_id: categoryId });

    expect(res.status).toBe(201);
    expect(res.body.data.category_id).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// GET /api/todos with status and category filters
// ---------------------------------------------------------------------------

describe('GET /api/todos – filters', () => {
  // Seed todos once for the entire filter block
  beforeAll(async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];

    // Overdue todo
    await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Overdue todo', due_date: yesterday });

    // Completed todo
    const createRes = await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Completed todo' });
    await request(app)
      .patch(`${BASE}/${createRes.body.data.id}/complete`)
      .set('Authorization', `Bearer ${token}`);
  });

  test('?status=active – returns only active todos', async () => {
    const res = await request(app)
      .get(`${BASE}?status=active`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((t) => t.status === 'active')).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('?status=overdue – returns only overdue todos', async () => {
    const res = await request(app)
      .get(`${BASE}?status=overdue`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((t) => t.status === 'overdue')).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('?status=completed – returns only completed todos', async () => {
    const res = await request(app)
      .get(`${BASE}?status=completed`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((t) => t.status === 'completed')).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('?category_id=N – returns only todos in the given category', async () => {
    const res = await request(app)
      .get(`${BASE}?category_id=${categoryId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Every returned todo must belong to the filtered category
    expect(
      res.body.data.every((t) => Number(t.category_id) === Number(categoryId)),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/todos/:id
// ---------------------------------------------------------------------------

describe('PATCH /api/todos/:id', () => {
  let todoId;

  beforeAll(async () => {
    const res = await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Todo to update' });
    todoId = res.body.data.id;
  });

  test('200 – updates title successfully', async () => {
    const res = await request(app)
      .patch(`${BASE}/${todoId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated title' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Updated title');
  });

  test('404 – non-existent todo ID', async () => {
    const res = await request(app)
      .patch(`${BASE}/999999`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Ghost update' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.type).toBe('NOT_FOUND_ERROR');
  });

  test('403 – another user cannot update the todo', async () => {
    const res = await request(app)
      .patch(`${BASE}/${todoId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ title: 'Stolen update' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.type).toBe('FORBIDDEN_ERROR');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/todos/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/todos/:id', () => {
  let todoId;

  beforeAll(async () => {
    const res = await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Todo to delete' });
    todoId = res.body.data.id;
  });

  test('200 – deletes the todo successfully', async () => {
    const res = await request(app)
      .delete(`${BASE}/${todoId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).not.toHaveProperty('data');
  });

  test('404 – non-existent todo ID', async () => {
    const res = await request(app)
      .delete(`${BASE}/999999`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.type).toBe('NOT_FOUND_ERROR');
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/todos/:id/complete and /incomplete
// ---------------------------------------------------------------------------

describe('PATCH /api/todos/:id/complete and /incomplete', () => {
  let todoId;

  beforeAll(async () => {
    const res = await request(app)
      .post(BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Todo for completion toggle' });
    todoId = res.body.data.id;
  });

  test('200 – marks todo as completed', async () => {
    const res = await request(app)
      .patch(`${BASE}/${todoId}/complete`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.is_completed).toBe(true);
  });

  test('200 – marks todo as incomplete and recalculates status', async () => {
    const res = await request(app)
      .patch(`${BASE}/${todoId}/incomplete`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.is_completed).toBe(false);
    // Status should be 'active' (no due_date set)
    expect(res.body.data.status).toBe('active');
  });

  test('complete – 404 for non-existent todo', async () => {
    const res = await request(app)
      .patch(`${BASE}/999999/complete`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.type).toBe('NOT_FOUND_ERROR');
  });

  test('incomplete – 404 for non-existent todo', async () => {
    const res = await request(app)
      .patch(`${BASE}/999999/incomplete`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.type).toBe('NOT_FOUND_ERROR');
  });

  test('complete – 403 when another user tries to complete the todo', async () => {
    const res = await request(app)
      .patch(`${BASE}/${todoId}/complete`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.type).toBe('FORBIDDEN_ERROR');
  });

  test('incomplete – 403 when another user tries to mark incomplete', async () => {
    // First complete the todo as the owner
    await request(app)
      .patch(`${BASE}/${todoId}/complete`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .patch(`${BASE}/${todoId}/incomplete`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.type).toBe('FORBIDDEN_ERROR');
  });
});
