import 'dotenv/config';
import request from 'supertest';
import app from '../app.js';
import pool from '../config/database.js';

const AUTH_BASE = '/api/auth';
const TODO_BASE = '/api/todos';
const CAT_BASE = '/api/categories';

const uniqueEmail = (tag = '') => `scenario-${tag}-${Date.now()}@example.com`;
const PASSWORD = 'password123';

describe('User Scenario Tests', () => {
  beforeAll(async () => {
    // Clean start for scenario tests
    await pool.query('TRUNCATE todos, categories, users RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await pool.end();
  });

  // SC-01: 신규 사용자 회원가입 및 첫 할일 등록
  describe('SC-01: Signup and first todo registration', () => {
    const email = uniqueEmail('sc01');
    let token;

    test('should register and create first todo', async () => {
      // 1-7: Signup
      const signupRes = await request(app)
        .post(`${AUTH_BASE}/sign-up`)
        .send({ email, password: PASSWORD });

      expect(signupRes.status).toBe(201);
      expect(signupRes.body.data).toHaveProperty('token');
      token = signupRes.body.data.token;

      // 8-11: Create first todo
      const todoRes = await request(app)
        .post(TODO_BASE)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: '프로젝트 A 요구사항 분석 완료',
          due_date: '2026-05-05'
        });

      expect(todoRes.status).toBe(201);
      expect(todoRes.body.data.title).toBe('프로젝트 A 요구사항 분석 완료');
      expect(todoRes.body.data.is_completed).toBe(false);
    });

    test('should reject duplicate email (SC-01 Exception)', async () => {
      const res = await request(app)
        .post(`${AUTH_BASE}/sign-up`)
        .send({ email, password: PASSWORD });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  // SC-02: 카테고리 생성 후 할일 분류 등록
  describe('SC-02: Category creation and categorization', () => {
    const email = uniqueEmail('sc02');
    let token;
    let workCatId, personalCatId;

    beforeAll(async () => {
      const res = await request(app)
        .post(`${AUTH_BASE}/sign-up`)
        .send({ email, password: PASSWORD });
      token = res.body.data.token;
    });

    test('should create categories and categorized todos', async () => {
      // 1-4: Create "업무" category
      const cat1 = await request(app)
        .post(CAT_BASE)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '업무' });
      expect(cat1.status).toBe(201);
      workCatId = cat1.body.data.id;

      // 5-7: Create "개인" category
      const cat2 = await request(app)
        .post(CAT_BASE)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '개인' });
      expect(cat2.status).toBe(201);
      personalCatId = cat2.body.data.id;

      // 9-13: Create "코드 리뷰 완료" in "업무"
      const todo1 = await request(app)
        .post(TODO_BASE)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: '코드 리뷰 완료',
          category_id: workCatId,
          due_date: '2026-04-30'
        });
      expect(todo1.status).toBe(201);
      expect(todo1.body.data.category_id).toBe(workCatId);

      // 14-18: Create "짐 정리하기" in "개인"
      const todo2 = await request(app)
        .post(TODO_BASE)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: '짐 정리하기',
          category_id: personalCatId,
          due_date: '2026-05-10'
        });
      expect(todo2.status).toBe(201);
      expect(todo2.body.data.category_id).toBe(personalCatId);
    });

    test('should reject duplicate category name (SC-02 Exception)', async () => {
      const res = await request(app)
        .post(CAT_BASE)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '업무' });

      expect(res.status).toBe(409);
    });
  });

  // SC-03: 기한 초과 할일 확인 및 완료 처리
  describe('SC-03: Overdue check and completion', () => {
    const email = uniqueEmail('sc03');
    let token;
    let overdueTodoId;

    beforeAll(async () => {
      const res = await request(app)
        .post(`${AUTH_BASE}/sign-up`)
        .send({ email, password: PASSWORD });
      token = res.body.data.token;

      // Seed todos
      // "프로젝트 제안서 작성" (Past date)
      const t1 = await request(app)
        .post(TODO_BASE)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: '프로젝트 제안서 작성', due_date: '2020-01-01' });
      overdueTodoId = t1.body.data.id;

      // "회의 자료 준비" (Past date)
      await request(app)
        .post(TODO_BASE)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: '회의 자료 준비', due_date: '2020-01-02' });

      // "코드 리뷰" (Future date)
      await request(app)
        .post(TODO_BASE)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: '코드 리뷰', due_date: '2099-01-01' });
    });

    test('should identify overdue items and complete them', async () => {
      // Step 1-2: Check dashboard (list todos)
      const res = await request(app)
        .get(TODO_BASE)
        .set('Authorization', `Bearer ${token}`);
      
      const todos = res.body.data;
      const overdue = todos.filter(t => t.status === 'overdue');
      expect(overdue.length).toBe(2);

      // Step 3-4: Complete one overdue item
      const completeRes = await request(app)
        .patch(`${TODO_BASE}/${overdueTodoId}/complete`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.is_completed).toBe(true);
      expect(completeRes.body.data.status).toBe('completed');

      // Verify list again
      const res2 = await request(app)
        .get(TODO_BASE)
        .set('Authorization', `Bearer ${token}`);
      
      const overdueRemaining = res2.body.data.filter(t => t.status === 'overdue');
      expect(overdueRemaining.length).toBe(1);
    });
  });

  // SC-05: 카테고리 삭제 시 소속 할일 처리 확인
  describe('SC-05: Category deletion handling', () => {
    const email = uniqueEmail('sc05');
    let token;
    let catId, todoId;

    beforeAll(async () => {
      const authRes = await request(app)
        .post(`${AUTH_BASE}/sign-up`)
        .send({ email, password: PASSWORD });
      token = authRes.body.data.token;

      const catRes = await request(app)
        .post(CAT_BASE)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '병원/의료' });
      catId = catRes.body.data.id;

      const todoRes = await request(app)
        .post(TODO_BASE)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: '목 감기약 먹기', category_id: catId });
      todoId = todoRes.body.data.id;
    });

    test('should delete category and set todo category to null', async () => {
      // Delete category
      const delRes = await request(app)
        .delete(`${CAT_BASE}/${catId}`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(delRes.status).toBe(200);

      // Verify todo
      const todoRes = await request(app)
        .get(TODO_BASE)
        .set('Authorization', `Bearer ${token}`);
      
      const todo = todoRes.body.data.find(t => t.id === todoId);
      expect(todo.category_id).toBeNull();
    });
  });

  // SC-06: 로그인 실패 및 재시도
  describe('SC-06: Login failure and retry', () => {
    const email = uniqueEmail('sc06');

    beforeAll(async () => {
      await request(app)
        .post(`${AUTH_BASE}/sign-up`)
        .send({ email, password: PASSWORD });
    });

    test('should fail with wrong password and succeed with correct one', async () => {
      // Step 3-5: Wrong password
      const failRes = await request(app)
        .post(`${AUTH_BASE}/sign-in`)
        .send({ email, password: 'wrongpassword' });
      
      expect(failRes.status).toBe(401);
      expect(failRes.body.success).toBe(false);

      // Step 7-9: Correct password
      const successRes = await request(app)
        .post(`${AUTH_BASE}/sign-in`)
        .send({ email, password: PASSWORD });
      
      expect(successRes.status).toBe(200);
      expect(successRes.body.data).toHaveProperty('token');
    });
  });

  // SC-07: 회원 탈퇴
  describe('SC-07: Account withdrawal', () => {
    const email = uniqueEmail('sc07');
    let token;

    beforeAll(async () => {
      const res = await request(app)
        .post(`${AUTH_BASE}/sign-up`)
        .send({ email, password: PASSWORD });
      token = res.body.data.token;
    });

    test('should delete account and all data', async () => {
      // Withdrawal
      const delRes = await request(app)
        .delete(`${AUTH_BASE}/account`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(delRes.status).toBe(200);

      // Attempt login
      const loginRes = await request(app)
        .post(`${AUTH_BASE}/sign-in`)
        .send({ email, password: PASSWORD });
      
      expect(loginRes.status).toBe(401);
    });
  });
});
