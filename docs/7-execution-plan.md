# 실행계획서 - TodoList

## 변경이력

| 버전 | 날짜 | 작성자 | 변경 내용 |
|---|---|---|---|
| 1.0.0 | 2026-04-28 | 최훈진 | 최초 작성 |

---

## 개요

| 항목 | 내용 |
|---|---|
| 프로젝트 | TodoList (Phase 1) |
| 일정 | 2026-04-28 ~ 2026-04-30 |
| 총 태스크 | DB 5개 / BE 19개 / FE 27개 = **51개** |
| 참조 문서 | [PRD](./2-prd.md), [프로젝트 구조 설계 원칙](./4-project-structure.md), [ERD](./6-erd.md) |

---

## 전체 의존성 다이어그램

```
[DB-01] 환경 설정
    ├── [DB-02] 스키마 적용
    │       ├── [DB-03] 시드 데이터
    │       └── [DB-05] 마이그레이션 전략
    └── [DB-04] DB 연결 모듈
              ↓
        [BE-01] 백엔드 초기 설정
              ↓
        [BE-02] 환경변수
              ↓
        [BE-03] DB 연결 + [BE-04] 공통 유틸
              ↓
        [BE-05] 미들웨어 → [BE-06] app.js
              ↓
    ┌─────────┼──────────┐
 [BE-09]  [BE-12]   [BE-15]
 인증 API  카테고리   할일 API
    ↓        ↓          ↓
 [BE-16]  [BE-17]   [BE-18]
 인증테스트 카테고리   할일테스트
              └──────────┘
                   ↓
              [BE-19] 전체 검증
                   ↓
           [FE-01~FE-06] 초기 설정
                   ↓
           [FE-07~FE-11] 공통 인프라
                   ↓
     ┌─────────────┼─────────────┐
  [FE-12~14]  [FE-15~18]  [FE-19~24]
   인증 UI    카테고리 UI   할일 UI
                   ↓
           [FE-25~27] 반응형 검증
```

---

## 데이터베이스 태스크

### DB-01 — 환경 설정 (로컬 PostgreSQL, .env, 패키지)

**상세 작업 내용**
- 로컬 PostgreSQL에서 개발용 DB(`todolist_dev`) 및 사용자 계정 생성
- `backend/.env.example` 작성 (`NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRY`, `LOG_LEVEL`, `CORS_ORIGIN`)
- `backend/.env` 생성 (실제 값 입력, `.gitignore` 대상)
- `backend/package.json` 초기화, `pg` 의존성 추가
- 루트 `package.json` `workspaces` 배열에 `"backend"` 추가

**완료 조건**
- [ ] 로컬 PostgreSQL에서 `todolist_dev` 접속 가능
- [ ] `backend/.env.example`이 버전 관리에 포함되어 모든 키 보유
- [ ] `backend/.env`가 `.gitignore`에 의해 추적 제외
- [ ] `npm install` (루트) 오류 없이 완료

**의존 태스크**: 없음 | **예상 소요**: 30분

---

### DB-02 — schema.sql 적용 및 검증

**상세 작업 내용**
- `psql -U <user> -d todolist_dev -f database/schema.sql` 실행
- 테이블 3개, 인덱스 4개 생성 확인 (`\dt`, `\di`)
- 제약조건 검증: UNIQUE(email), UNIQUE(user_id, name), CASCADE DELETE, SET NULL
- 루트 `package.json`에 `"db:schema"` 스크립트 추가

**완료 조건**
- [ ] `\dt`로 `users`, `categories`, `todos` 확인
- [ ] `\di`로 인덱스 4개 (`idx_categories_user_id`, `idx_todos_user_id`, `idx_todos_category_id`, `idx_todos_user_status`) 확인
- [ ] UNIQUE, CASCADE, SET NULL 제약 동작 검증 완료
- [ ] `schema.sql` 재실행 시 멱등성 확인

**의존 태스크**: DB-01 | **예상 소요**: 20분

---

### DB-03 — 시드 데이터

**상세 작업 내용**
- `database/seeds/seed.sql` 작성
  - `users` 2건 (bcrypt 해시 비밀번호 사전 계산)
  - `categories` 6건 (각 사용자 3개)
  - `todos` 10건 (완료·기한 초과·활성 상태 혼합, category_id NULL 포함)
- 상단에 `TRUNCATE todos, categories, users RESTART IDENTITY CASCADE;` 삽입
- 루트 `package.json`에 `"db:seed"` 스크립트 추가

**완료 조건**
- [ ] `seed.sql` 오류 없이 실행
- [ ] `users` 2건, `categories` 6건, `todos` 10건 존재
- [ ] 완료·기한 초과·활성 상태 todo 각 1건 이상, `category_id` NULL 1건 이상
- [ ] 시드 재실행 시 중복 에러 없이 복원

**의존 태스크**: DB-02 | **예상 소요**: 30분

---

### DB-04 — DB 연결 모듈 (database.js)

**상세 작업 내용**
- `backend/src/config/database.js` 구현
  - `pg.Pool` 생성 (`connectionString`, `max: 10`, `idleTimeoutMillis: 30000`)
  - `pool.on('error')` 핸들러 등록
  - `db.query(text, params)` 래퍼 내보내기
  - `testConnection()` 헬퍼 (`SELECT 1`, 실패 시 프로세스 종료)
- `server.js` 기동 시 `testConnection()` 호출

**완료 조건**
- [ ] 올바른 `DATABASE_URL`로 `testConnection()` 성공
- [ ] 잘못된 `DATABASE_URL`이면 에러 출력 후 프로세스 종료
- [ ] `db.query()` 단순 SELECT 정상 실행
- [ ] `pool.connect()`로 트랜잭션 수행 가능 구조

**의존 태스크**: DB-01 | **예상 소요**: 30분

---

### DB-05 — 마이그레이션 전략

**상세 작업 내용**
- `database/migrations/` 디렉토리 생성, 네이밍 규칙 수립 (`YYYYMMDD_NNN_<설명>.sql`)
- `20260428_001_init_schema.sql` 생성 (기준 마이그레이션)
- `database/migrations/README.md` 작성 (순서 적용 원칙, 롤백 방법, 파일 불변성 원칙)
- 루트 `package.json`에 `"db:migrate"` 스크립트 추가

**완료 조건**
- [ ] `database/migrations/README.md`에 네이밍 컨벤션 문서화
- [ ] 초기 마이그레이션 파일 존재
- [ ] 적용 규칙·롤백 방법·파일 불변성 원칙 기술
- [ ] `db:migrate` 스크립트 실행 가능

**의존 태스크**: DB-02 | **예상 소요**: 20분

---

## 백엔드 태스크

### BE-01 — 프로젝트 초기화

**상세 작업 내용**
- `backend/package.json` 작성 (`@todolist/backend`, `"type": "module"`, scripts: dev/start/test/lint)
- 런타임 의존성: `express@5`, `pg`, `jsonwebtoken`, `bcrypt`, `dotenv`, `cors`
- 개발 의존성: `nodemon`, `jest`, `supertest`, `eslint`
- `backend/src/` 하위 디렉토리 골격 생성: `config/`, `middleware/`, `routes/`, `controllers/`, `services/`, `repositories/`, `utils/`, `validators/`
- `server.js`, `src/app.js` 골격 파일 생성
- `backend/.eslintrc.json`, `jest.config.js`, `.gitignore` 작성

**완료 조건**
- [ ] `npm install -w backend` 오류 없이 완료
- [ ] `backend/src/` 하위 8개 디렉토리 존재
- [ ] `server.js`, `app.js` 골격 파일 문법 오류 없음
- [ ] `npm run lint -w backend` 설정 오류 없음
- [ ] `npm run test -w backend` 테스트 프레임워크 정상 기동

**의존 태스크**: 없음 | **예상 소요**: 30분

---

### BE-02 — 환경변수 설정 (env.js)

**상세 작업 내용**
- `backend/.env.example` 작성 (`NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRY`, `LOG_LEVEL`, `CORS_ORIGIN`)
- `backend/src/config/env.js` 구현
  - 필수 환경변수 검증 (`DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`), 누락 시 즉시 프로세스 종료
  - `env` 객체 파싱·타입 변환 후 내보내기

**완료 조건**
- [ ] `.env.example`에 모든 키가 예시 값과 함께 정의
- [ ] `DATABASE_URL` 누락 시 명확한 에러 메시지 출력 후 종료
- [ ] `env.port`가 숫자 타입 반환
- [ ] `env.isDevelopment`, `env.isProduction` 올바르게 동작

**의존 태스크**: BE-01 | **예상 소요**: 20분

---

### BE-03 — PostgreSQL 연결 풀 (database.js)

**상세 작업 내용**
- `backend/src/config/database.js` 구현 (DB-04와 동일 내용, backend 워크스페이스 기준)
- `pg.Pool` 인스턴스, `db.query()` 래퍼, `testConnection()` 헬퍼

**완료 조건**
- [ ] `testConnection()` 성공/실패 분기 동작
- [ ] `db.query()` 단순 SELECT 정상 실행
- [ ] 연결 풀 에러 콘솔 로깅

**의존 태스크**: BE-02 | **예상 소요**: 30분

---

### BE-04 — 공통 유틸리티 (jwt.js, bcrypt.js, errorHandler.js)

**상세 작업 내용**
- `utils/jwt.js`: `generateToken(payload)` (HS512), `verifyToken(token)` (실패 시 AppError 401)
- `utils/bcrypt.js`: `hashPassword(password)`, `verifyPassword(password, hash)`
- `utils/errorHandler.js`: `AppError` 클래스 (message, statusCode, type)

**완료 조건**
- [ ] `generateToken()` → JWT 문자열 반환
- [ ] `verifyToken(만료/위변조)` → `AppError` 401 throw
- [ ] `hashPassword()` → `verifyPassword()`로 검증 시 `true`
- [ ] `new AppError('msg', 409).statusCode === 409`

**의존 태스크**: BE-02 | **예상 소요**: 30분

---

### BE-05 — 미들웨어 구현

**상세 작업 내용**
- `middleware/logger.js`: `requestLogger` (method, path, statusCode, duration 로깅)
- `middleware/errorHandler.js`: 4-인수 Express 에러 핸들러, 개발/운영 환경별 stack 노출 분기, 응답 형식 `{ success: false, error: { message, type } }`
- `middleware/authMiddleware.js`: `Authorization: Bearer <token>` 파싱, `verifyToken()`, `req.user` 설정

**완료 조건**
- [ ] 모든 요청에 method/path/statusCode/duration 로깅
- [ ] `AppError(msg, 409)` → 응답 status 409, `{ success: false, error: { message } }`
- [ ] `NODE_ENV=production` 에러 응답에 `stack` 미포함
- [ ] 유효 JWT → `req.user.id` 설정
- [ ] 토큰 없음/위변조 → 401 반환

**의존 태스크**: BE-03, BE-04 | **예상 소요**: 45분

---

### BE-06 — Express 앱 초기화 (app.js, routes/index.js)

**상세 작업 내용**
- `app.js`: cors → express.json() → requestLogger → routes → 404 핸들러 → errorHandler 순서로 등록
- `routes/index.js`: `/api/auth`, `/api/todos`, `/api/categories` 마운트
- `server.js`: `testConnection()` 성공 후 `app.listen()`

**완료 조건**
- [ ] `npm run dev -w backend` 지정 포트로 기동
- [ ] 미정의 경로 → 404 반환
- [ ] `OPTIONS` 요청 → CORS 헤더 포함
- [ ] 에러 핸들러 최하단 등록 확인

**의존 태스크**: BE-05 | **예상 소요**: 30분

---

### BE-07 — 사용자 Repository (userRepository.js)

**상세 작업 내용**
- `findByEmail(email)`, `findById(id)` (password 필드 제외), `create({ email, password })`, `deleteById(id)`
- 모든 쿼리 파라미터 바인딩(`$1`, `$2`) 필수

**완료 조건**
- [ ] `findByEmail(미존재)` → `null` 반환
- [ ] `findById()` 결과에 `password` 필드 없음
- [ ] `deleteById()` 후 연관 데이터 CASCADE 삭제 확인
- [ ] 문자열 연결 SQL 없음

**의존 태스크**: BE-03 | **예상 소요**: 30분

---

### BE-08 — 인증 Service (authService.js)

**상세 작업 내용**
- `signUp({ email, password })`: 이메일 형식·비밀번호 8자 검증 → 중복 확인(409) → 해시 저장 → JWT 반환
- `signIn({ email, password })`: DB 조회 → 비밀번호 검증 → JWT 반환 (실패 시 401, 계정 정보 미노출)
- `deleteAccount(userId)`: CASCADE는 DB 위임

**완료 조건**
- [ ] 중복 이메일 → AppError 409
- [ ] 비밀번호 7자 → AppError 400
- [ ] 미존재 이메일 → AppError 401 (이메일 존재 여부 미구별)
- [ ] 잘못된 비밀번호 → AppError 401

**의존 태스크**: BE-04, BE-07 | **예상 소요**: 45분

---

### BE-09 — 인증 Controller & Route

**상세 작업 내용**
- `authController.js`: `signUp` (201), `signIn` (200), `signOut` (200, 서버 처리 없음), `deleteAccount` (200)
- `authRoutes.js`: POST /sign-up, POST /sign-in, POST /sign-out(authMiddleware), DELETE /account(authMiddleware)

**완료 조건**
- [ ] POST /api/auth/sign-up → 201 + JWT
- [ ] POST /api/auth/sign-up 중복 이메일 → 409
- [ ] POST /api/auth/sign-in → 200 + JWT
- [ ] POST /api/auth/sign-in 잘못된 자격증명 → 401
- [ ] DELETE /api/auth/account 인증 후 계정+연관 데이터 삭제
- [ ] 모든 컨트롤러 `next(error)` 패턴 적용

**의존 태스크**: BE-06, BE-08 | **예상 소요**: 45분

---

### BE-10 — 카테고리 Repository (categoryRepository.js)

**상세 작업 내용**
- `findAllByUserId(userId)`, `findById(id)`, `findByUserIdAndName(userId, name)`, `create({ userId, name })`, `update(id, { name })`, `deleteById(id)`

**완료 조건**
- [ ] `findAllByUserId()` 해당 사용자 카테고리만 반환
- [ ] `deleteById()` 후 소속 todos `category_id` → NULL
- [ ] `findByUserIdAndName()` 중복 존재 시 row 반환
- [ ] 모든 쿼리 파라미터 바인딩 적용

**의존 태스크**: BE-03 | **예상 소요**: 30분

---

### BE-11 — 카테고리 Service (categoryService.js)

**상세 작업 내용**
- `getCategories(userId)`, `createCategory(userId, { name })` (name 필수·20자·중복 검증), `updateCategory(userId, categoryId, { name })` (존재·소유권·중복 검증), `deleteCategory(userId, categoryId)` (존재·소유권 검증)

**완료 조건**
- [ ] `createCategory` name 빈 문자열 → AppError 400
- [ ] `createCategory` name 21자 → AppError 400
- [ ] `createCategory` 중복 이름 → AppError 409
- [ ] `updateCategory` 미존재 ID → AppError 404
- [ ] `updateCategory` 타인 소유 → AppError 403

**의존 태스크**: BE-04, BE-10 | **예상 소요**: 45분

---

### BE-12 — 카테고리 Controller & Route

**상세 작업 내용**
- `categoryController.js`: `getCategories` (200), `createCategory` (201), `updateCategory` (200), `deleteCategory` (200)
- `categoryRoutes.js`: 모든 라우트 `authMiddleware` 적용. GET /, POST /, PATCH /:id, DELETE /:id

**완료 조건**
- [ ] GET /api/categories 인증 사용자 목록 반환
- [ ] GET /api/categories 토큰 없음 → 401
- [ ] POST /api/categories name 누락 → 400
- [ ] PATCH /api/categories/:id 타인 소유 → 403
- [ ] DELETE /api/categories/:id 소속 todos category_id → NULL

**의존 태스크**: BE-06, BE-11 | **예상 소요**: 40분

---

### BE-13 — 할일 Repository (todoRepository.js)

**상세 작업 내용**
- `findAllByUserId(userId, filters)` (동적 categoryId 필터), `findById(id)`, `create({...})`, `update(id, fields)` (동적 SET), `setCompleted(id, isCompleted)`, `deleteById(id)`

**완료 조건**
- [ ] `findAllByUserId(userId, { categoryId: 2 })` → category_id = 2만 반환
- [ ] `update(id, { title })` → title만 변경, 나머지 유지
- [ ] `setCompleted(id, true)` 후 `findById()` → `is_completed = true`
- [ ] 동적 UPDATE 쿼리 파라미터 바인딩 확인

**의존 태스크**: BE-03 | **예상 소요**: 45분

---

### BE-14 — 할일 Service (todoService.js)

**상세 작업 내용**
- `getTodos(userId, filters)`: status 계산 후 첨부 (`completed`/`overdue`/`active`), 메모리 필터
- `createTodo(userId, {...})`: title 필수·50자, description 200자, categoryId 소유권 검증
- `updateTodo(userId, todoId, fields)`: 존재·소유권·필드 검증
- `deleteTodo(userId, todoId)`, `completeTodo(userId, todoId)`, `incompleteTodo(userId, todoId)`
- 내부 헬퍼 `calculateStatus(todo)` 분리

**완료 조건**
- [ ] `getTodos({ status: 'overdue' })` → 오늘 이전 due_date 미완료만 반환
- [ ] `getTodos({ status: 'active' })` → due_date 없거나 오늘 이후 미완료만 반환
- [ ] `createTodo` title 51자 → AppError 400
- [ ] `createTodo` 타인 categoryId → AppError 403
- [ ] `completeTodo` → status `'completed'` 반환
- [ ] `incompleteTodo` → due_date 기준 status 재계산

**의존 태스크**: BE-04, BE-10, BE-13 | **예상 소요**: 60분

---

### BE-15 — 할일 Controller & Route

**상세 작업 내용**
- `todoController.js`: `getTodos`(200), `createTodo`(201), `updateTodo`(200), `deleteTodo`(200), `completeTodo`(200), `incompleteTodo`(200)
- `todoRoutes.js`: 모든 라우트 `authMiddleware`. GET /, POST /, PATCH /:id, DELETE /:id, PATCH /:id/complete, PATCH /:id/incomplete (라우트 순서 주의)

**완료 조건**
- [ ] GET /api/todos?status=overdue → overdue 필터
- [ ] GET /api/todos?category_id=1 → 해당 카테고리 필터
- [ ] POST /api/todos title 누락 → 400
- [ ] PATCH /api/todos/:id/complete → is_completed=true, status='completed'
- [ ] 인증 없는 요청 → 401 / 타인 리소스 → 403

**의존 태스크**: BE-06, BE-14 | **예상 소요**: 45분

---

### BE-16 — 인증 API 통합 테스트

**완료 조건**
- [ ] 인증 4개 엔드포인트 정상·오류 케이스 모두 통과
- [ ] 탈퇴 후 재로그인 → 401 테스트 확인
- [ ] `npm run test -w backend` 인증 테스트 green

**의존 태스크**: BE-09 | **예상 소요**: 60분

---

### BE-17 — 카테고리 API 통합 테스트

**완료 조건**
- [ ] 카테고리 4개 엔드포인트 정상·오류 케이스 통과
- [ ] 카테고리 삭제 → todos category_id NULL 통합 테스트 확인
- [ ] 소유권 검증(403) 테스트 커버
- [ ] `npm run test -w backend` 카테고리 테스트 green

**의존 태스크**: BE-12 | **예상 소요**: 60분

---

### BE-18 — 할일 API 통합 테스트

**완료 조건**
- [ ] 할일 6개 엔드포인트 정상·오류 케이스 통과
- [ ] status 계산 4가지 경우 단위 테스트 커버 (오늘 날짜 = active 포함)
- [ ] 복합 필터(status + category_id) 테스트 확인
- [ ] `npm run test -w backend` 할일 테스트 green

**의존 태스크**: BE-15 | **예상 소요**: 75분

---

### BE-19 — 전체 API 보안 검증

**완료 조건**
- [ ] 14개 엔드포인트 전체 구현 및 명세 일치
- [ ] 인증 필요 11개 라우트 전체 `authMiddleware` 적용 확인
- [ ] Repository 파일에서 문자열 연결 SQL 없음 확인
- [ ] `NODE_ENV=production` 에러 응답에 `stack` 미포함 확인
- [ ] `npm run test -w backend` 전체 통과
- [ ] 전체 플로우 (회원가입 → 로그인 → 할일 CRUD → 탈퇴) 수동 검증 완료

**의존 태스크**: BE-16, BE-17, BE-18 | **예상 소요**: 60분

---

## 프론트엔드 태스크

### FE-01 — Vite + React 19 스캐폴딩

**상세 작업 내용**
- `frontend/` 워크스페이스에 Vite + React 19 프로젝트 생성
- `package.json` (`@todolist/frontend`, scripts: dev/build/lint/preview)
- `vite.config.js`: 포트 5173, `@/` alias (`src/`)
- `index.html` lang=ko 설정, 기본 파일 정리
- `.env.example`: `VITE_API_BASE_URL`, `VITE_LOG_LEVEL`, `VITE_APP_VERSION`

**완료 조건**
- [ ] `npm run dev -w frontend` → `http://localhost:5173` 빈 React 앱 렌더링
- [ ] `@/` alias import 동작 확인
- [ ] `npm run build` 오류 없이 `dist/` 생성

**의존 태스크**: 없음 | **예상 소요**: 30분

---

### FE-02 — Tailwind CSS 설정

**상세 작업 내용**
- `tailwindcss`, `postcss`, `autoprefixer` 설치
- `tailwind.config.js` content 경로 설정
- `src/index.css` 디렉티브 삽입, `main.jsx`에서 import
- `darkMode: 'class'` 주석 처리 (Phase 2 대비)

**완료 조건**
- [ ] Tailwind 클래스 브라우저 정상 적용
- [ ] 모바일/데스크탑 breakpoint 동작 확인
- [ ] 빌드 시 미사용 클래스 purge 확인

**의존 태스크**: FE-01 | **예상 소요**: 30분

---

### FE-03 — React Router 설정

**상세 작업 내용**
- `react-router-dom` 설치
- `main.jsx` `BrowserRouter` 래핑
- `App.jsx` Routes 구성: `/sign-in`, `/sign-up`, `/`→`/todos` redirect, `/todos`(가드), `/categories`(가드), `*`→ErrorPage
- `src/constants/ROUTES.js` 경로 상수 정의

**완료 조건**
- [ ] 각 경로 직접 접근 시 해당 컴포넌트 렌더링
- [ ] `/` → `/todos` 리다이렉트
- [ ] 미정의 경로 → `ErrorPage`

**의존 태스크**: FE-01 | **예상 소요**: 45분

---

### FE-04 — TanStack Query 설정

**상세 작업 내용**
- `@tanstack/react-query` 설치
- `main.jsx` `QueryClientProvider` + `QueryClient` (staleTime 1분, retry 1, refetchOnWindowFocus false)
- 개발 환경 `@tanstack/react-query-devtools` 설치

**완료 조건**
- [ ] `QueryClientProvider`가 앱 전체 래핑
- [ ] 개발 환경 DevTools 패널 표시
- [ ] 기본 옵션 적용 확인

**의존 태스크**: FE-01 | **예상 소요**: 30분

---

### FE-05 — Zustand 스토어 설정

**상세 작업 내용**
- `zustand` 설치
- `stores/authStore.js`: `user`, `token`, `isAuthenticated`, `setAuth()`, `clearAuth()` (persist 미들웨어, localStorage 키: `authToken`)
- `stores/uiStore.js`: `isModalOpen`, `modalType`, `modalData`, `openModal()`, `closeModal()`

**완료 조건**
- [ ] `setAuth()` 후 `localStorage`에 `authToken` 저장
- [ ] `clearAuth()` 후 `localStorage`에서 토큰 삭제 및 state 초기화
- [ ] `useUiStore()` 모달 상태 제어 가능

**의존 태스크**: FE-01 | **예상 소요**: 45분

---

### FE-06 — ESLint 설정

**완료 조건**
- [ ] `npm run lint` 초기 코드에서 에러 없음
- [ ] `var` 사용, 미사용 변수, 세미콜론 누락 시 에러 표시
- [ ] React Hooks 규칙 위반 시 플러그인 에러 감지

**의존 태스크**: FE-01 | **예상 소요**: 30분

---

### FE-07 — 상수 및 유틸 함수 구현

**상세 작업 내용**
- `constants/`: `TODO_STATUS.js`, `ERROR_MESSAGES.js`, `API_ENDPOINTS.js`, `VALIDATION.js`, `ROUTES.js`
- `utils/validation.js`: `validateEmail()`, `validatePassword()`, `validateTodoTitle()`, `validateCategoryName()` → `{ isValid, message }` 반환
- `utils/formatDate.js`: `formatDate()` (한국어), `formatDateInput()` (YYYY-MM-DD), `isOverdue(dueDate)`
- `utils/errorHandler.js`: `parseApiError(error)` → `{ type, message }`, `getErrorMessage(error)` → 문자열

**완료 조건**
- [ ] `validateEmail('test@example.com')` → `{ isValid: true }`
- [ ] `validateEmail('invalid')` → `{ isValid: false, message }`
- [ ] `formatDate('2026-04-28')` → `'2026년 04월 28일'`
- [ ] `isOverdue('2026-04-27')` → `true` (기준일 2026-04-28)
- [ ] `parseApiError` 401 → `AUTH_ERROR` 타입 분류

**의존 태스크**: FE-01 | **예상 소요**: 1시간 30분

---

### FE-08 — API Client 구현

**상세 작업 내용**
- `api/client.js`: axios 인스턴스, 요청 인터셉터(토큰 자동 주입), 응답 인터셉터(data 추출, 401 → clearAuth + 리다이렉트)
- `api/authApi.js`: `signUp`, `signIn`, `signOut`, `deleteAccount`
- `api/todoApi.js`: `fetchTodos`, `createTodo`, `updateTodo`, `deleteTodo`, `completeTodo`, `uncompleteTodo`
- `api/categoryApi.js`: `fetchCategories`, `createCategory`, `updateCategory`, `deleteCategory`

**완료 조건**
- [ ] 모든 요청에 `Authorization` 헤더 자동 포함
- [ ] 401 응답 → 토큰 삭제 + `/sign-in` 리다이렉트
- [ ] `fetchTodos({ status: 'active' })` → 쿼리스트링 포함 요청 전송
- [ ] API 함수가 `{ success, data }` 래퍼를 벗긴 순수 `data` 반환

**의존 태스크**: FE-05, FE-07 | **예상 소요**: 1시간 30분

---

### FE-09 — 공통 UI 컴포넌트 구현

**상세 작업 내용**
- `Button.jsx`: variant (primary/secondary/danger/ghost), size, isLoading(Spinner), disabled
- `Input.jsx`: label, error(빨간 테두리 + ErrorMessage), maxLength
- `Modal.jsx`: Portal 렌더링, Escape 키 닫기, body 스크롤 잠금
- `Spinner.jsx`: size, Tailwind animate-spin
- `ErrorMessage.jsx`: message 없으면 미렌더링

**완료 조건**
- [ ] `Button isLoading=true` → Spinner 표시, 클릭 비활성
- [ ] `Input error="메시지"` → 빨간 테두리 + 메시지
- [ ] `Modal isOpen=true` → Portal 렌더링, Escape 닫힘
- [ ] 모바일(360px)·데스크탑(1280px) 깨짐 없음

**의존 태스크**: FE-02 | **예상 소요**: 2시간

---

### FE-10 — 레이아웃 컴포넌트 (Header, PageLayout)

**상세 작업 내용**
- `Header.jsx`: 인증 상태별 조건부 렌더링 (네비게이션·로그아웃), 로그아웃 → clearAuth → 리다이렉트
- `PageLayout.jsx`: Header 포함, max-w-screen-lg 중앙 정렬

**완료 조건**
- [ ] 로그인 상태 → 네비게이션·로그아웃 버튼 표시
- [ ] 비로그인 상태 → 네비게이션 미표시
- [ ] 로그아웃 → 토큰 삭제 + `/sign-in` 이동
- [ ] 모바일 Header 가로 스크롤 없음
- [ ] 데스크탑 1280px 중앙 정렬

**의존 태스크**: FE-05, FE-08, FE-09 | **예상 소요**: 1시간 30분

---

### FE-11 — Custom Hooks 구현

**상세 작업 내용**
- `hooks/useAuth.js`: `login()`, `register()`, `logout()`, `deleteAccount()` (authStore + API + 리다이렉트)
- `hooks/useTodos.js`: `useTodosQuery(filters)`, `useCreateTodo()`, `useUpdateTodo()`, `useDeleteTodo()`, `useCompleteTodo()` (Optimistic Update), `useUncompleteTodo()`
- `hooks/useCategories.js`: `useCategoriesQuery()`, `useCreateCategory()`, `useUpdateCategory()`, `useDeleteCategory()` (todos 쿼리 함께 invalidate)

**완료 조건**
- [ ] `useTodosQuery({ status: 'active' })` 데이터 로드
- [ ] `useCompleteTodo().mutate(id)` → 서버 응답 전 UI 즉시 완료 상태 (Optimistic)
- [ ] 카테고리 삭제 → `['todos']` 쿼리 자동 재요청
- [ ] 컴포넌트에서 직접 HTTP 호출 없음 (hooks 경유 강제)

**의존 태스크**: FE-08, FE-05 | **예상 소요**: 2시간

---

### FE-12 — 로그인 페이지 (SignInPage)

**완료 조건**
- [ ] 빈 폼 제출 → 검증 메시지, API 미호출
- [ ] 로딩 중 버튼 Spinner, 재클릭 불가
- [ ] 잘못된 자격증명 → 에러 메시지 표시
- [ ] 로그인 성공 → `/todos` 이동
- [ ] 로그인 상태로 `/sign-in` 접근 → `/todos` 리다이렉트

**의존 태스크**: FE-03, FE-09, FE-11 | **예상 소요**: 1시간 30분

---

### FE-13 — 회원가입 페이지 (SignUpPage)

**완료 조건**
- [ ] 비밀번호 불일치 → 버튼 비활성 또는 인라인 에러
- [ ] 중복 이메일(409) → 한국어 에러 메시지
- [ ] 가입 성공 → 자동 로그인 후 `/todos` 이동
- [ ] 비밀번호 필드 마스킹

**의존 태스크**: FE-03, FE-09, FE-11 | **예상 소요**: 1시간 30분

---

### FE-14 — 인증 가드 (PrivateRoute)

**완료 조건**
- [ ] 비로그인 → `/todos` 직접 접근 시 `/sign-in` 리다이렉트
- [ ] 로그인 후 새로고침 → 로그인 상태 유지 (localStorage persist)
- [ ] 만료 토큰 API 호출 → 토큰 삭제 + `/sign-in` 이동
- [ ] 로그인 상태 → `/sign-in`, `/sign-up` 접근 시 `/todos` 리다이렉트

**의존 태스크**: FE-03, FE-05, FE-08 | **예상 소요**: 1시간

---

### FE-15 — 카테고리 목록 페이지 (CategoryPage)

**완료 조건**
- [ ] 카테고리 목록 API 로드 표시
- [ ] 로딩/에러/빈 목록 상태 UI 표시
- [ ] 각 아이템에 수정·삭제 버튼 표시

**의존 태스크**: FE-10, FE-11, FE-14 | **예상 소요**: 1시간

---

### FE-16 — 카테고리 추가

**완료 조건**
- [ ] 빈 이름 제출 → 검증 메시지, API 미호출
- [ ] 추가 성공 → 목록 즉시 반영
- [ ] 중복 이름(409) → 한국어 에러 메시지
- [ ] 20자 카운터 실시간 표시

**의존 태스크**: FE-15, FE-09 | **예상 소요**: 1시간

---

### FE-17 — 카테고리 수정

**완료 조건**
- [ ] 수정 모달 → 기존 이름 pre-fill
- [ ] 수정 성공 → 목록 즉시 갱신
- [ ] 취소 → 원래 상태 유지

**의존 태스크**: FE-15, FE-09 | **예상 소요**: 45분

---

### FE-18 — 카테고리 삭제

**완료 조건**
- [ ] 삭제 버튼 → 확인 모달 표시 (소속 할일 처리 안내 문구 포함)
- [ ] 삭제 성공 → 카테고리 목록 + 할일 목록 모두 갱신
- [ ] 취소 → 삭제되지 않음

**의존 태스크**: FE-15, FE-09 | **예상 소요**: 45분

---

### FE-19 — 할일 목록 페이지 기본 구조 (TodoListPage)

**완료 조건**
- [ ] 진입 시 "활성" 탭 기본 선택, 활성 할일 표시
- [ ] 탭 클릭 → 해당 상태 목록 즉시 전환
- [ ] 카테고리 필터 선택 → 해당 카테고리만 표시
- [ ] 탭 + 카테고리 필터 동시 적용 가능
- [ ] 빈 목록 → 탭별 안내 문구 표시

**의존 태스크**: FE-10, FE-11, FE-14 | **예상 소요**: 1시간 30분

---

### FE-20 — 할일 아이템 컴포넌트 (TodoItem)

**완료 조건**
- [ ] 완료 처리 → 체크박스 체크 + 취소선 즉시 표시 (Optimistic)
- [ ] 기한 초과 → 종료일 빨간색 표시
- [ ] 카테고리 없는 할일 → 카테고리 배지 미표시
- [ ] 체크박스 터치 영역 44px 이상

**의존 태스크**: FE-07, FE-09, FE-11 | **예상 소요**: 1시간 30분

---

### FE-21 — 할일 추가

**완료 조건**
- [ ] 제목 없이 제출 → 검증 메시지, API 미호출
- [ ] 추가 성공 → 목록 즉시 반영
- [ ] 카테고리 드롭다운에 사용자 카테고리 목록 표시
- [ ] 모달 재오픈 → 폼 초기화
- [ ] 제목 50자, 설명 200자 카운터 실시간 표시

**의존 태스크**: FE-19, FE-20, FE-09 | **예상 소요**: 1시간 30분

---

### FE-22 — 할일 수정

**완료 조건**
- [ ] 수정 모달 → 기존 값 pre-fill
- [ ] 수정 성공 → 목록 즉시 갱신
- [ ] 제목 공란 저장 → 검증 에러

**의존 태스크**: FE-19, FE-20, FE-21 | **예상 소요**: 1시간

---

### FE-23 — 할일 삭제

**완료 조건**
- [ ] 삭제 버튼 → 확인 모달 표시
- [ ] 확인 → 목록 즉시 제거
- [ ] 취소 → 삭제되지 않음

**의존 태스크**: FE-20, FE-09 | **예상 소요**: 30분

---

### FE-24 — 할일 완료/완료 취소

**완료 조건**
- [ ] 완료 처리 → 서버 응답 전 UI 즉시 변경 (Optimistic)
- [ ] API 실패 → 원래 상태로 롤백
- [ ] 완료 처리된 할일 → 완료 탭에서 조회
- [ ] 완료 취소 → 활성 또는 기한 초과 상태로 복귀
- [ ] 기한 초과 할일도 완료 처리 가능

**의존 태스크**: FE-11, FE-20 | **예상 소요**: 1시간

---

### FE-25 — 모바일 반응형 검증 (360px+)

**완료 조건**
- [ ] 360px에서 모든 페이지 가로 스크롤 없음
- [ ] 버튼·체크박스 터치 영역 44px 이상
- [ ] 모달 360px에서 좌우 패딩 유지
- [ ] SC-04 (박소영 모바일 시나리오) 불편 없이 동작

**의존 태스크**: FE-12 ~ FE-24 전체 | **예상 소요**: 1시간 30분

---

### FE-26 — 데스크탑 레이아웃 검증 (1280px+)

**완료 조건**
- [ ] 1280px에서 콘텐츠 중앙 정렬
- [ ] 1920px에서 콘텐츠 과도 확장 없음
- [ ] Header 네비게이션 데스크탑 가로 배치
- [ ] SC-01~SC-03 (김철수 데스크탑 시나리오) 동작

**의존 태스크**: FE-12 ~ FE-24 전체 | **예상 소요**: 1시간

---

### FE-27 — 전체 UX 흐름 통합 검증

**완료 조건**
- [ ] SC-01 ~ SC-07 전체 시나리오 오류 없이 동작
- [ ] 모든 뮤테이션 성공/실패/로딩 상태 올바르게 표시
- [ ] 401 응답 → 토큰 삭제 + 로그인 페이지 이동
- [ ] 네트워크 오류 → 한국어 에러 메시지 표시
- [ ] 미정의 URL → ErrorPage 표시

**의존 태스크**: FE-25, FE-26 | **예상 소요**: 2시간

---

## 일정별 작업 계획

### Day 1 — 2026-04-28 (설계 + DB + BE 기반)

| 시간대 | 작업 |
|---|---|
| 오전 | DB-01, DB-02, DB-04 (환경설정, 스키마 적용, DB 연결 모듈) |
| 오후 전반 | BE-01, BE-02, BE-03, BE-04 (백엔드 초기화, 유틸리티) |
| 오후 후반 | BE-05, BE-06, DB-03, DB-05 (미들웨어, 앱 초기화, 시드, 마이그레이션 전략) |

### Day 2 — 2026-04-29 (BE 기능 + FE 기반)

| 시간대 | 작업 |
|---|---|
| 오전 | BE-07, BE-08, BE-09 (인증 Repository/Service/API) |
| 오후 전반 | BE-10, BE-11, BE-12 (카테고리 전체) |
| 오후 중반 | BE-13, BE-14, BE-15 (할일 전체) |
| 오후 후반 | FE-01, FE-02, FE-03, FE-04, FE-05, FE-06 (FE 초기 설정) |

### Day 3 — 2026-04-30 (FE 기능 + 테스트 + 검증)

| 시간대 | 작업 |
|---|---|
| 오전 전반 | FE-07, FE-08, FE-09, FE-10, FE-11 (FE 공통 인프라) |
| 오전 후반 | FE-12, FE-13, FE-14 (인증 UI) |
| 오후 전반 | FE-15 ~ FE-18 (카테고리 UI), FE-19 ~ FE-24 (할일 UI) |
| 오후 후반 | BE-16, BE-17, BE-18, BE-19 (백엔드 테스트), FE-25, FE-26, FE-27 (반응형·통합 검증) |

---

## 예상 소요 시간 요약

| 영역 | 태스크 수 | 순차 합계 | 비고 |
|---|---|---|---|
| DB | 5개 | ~2시간 | DB-03, DB-05 병렬 가능 |
| Backend | 19개 | ~14시간 | 레이어별 병렬 가능 |
| Frontend | 27개 | ~32시간 | 그룹별 병렬 가능 |
| **합계** | **51개** | **~48시간** | Phase 1 3일 목표 |
