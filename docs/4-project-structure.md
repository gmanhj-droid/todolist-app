# 4. 프로젝트 구조 설계 원칙

## 문서 정보

| 항목 | 내용 |
|------|------|
| 버전 | 1.0.0 |
| 최종 수정일 | 2026-04-28 |
| 작성자 | 최훈진 |
| 상태 | 최초 작성 |

### 변경 이력

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|---------|
| 1.1.0 | 2026-04-28 | 최훈진 | 모노레포 구조 섹션 추가 |
| 1.0.0 | 2026-04-28 | 최훈진 | 초기 문서 작성 |

---

## 개요

이 문서는 Todolist 애플리케이션의 전체 프로젝트 구조와 설계 원칙을 정의합니다. 프론트엔드(React)와 백엔드(Express)가 유지보수 가능하고 확장 가능한 구조로 설계되도록 하며, 모든 개발자가 일관된 패턴을 따르도록 합니다.

**기술 스택:**
- Frontend: React 19, TanStack Query, Zustand, Tailwind CSS (JavaScript only)
- Backend: Node.js 24, Express 5, PostgreSQL (JavaScript only, pg 라이브러리 사용)
- 인증: JWT (HS-512)

---

## 1. 최상위 공통 원칙

모든 레이어(Frontend, Backend)에 공통으로 적용되는 핵심 원칙입니다.

### 1.1 단일 책임 원칙 (Single Responsibility Principle)

각 파일과 모듈은 **하나의 역할만** 수행해야 합니다. 이를 통해 코드의 재사용성과 테스트 가능성을 높입니다.

**Good:**
```javascript
// api/todoApi.js - 할일 API 호출만 담당
export async function fetchTodos(filters) {
  const response = await apiClient.get('/todos', { params: filters });
  return response.data;
}

// utils/dateFormat.js - 날짜 포맷팅만 담당
export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('ko-KR');
}

// services/todoService.js (Backend) - 할일 비즈니스 로직만 담당
export async function getTodosByUserId(userId) {
  const todos = await todoRepository.findByUserId(userId);
  return todos.map(todo => ({
    ...todo,
    isOverdue: new Date(todo.dueDate) < new Date()
  }));
}
```

**Bad:**
```javascript
// 한 파일에 API 호출, 포맷팅, 상태 관리가 모두 포함
export async function fetchAndFormatTodos(filters, setTodos, setLoading) {
  setLoading(true);
  try {
    const response = await fetch('/api/todos', { params: filters });
    const formatted = response.data.map(todo => ({
      ...todo,
      dateStr: new Date(todo.dueDate).toLocaleDateString('ko-KR'),
      isOverdue: new Date(todo.dueDate) < new Date()
    }));
    setTodos(formatted);
  } catch (error) {
    console.error(error);
  }
}
```

### 1.2 관심사 분리 (Separation of Concerns)

**UI 레이어**, **비즈니스 로직 레이어**, **데이터 접근 레이어**를 명확히 구분합니다.

#### Frontend 관심사 분리:
- **UI Components**: JSX 렌더링과 이벤트 핸들링만 담당
- **Custom Hooks**: TanStack Query를 통한 데이터 페칭 로직
- **Store**: 글로벌 상태 관리 (Zustand)
- **API Client**: 백엔드 통신 추상화

**Good:**
```javascript
// components/TodoList.jsx - UI 표현만 담당
function TodoList({ todos, onTodoClick, isLoading }) {
  if (isLoading) return <div>로딩 중...</div>;
  
  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id} onClick={() => onTodoClick(todo.id)}>
          {todo.title}
        </li>
      ))}
    </ul>
  );
}

// hooks/useTodos.js - 데이터 페칭 로직
export function useTodos(filters) {
  return useQuery({
    queryKey: ['todos', filters],
    queryFn: () => fetchTodos(filters)
  });
}

// pages/todo/TodoPage.jsx - 조율 역할
export default function TodoPage() {
  const { data: todos, isLoading } = useTodos({});
  const [selectedTodo, setSelectedTodo] = useState(null);
  
  return <TodoList todos={todos} onTodoClick={setSelectedTodo} isLoading={isLoading} />;
}
```

**Bad:**
```javascript
// 컴포넌트에 데이터 페칭과 API 호출이 모두 포함
function TodoList() {
  const [todos, setTodos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    fetch('/api/todos')
      .then(res => res.json())
      .then(data => setTodos(data))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  );
}
```

#### Backend 관심사 분리:
- **Routes**: URL 엔드포인트 정의와 미들웨어 매핑
- **Controllers**: HTTP 요청/응답 처리
- **Services**: 비즈니스 로직 구현
- **Repositories**: SQL 쿼리와 DB 접근

**Good:**
```javascript
// routes/todoRoutes.js - 라우팅만 담당
router.get('/todos', authMiddleware, todoController.getTodos);
router.post('/todos', authMiddleware, todoController.createTodo);

// controllers/todoController.js - 요청/응답 처리
export const getTodos = async (req, res) => {
  try {
    const todos = await todoService.getTodosByUserId(req.user.id);
    res.json({ success: true, data: todos });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// services/todoService.js - 비즈니스 로직
export async function getTodosByUserId(userId) {
  const todos = await todoRepository.findByUserId(userId);
  return todos.map(todo => enrichTodoData(todo));
}

// repositories/todoRepository.js - DB 접근
export async function findByUserId(userId) {
  const result = await db.query(
    'SELECT * FROM todos WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return result.rows;
}
```

**Bad:**
```javascript
// 컨트롤러에 비즈니스 로직과 SQL이 모두 포함
app.get('/todos', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM todos WHERE user_id = ' + req.user.id
    );
    const enriched = result.rows.map(todo => ({
      ...todo,
      isOverdue: new Date(todo.due_date) < new Date()
    }));
    res.json(enriched);
  } catch (error) {
    res.status(500).json(error.message);
  }
});
```

### 1.3 명시적 의존성 (Explicit Dependencies)

모듈의 의존성을 **명시적으로 선언**해야 하며, 암묵적인 전역 상태나 숨은 사이드 이펙트를 피합니다.

**Good:**
```javascript
// 의존성을 함수 파라미터로 명시적으로 전달
function calculateDaysUntilDue(dueDate, currentDate = new Date()) {
  return Math.ceil((dueDate - currentDate) / (1000 * 60 * 60 * 24));
}

// 컴포넌트에 필요한 props를 명시적으로 전달
function TodoItem({ todo, onComplete, onDelete }) {
  return (
    <div>
      <h3>{todo.title}</h3>
      <button onClick={() => onComplete(todo.id)}>완료</button>
      <button onClick={() => onDelete(todo.id)}>삭제</button>
    </div>
  );
}

// Backend: 의존성 주입 (DI)
export class TodoService {
  constructor(todoRepository) {
    this.todoRepository = todoRepository;
  }

  async getTodos(userId) {
    return this.todoRepository.findByUserId(userId);
  }
}

// 사용
const todoRepository = new TodoRepository(db);
const todoService = new TodoService(todoRepository);
```

**Bad:**
```javascript
// 전역 상태에 암묵적으로 의존
let currentUser = null;

function calculateDaysUntilDue(dueDate) {
  // currentUser가 어디서 설정되는지 불명확
  return Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
}

// Backend: 전역 DB 연결에 의존
export async function getTodos(userId) {
  // 어디서 db가 오는지 불명확, 테스트하기 어려움
  const result = await db.query('SELECT * FROM todos WHERE user_id = $1', [userId]);
  return result.rows;
}
```

### 1.4 일관된 에러 처리 (Consistent Error Handling)

**모든 에러**는 공통 포맷으로 처리되어야 합니다.

**Frontend 에러 처리:**

```javascript
// constants/errors.js
export const ERROR_TYPES = {
  AUTH_ERROR: 'AUTH_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  NOT_FOUND: 'NOT_FOUND'
};

export const ERROR_MESSAGES = {
  AUTH_ERROR: '인증에 실패했습니다.',
  NETWORK_ERROR: '네트워크 연결을 확인하세요.',
  VALIDATION_ERROR: '입력값이 올바르지 않습니다.',
  SERVER_ERROR: '서버 오류가 발생했습니다.',
  NOT_FOUND: '요청한 정보를 찾을 수 없습니다.'
};

// utils/errorHandler.js
export function parseError(error) {
  if (error.response?.status === 401) {
    return { type: ERROR_TYPES.AUTH_ERROR, message: ERROR_MESSAGES.AUTH_ERROR };
  }
  if (error.response?.status === 404) {
    return { type: ERROR_TYPES.NOT_FOUND, message: ERROR_MESSAGES.NOT_FOUND };
  }
  if (error.response?.status >= 500) {
    return { type: ERROR_TYPES.SERVER_ERROR, message: ERROR_MESSAGES.SERVER_ERROR };
  }
  if (!error.response) {
    return { type: ERROR_TYPES.NETWORK_ERROR, message: ERROR_MESSAGES.NETWORK_ERROR };
  }
  return { type: ERROR_TYPES.SERVER_ERROR, message: error.message };
}

// hooks/useTodos.js
export function useTodos() {
  return useQuery({
    queryKey: ['todos'],
    queryFn: fetchTodos,
    onError: (error) => {
      const { type, message } = parseError(error);
      console.error(`[${type}] ${message}`);
    }
  });
}
```

**Backend 에러 처리:**

```javascript
// utils/errorHandler.js
export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const isDevelopment = process.env.NODE_ENV === 'development';

  const response = {
    success: false,
    error: {
      message: err.message,
      type: err.type || 'UNKNOWN_ERROR'
    }
  };

  // 운영 환경에서는 스택 트레이스 노출 금지
  if (isDevelopment) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

// services/todoService.js
export async function getTodosByUserId(userId) {
  if (!userId) {
    throw new AppError('사용자 ID가 필요합니다.', 400);
  }

  try {
    const todos = await todoRepository.findByUserId(userId);
    return todos;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('할일 조회에 실패했습니다.', 500);
  }
}

// app.js (Express 초기화)
app.use(errorHandler);
```

### 1.5 환경별 설정 분리 (Environment Configuration)

**개발**, **테스트**, **운영** 환경의 설정을 명확히 분리합니다.

**Frontend:**

```javascript
// 프로젝트 루트/.env.example
VITE_API_BASE_URL=http://localhost:3000/api
VITE_LOG_LEVEL=debug

// .env.development
VITE_API_BASE_URL=http://localhost:3000/api
VITE_LOG_LEVEL=debug

// .env.production
VITE_API_BASE_URL=https://api.example.com
VITE_LOG_LEVEL=error

// config/env.js
export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  logLevel: import.meta.env.VITE_LOG_LEVEL,
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD
};

// 사용
// api/client.js
import { config } from '../config/env.js';

const apiClient = axios.create({
  baseURL: config.apiBaseUrl
});
```

**Backend:**

```javascript
// 프로젝트 루트/.env.example
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/todolist
JWT_SECRET=your-secret-key-here
JWT_EXPIRY=7d
LOG_LEVEL=debug
CORS_ORIGIN=http://localhost:5173

// .env.development
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://dev:dev@localhost:5432/todolist_dev
JWT_SECRET=dev-secret-key
LOG_LEVEL=debug
CORS_ORIGIN=http://localhost:5173

// .env.production
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://prod:${DB_PASSWORD}@prod-db.example.com:5432/todolist
JWT_SECRET=${JWT_SECRET}
LOG_LEVEL=error
CORS_ORIGIN=https://example.com

// config/env.js
import dotenv from 'dotenv';

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiry: process.env.JWT_EXPIRY || '7d',
  logLevel: process.env.LOG_LEVEL || 'debug',
  corsOrigin: process.env.CORS_ORIGIN,
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production'
};

// 사용
// app.js
import { env } from './config/env.js';

app.use(cors({ origin: env.corsOrigin }));
```

---

## 2. 의존성 및 레이어 원칙

### 2.1 Frontend 레이어 구조

Frontend는 **계층적 의존성**을 유지합니다. 상위 레이어는 하위 레이어에만 의존하고, 하위 레이어는 상위 레이어에 의존하지 않습니다.

```
┌─────────────────────────────────────────────────┐
│                  Pages                          │
│  (TodoPage, CategoryPage, AuthPage)             │
└────────────────┬────────────────────────────────┘
                 │ 의존
┌────────────────▼────────────────────────────────┐
│              Components                         │
│  (TodoList, TodoItem, CategoryForm, etc)        │
└────────────────┬────────────────────────────────┘
                 │ 의존
┌────────────────▼────────────────────────────────┐
│              Custom Hooks                       │
│  (useTodos, useCategories, useAuth)             │
│  - TanStack Query 훅                            │
│  - 데이터 페칭 및 캐싱 로직                      │
└────────────────┬────────────────────────────────┘
                 │ 의존
┌────────────────▼────────────────────────────────┐
│            Stores (Zustand)                     │
│  (authStore, uiStore)                          │
│  - 전역 상태 관리                               │
└────────────────┬────────────────────────────────┘
                 │ 의존
┌────────────────▼────────────────────────────────┐
│          API Client / Utils                     │
│  (fetchTodos, formatDate, parseError)           │
│  - API 호출 추상화                              │
│  - 순수 유틸리티 함수                           │
└─────────────────────────────────────────────────┘
```

**의존성 규칙:**
1. Pages는 Components, Hooks, Stores를 사용
2. Components는 Hooks, Utils를 사용 (다른 Components도 가능)
3. Hooks는 API Client와 Utils를 사용
4. API Client와 Utils는 외부에만 의존

**위반 사항:**
- Components에서 직접 API 호출 (fetch, axios 직접 사용)
- Utils에서 Hooks 사용
- Hooks에서 다른 Hooks의 상태에 직접 접근

### 2.2 Backend 레이어 구조

Backend는 **계층적 의존성**을 유지합니다. 요청은 위에서 아래로, 응답은 아래에서 위로 흐릅니다.

```
┌─────────────────────────────────────────────────┐
│      Express App & Middleware                   │
│  (인증, CORS, 에러 핸들러, 로깅)                 │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│              Routes                             │
│  (GET /todos, POST /todos, DELETE /todos/:id)   │
└────────────────┬────────────────────────────────┘
                 │ 의존
┌────────────────▼────────────────────────────────┐
│           Controllers                           │
│  (todoController.getTodos, .createTodo)         │
│  - 요청 검증 및 응답 포맷팅                      │
└────────────────┬────────────────────────────────┘
                 │ 의존
┌────────────────▼────────────────────────────────┐
│            Services                             │
│  (todoService.getTodosByUserId)                 │
│  - 비즈니스 로직 (계산, 검증, 오케스트레이션)    │
└────────────────┬────────────────────────────────┘
                 │ 의존
┌────────────────▼────────────────────────────────┐
│          Repositories                           │
│  (todoRepository.findByUserId)                  │
│  - SQL 쿼리 및 DB 접근 (pg 라이브러리)          │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│            PostgreSQL Database                  │
└─────────────────────────────────────────────────┘
```

**의존성 규칙:**
1. Routes는 Controllers를 호출
2. Controllers는 Services를 호출
3. Services는 Repositories를 호출
4. Repositories는 데이터베이스에만 접근
5. 역방향 의존 금지 (Repository → Service 방향만 가능)

**위반 사항:**
- Controller에서 Repository 직접 호출
- Service에서 SQL 쿼리 작성
- Repository에서 비즈니스 로직 포함

### 2.3 계층 간 통신

**Frontend - Backend 통신:**

```javascript
// Frontend API 응답 구조는 일관되어야 함
// api/client.js
const apiClient = axios.create({
  baseURL: config.apiBaseUrl,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 응답 인터셉터
apiClient.interceptors.response.use(
  response => response.data, // { success: true, data: {...} }
  error => {
    throw error;
  }
);

// Backend API 응답 구조
// middleware/responseFormatter.js
export const sendSuccess = (res, data, statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    data
  });
};

export const sendError = (res, message, statusCode = 500) => {
  res.status(statusCode).json({
    success: false,
    error: { message }
  });
};

// controllers/todoController.js
export const getTodos = async (req, res, next) => {
  try {
    const todos = await todoService.getTodosByUserId(req.user.id);
    sendSuccess(res, todos);
  } catch (error) {
    next(error);
  }
};
```

### 2.4 공통 유틸리티 및 상수

**Frontend 공통 유틸:**
- `utils/validation.js`: 입력 검증 함수
- `utils/dateFormat.js`: 날짜 포맷팅
- `utils/errorHandler.js`: 에러 파싱
- `constants/apiEndpoints.js`: API 엔드포인트 상수
- `constants/errors.js`: 에러 메시지

**Backend 공통 유틸:**
- `utils/jwt.js`: JWT 생성/검증
- `utils/bcrypt.js`: 비밀번호 해시
- `utils/errorHandler.js`: 에러 처리
- `constants/httpStatus.js`: HTTP 상태 코드
- `constants/messages.js`: 공통 메시지

---

## 3. 코드 및 네이밍 원칙

### 3.1 파일 및 디렉토리 네이밍

| 대상 | 규칙 | 예시 |
|------|------|------|
| React 컴포넌트 | PascalCase | `TodoList.jsx`, `TodoItem.jsx` |
| Custom Hooks | camelCase, `use` prefix | `useTodos.js`, `useAuth.js` |
| Utility 함수 | camelCase | `formatDate.js`, `calculateDaysUntilDue.js` |
| Store (Zustand) | camelCase | `authStore.js`, `uiStore.js` |
| 상수 | UPPER_SNAKE_CASE | `TODO_STATUS.js`, `API_ENDPOINTS.js` |
| 디렉토리 | kebab-case | `api`, `todo-item`, `custom-hooks` |
| Express 라우터 | camelCase | `todoRoutes.js`, `categoryRoutes.js` |
| Service 클래스 | PascalCase | `TodoService.js`, `AuthService.js` |
| Repository 클래스 | PascalCase | `TodoRepository.js`, `UserRepository.js` |

**Good:**
```javascript
// components/TodoList.jsx
export default function TodoList({ todos }) {
  return <ul>{todos.map(todo => <TodoItem key={todo.id} todo={todo} />)}</ul>;
}

// hooks/useTodos.js
export function useTodos(filters) {
  return useQuery({...});
}

// utils/formatDate.js
export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('ko-KR');
}

// constants/TODO_STATUS.js
export const TODO_STATUS = {
  ACTIVE: 'active',
  OVERDUE: 'overdue',
  COMPLETED: 'completed'
};

// stores/authStore.js
export const useAuthStore = create((set) => ({...}));
```

**Bad:**
```javascript
// 컴포넌트 파일명이 lowercase
// src/components/todolist.jsx
export default function todolist() {}

// 훅이 use 접두사 없음
// hooks/TodosLogic.js
export function TodosLogic() {}

// 상수가 camelCase
// constants/todoStatus.js
export const todoStatus = { ... };

// 디렉토리명이 PascalCase
// src/TodoList/ (kebab-case 사용: src/todo-list/)
```

### 3.2 함수 및 변수 네이밍

**동사 + 명사 패턴, 의미 있는 이름 사용:**

```javascript
// Good: 의도가 명확한 이름
function formatTodoListForDisplay(todos, userId) { ... }
const isOverdueItemsVisible = true;
const calculateDaysRemaining = (dueDate) => { ... };

// Bad: 의도가 불명확한 이름
function format(arr) { ... }
const show = true;
const calc = (date) => { ... };
```

**Boolean 변수: `is`, `has`, `should` prefix:**

```javascript
const isLoading = false;
const hasMoreItems = true;
const shouldRefetch = true;
const isTodoCompleted = false;
```

**함수명: 동작을 명확히:**

```javascript
// Getter/조회
function getTodos() { ... }
function fetchUserById(id) { ... }

// Setter/생성
function createTodo(title) { ... }
function saveTodo(todo) { ... }

// 검증
function validateEmail(email) { ... }
function isValidDate(date) { ... }

// 변환/포맷
function formatDate(date) { ... }
function parseTodoResponse(data) { ... }

// 삭제
function deleteTodo(id) { ... }
function removeTodoFromList(todos, id) { ... }
```

### 3.3 API 응답 필드 네이밍

**Database 및 API: snake_case (일관성 유지)**

```javascript
// Database schema
CREATE TABLE todos (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_date TIMESTAMP,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

// API 응답 (snake_case 유지)
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 123,
    "title": "할일 제목",
    "description": "설명",
    "due_date": "2026-05-01T00:00:00Z",
    "is_completed": false,
    "created_at": "2026-04-28T10:00:00Z",
    "updated_at": "2026-04-28T10:00:00Z"
  }
}

// Frontend: API 응답을 받은 후 camelCase로 변환 (선택사항)
const todo = {
  id: response.id,
  userId: response.user_id,
  title: response.title,
  dueDate: response.due_date,
  isCompleted: response.is_completed,
  createdAt: response.created_at,
  updatedAt: response.updated_at
};
```

### 3.4 React 컴포넌트 규칙

**함수형 컴포넌트만 사용, 기본 내보내기:**

```javascript
// Good: 함수형 컴포넌트, 기본 내보내기
// components/TodoList.jsx
export default function TodoList({ todos, onTodoSelect }) {
  return (
    <div className="todo-list">
      {todos.map(todo => (
        <TodoItem key={todo.id} todo={todo} onClick={() => onTodoSelect(todo.id)} />
      ))}
    </div>
  );
}

// Bad: 클래스 컴포넌트
class TodoList extends React.Component {
  render() {
    return <div>{/* ... */}</div>;
  }
}

// Bad: 명명된 내보내기
export function TodoList({ todos }) {
  return <div>{/* ... */}</div>;
}
```

**Props 검증 및 기본값:**

```javascript
// components/TodoItem.jsx
function TodoItem({ 
  todo, 
  onComplete = () => {},
  onDelete = () => {},
  isCompact = false 
}) {
  return (
    <div className={isCompact ? 'todo-item-compact' : 'todo-item'}>
      <h3>{todo.title}</h3>
      {!isCompact && <p>{todo.description}</p>}
      <button onClick={() => onComplete(todo.id)}>완료</button>
      <button onClick={() => onDelete(todo.id)}>삭제</button>
    </div>
  );
}

export default TodoItem;
```

### 3.5 Backend 라우트 및 API 엔드포인트

**RESTful 설계, kebab-case URL:**

```javascript
// routes/todoRoutes.js
router.get('/todos', todoController.getTodos);                    // 모든 할일 조회
router.get('/todos/:id', todoController.getTodoById);             // 특정 할일 조회
router.post('/todos', todoController.createTodo);                 // 할일 생성
router.patch('/todos/:id', todoController.updateTodo);            // 할일 수정
router.delete('/todos/:id', todoController.deleteTodo);           // 할일 삭제
router.patch('/todos/:id/complete', todoController.completeTodo); // 할일 완료처리

// routes/categoryRoutes.js
router.get('/categories', categoryController.getCategories);
router.post('/categories', categoryController.createCategory);
router.patch('/categories/:id', categoryController.updateCategory);
router.delete('/categories/:id', categoryController.deleteCategory);

// routes/authRoutes.js
router.post('/auth/sign-up', authController.signUp);
router.post('/auth/sign-in', authController.signIn);
router.post('/auth/sign-out', authMiddleware, authController.signOut);
router.delete('/auth/account', authMiddleware, authController.deleteAccount);
```

**HTTP 상태 코드:**
- `200 OK`: 성공
- `201 Created`: 리소스 생성 성공
- `204 No Content`: 성공하지만 응답 본문 없음
- `400 Bad Request`: 요청 검증 실패
- `401 Unauthorized`: 인증 필요
- `403 Forbidden`: 권한 없음
- `404 Not Found`: 리소스 없음
- `409 Conflict`: 중복 (예: 회원가입 시 이미 존재하는 이메일)
- `500 Internal Server Error`: 서버 에러

---

## 4. 테스트 및 품질 원칙

### 4.1 테스트 전략

**Phase 1 (MVP) 테스트 범위:**
- 비즈니스 로직 단위 테스트 (Services, Custom Hooks)
- API 통합 테스트 (Controllers, Routes)
- 핵심 컴포넌트 렌더링 테스트

**Phase 2 이후:**
- E2E 테스트 (Cypress, Playwright)
- 전체 코드 커버리지 80% 이상

### 4.2 Backend 테스트

```javascript
// services/__tests__/todoService.test.js
import { todoService } from '../todoService.js';
import * as todoRepository from '../../repositories/todoRepository.js';

jest.mock('../../repositories/todoRepository.js');

describe('TodoService', () => {
  describe('getTodosByUserId', () => {
    it('should return todos for a given user ID', async () => {
      const userId = 1;
      const mockTodos = [
        { id: 1, title: '할일 1', is_completed: false },
        { id: 2, title: '할일 2', is_completed: true }
      ];

      todoRepository.findByUserId.mockResolvedValue(mockTodos);

      const result = await todoService.getTodosByUserId(userId);

      expect(todoRepository.findByUserId).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockTodos);
    });

    it('should throw error if user ID is invalid', async () => {
      await expect(todoService.getTodosByUserId(null)).rejects.toThrow();
    });
  });

  describe('createTodo', () => {
    it('should create a new todo', async () => {
      const todoData = { user_id: 1, title: '새 할일' };
      const mockNewTodo = { id: 1, ...todoData };

      todoRepository.create.mockResolvedValue(mockNewTodo);

      const result = await todoService.createTodo(todoData);

      expect(result).toEqual(mockNewTodo);
    });
  });
});

// controllers/__tests__/todoController.test.js
import request from 'supertest';
import app from '../../app.js';
import * as todoService from '../../services/todoService.js';

jest.mock('../../services/todoService.js');

describe('TodoController', () => {
  describe('GET /todos', () => {
    it('should return all todos for authenticated user', async () => {
      const mockTodos = [{ id: 1, title: '할일 1' }];
      todoService.getTodosByUserId.mockResolvedValue(mockTodos);

      const response = await request(app)
        .get('/todos')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockTodos);
    });

    it('should return 401 if not authenticated', async () => {
      await request(app)
        .get('/todos')
        .expect(401);
    });
  });
});
```

### 4.3 Frontend 테스트

```javascript
// hooks/__tests__/useTodos.test.js
import { renderHook, waitFor } from '@testing-library/react';
import { useTodos } from '../useTodos.js';
import * as todoApi from '../../api/todoApi.js';

jest.mock('../../api/todoApi.js');

describe('useTodos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch todos on mount', async () => {
    const mockTodos = [{ id: 1, title: '할일 1' }];
    todoApi.fetchTodos.mockResolvedValue(mockTodos);

    const { result } = renderHook(() => useTodos());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockTodos);
  });

  it('should handle errors', async () => {
    todoApi.fetchTodos.mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => useTodos());

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('API Error');
  });
});

// components/__tests__/TodoList.test.js
import { render, screen } from '@testing-library/react';
import TodoList from '../TodoList.jsx';

describe('TodoList', () => {
  it('should render todos', () => {
    const todos = [
      { id: 1, title: '할일 1' },
      { id: 2, title: '할일 2' }
    ];

    render(<TodoList todos={todos} />);

    expect(screen.getByText('할일 1')).toBeInTheDocument();
    expect(screen.getByText('할일 2')).toBeInTheDocument();
  });

  it('should render empty state when no todos', () => {
    render(<TodoList todos={[]} />);
    expect(screen.getByText(/할일이 없습니다/i)).toBeInTheDocument();
  });
});
```

### 4.4 코드 품질 원칙

**ESLint 설정:**

```javascript
// .eslintrc.json (Frontend)
{
  "env": {
    "browser": true,
    "es2021": true,
    "node": true
  },
  "extends": [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  "parserOptions": {
    "ecmaFeatures": {
      "jsx": true
    },
    "ecmaVersion": "latest",
    "sourceType": "module"
  },
  "rules": {
    "no-console": ["warn", { "allow": ["error"] }],
    "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-var": "error",
    "prefer-const": "error",
    "semi": ["error", "always"],
    "quotes": ["error", "single"],
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "warn"
  }
}

// .eslintrc.json (Backend)
{
  "env": {
    "node": true,
    "es2021": true
  },
  "extends": ["eslint:recommended"],
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module"
  },
  "rules": {
    "no-console": ["warn", { "allow": ["error"] }],
    "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-var": "error",
    "prefer-const": "error",
    "semi": ["error", "always"],
    "quotes": ["error", "single"]
  }
}
```

**함수 길이 및 복잡도:**
- 함수 길이: 50줄 이내 권장 (최대 100줄)
- 순환 복잡도: 10 이하 권장

```javascript
// Good: 간결한 함수
function calculateDaysUntilDue(dueDate) {
  const diff = dueDate - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// Bad: 너무 긴 함수
function processAndEnrichTodosAndCalculateStatsAndApplyFilters(todos, userId, filters) {
  // 40줄 이상의 코드...
  // 여러 책임을 담당
}
```

---

## 5. 설정, 보안, 운영 원칙

### 5.1 환경 변수 관리

**Frontend:**

```
# .env.example (버전 관리에 포함)
VITE_API_BASE_URL=http://localhost:3000/api
VITE_LOG_LEVEL=debug
VITE_APP_VERSION=1.0.0

# .gitignore
.env
.env.local
.env.*.local
```

**Backend:**

```
# .env.example (버전 관리에 포함)
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/todolist
JWT_SECRET=your-secret-key-here
JWT_EXPIRY=7d
LOG_LEVEL=debug
CORS_ORIGIN=http://localhost:5173

# .gitignore
.env
.env.local
.env.*.local
```

**환경변수 검증:**

```javascript
// Backend: config/env.js
import dotenv from 'dotenv';

dotenv.config();

const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'CORS_ORIGIN'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`환경변수 ${envVar}가 필요합니다.`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiry: process.env.JWT_EXPIRY || '7d',
  logLevel: process.env.LOG_LEVEL || 'debug',
  corsOrigin: process.env.CORS_ORIGIN,
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production'
};
```

### 5.2 인증 보안 (JWT)

**JWT 생성 및 검증:**

```javascript
// Backend: utils/jwt.js
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function generateToken(payload) {
  return jwt.sign(payload, env.jwtSecret, {
    algorithm: 'HS512',
    expiresIn: env.jwtExpiry
  });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, env.jwtSecret, {
      algorithms: ['HS512']
    });
  } catch (error) {
    throw new AppError('유효하지 않은 토큰입니다.', 401);
  }
}

// Backend: middleware/authMiddleware.js
export function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('인증 토큰이 필요합니다.', 401);
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    next(error);
  }
}

// Backend: controllers/authController.js
export const signIn = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await authService.authenticateUser(email, password);
    
    const token = generateToken({
      id: user.id,
      email: user.email
    });

    res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, email: user.email }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Frontend: api/client.js
const apiClient = axios.create({
  baseURL: config.apiBaseUrl
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/auth/sign-in';
    }
    return Promise.reject(error);
  }
);
```

### 5.3 비밀번호 보안

**Bcrypt를 사용한 비밀번호 해시:**

```javascript
// Backend: utils/bcrypt.js
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// Backend: services/authService.js
export async function registerUser(email, password) {
  const existingUser = await userRepository.findByEmail(email);
  if (existingUser) {
    throw new AppError('이미 가입된 이메일입니다.', 409);
  }

  const hashedPassword = await hashPassword(password);
  const user = await userRepository.create({
    email,
    password: hashedPassword
  });

  return user;
}

export async function authenticateUser(email, password) {
  const user = await userRepository.findByEmail(email);
  if (!user) {
    throw new AppError('이메일 또는 비밀번호가 잘못되었습니다.', 400);
  }

  const isPasswordValid = await verifyPassword(password, user.password);
  if (!isPasswordValid) {
    throw new AppError('이메일 또는 비밀번호가 잘못되었습니다.', 400);
  }

  return user;
}
```

### 5.4 SQL Injection 방지

**pg 파라미터 바인딩 필수:**

```javascript
// Backend: repositories/todoRepository.js

// Good: 파라미터 바인딩 사용
export async function findByUserId(userId) {
  const result = await db.query(
    'SELECT * FROM todos WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return result.rows;
}

export async function findById(id) {
  const result = await db.query(
    'SELECT * FROM todos WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

export async function create(todo) {
  const { user_id, title, description, due_date } = todo;
  const result = await db.query(
    'INSERT INTO todos (user_id, title, description, due_date, created_at, updated_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *',
    [user_id, title, description, due_date]
  );
  return result.rows[0];
}

export async function update(id, todo) {
  const { title, description, due_date, is_completed } = todo;
  const result = await db.query(
    'UPDATE todos SET title = $1, description = $2, due_date = $3, is_completed = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
    [title, description, due_date, is_completed, id]
  );
  return result.rows[0];
}

// Bad: 문자열 연결 (SQL Injection 취약)
export async function findByIdBad(id) {
  const result = await db.query(`SELECT * FROM todos WHERE id = ${id}`);
  return result.rows[0];
}

export async function createBad(todo) {
  const query = `INSERT INTO todos (user_id, title) VALUES (${todo.userId}, '${todo.title}')`;
  const result = await db.query(query);
  return result.rows[0];
}
```

### 5.5 CORS 설정

```javascript
// Backend: app.js
import cors from 'cors';
import { env } from './config/env.js';

app.use(cors({
  origin: env.corsOrigin, // 환경변수로 관리
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### 5.6 에러 응답 및 로깅

**운영 환경에서 스택 트레이스 미노출:**

```javascript
// Backend: middleware/errorHandler.js
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const isDevelopment = process.env.NODE_ENV === 'development';

  // 로깅 (항상 수행, 민감정보 제외)
  console.error('[ERROR]', {
    timestamp: new Date().toISOString(),
    statusCode,
    message: err.message,
    path: req.path,
    method: req.method,
    userId: req.user?.id // 민감하지 않은 정보만
  });

  const response = {
    success: false,
    error: {
      message: err.message,
      type: err.type || 'UNKNOWN_ERROR'
    }
  };

  // 운영 환경: 스택 트레이스 미노출
  if (isDevelopment) {
    response.error.stack = err.stack;
    response.error.details = err.details;
  }

  res.status(statusCode).json(response);
};

// Backend: middleware/logger.js
export const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log('[HTTP]', {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
  });

  next();
};

// Backend: app.js
app.use(requestLogger);
app.use(errorHandler);
```

---

## 6. 모노레포 구조

### 6.1 개요

이 프로젝트는 **npm workspaces** 기반 모노레포로 관리한다. Frontend와 Backend를 단일 저장소에서 관리하여 의존성 설치 일원화, 공통 설정 공유, 루트 단위 스크립트 실행을 지원한다.

```
todolist-app/                  # 모노레포 루트
├── frontend/                  # React 19 앱 (workspace: @todolist/frontend)
├── backend/                   # Node.js 24 앱 (workspace: @todolist/backend)
├── docs/                      # 프로젝트 문서
├── package.json               # 루트 패키지 (workspaces 설정, 공통 스크립트)
├── .gitignore                 # 전체 공통 Git 무시 목록
└── .eslintrc.json             # 공통 ESLint 기본 설정 (각 패키지에서 확장)
```

### 6.2 루트 package.json

```json
{
  "name": "todolist-app",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "frontend",
    "backend"
  ],
  "scripts": {
    "dev": "concurrently \"npm run dev -w frontend\" \"npm run dev -w backend\"",
    "dev:frontend": "npm run dev -w frontend",
    "dev:backend": "npm run dev -w backend",
    "build": "npm run build -w frontend",
    "test": "npm run test -w frontend && npm run test -w backend",
    "test:frontend": "npm run test -w frontend",
    "test:backend": "npm run test -w backend",
    "lint": "eslint frontend/src backend/src",
    "lint:fix": "eslint frontend/src backend/src --fix"
  },
  "devDependencies": {
    "concurrently": "^9.0.0",
    "eslint": "^9.0.0"
  }
}
```

> `concurrently` 패키지를 사용해 `npm run dev` 한 번으로 Frontend와 Backend 개발 서버를 동시에 실행한다.

### 6.3 루트 .gitignore

```gitignore
# 의존성
node_modules/
frontend/node_modules/
backend/node_modules/

# 빌드 산출물
frontend/dist/
frontend/build/

# 환경변수 (절대 커밋 금지)
.env
.env.local
.env.*.local
frontend/.env
frontend/.env.local
backend/.env
backend/.env.local

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# 로그
*.log
npm-debug.log*
```

### 6.4 워크스페이스 의존성 설치

```bash
# 루트에서 전체 의존성 설치 (frontend + backend 모두)
npm install

# 특정 워크스페이스에만 패키지 추가
npm install react-router-dom -w frontend
npm install express -w backend

# 루트 공통 도구 추가 (devDependency)
npm install concurrently -D -w todolist-app
```

### 6.5 개발 환경 실행 순서

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 파일 생성
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env

# 3. 개발 서버 동시 실행 (Frontend: 5173, Backend: 3000)
npm run dev
```

### 6.6 모노레포 규칙

| 규칙 | 내용 |
|---|---|
| 공통 devDependency | `eslint`, `concurrently` 등 빌드/린트 도구는 루트에 설치 |
| 패키지별 dependency | `react`, `express` 등 런타임 의존성은 각 워크스페이스에 설치 |
| 환경변수 | `.env` 파일은 각 워크스페이스 루트에 별도 관리, 루트에 두지 않음 |
| 공통 코드 공유 | Phase 1에서는 공유 패키지(`packages/shared`) 미사용, 필요 시 Phase 2에서 도입 |

---

## 7. Frontend 디렉토리 구조

```
frontend/
├── public/                     # 정적 파일 (index.html 서빙)
│   ├── favicon.ico
│   └── robots.txt
│
├── src/
│   ├── api/                    # API 클라이언트 및 호출 함수
│   │   ├── client.js           # Axios 인스턴스 설정
│   │   ├── todoApi.js          # 할일 API 호출 함수
│   │   ├── categoryApi.js      # 카테고리 API 호출 함수
│   │   └── authApi.js          # 인증 API 호출 함수
│   │
│   ├── assets/                 # 정적 파일 (이미지, 폰트 등)
│   │   ├── images/
│   │   │   └── logo.svg
│   │   └── fonts/
│   │       └── pretendard.woff2
│   │
│   ├── components/             # 재사용 가능한 React 컴포넌트
│   │   ├── common/             # 기본 UI 요소
│   │   │   ├── Button.jsx
│   │   │   ├── Input.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── Spinner.jsx
│   │   │   └── ErrorMessage.jsx
│   │   │
│   │   └── layout/             # 레이아웃 컴포넌트
│   │       ├── Header.jsx      # 상단 네비게이션
│   │       ├── Sidebar.jsx     # 사이드 메뉴 (필요시)
│   │       └── PageLayout.jsx  # 페이지 레이아웃
│   │
│   ├── hooks/                  # 커스텀 훅 (TanStack Query 포함)
│   │   ├── useTodos.js         # 할일 데이터 페칭 및 캐싱
│   │   ├── useCategories.js    # 카테고리 데이터 페칭 및 캐싱
│   │   ├── useAuth.js          # 인증 상태 관리
│   │   ├── useMutation.js      # 데이터 변경 작업
│   │   └── useLocalStorage.js  # 로컬 스토리지 상태 동기화
│   │
│   ├── pages/                  # 라우트 단위 페이지 컴포넌트
│   │   ├── auth/
│   │   │   ├── SignUpPage.jsx
│   │   │   └── SignInPage.jsx
│   │   │
│   │   ├── todo/
│   │   │   ├── TodoListPage.jsx
│   │   │   └── TodoDetailPage.jsx
│   │   │
│   │   ├── category/
│   │   │   └── CategoryPage.jsx
│   │   │
│   │   └── ErrorPage.jsx       # 에러 페이지
│   │
│   ├── stores/                 # Zustand 전역 상태 스토어
│   │   ├── authStore.js        # 사용자 인증 상태
│   │   └── uiStore.js          # UI 관련 전역 상태 (모달 열림, 사이드바 등)
│   │
│   ├── utils/                  # 순수 유틸리티 함수
│   │   ├── validation.js       # 입력 검증 함수
│   │   ├── formatDate.js       # 날짜 포맷팅
│   │   ├── errorHandler.js     # 에러 파싱 및 처리
│   │   └── localStorage.js     # 로컬 스토리지 헬퍼
│   │
│   ├── constants/              # 상수 정의
│   │   ├── TODO_STATUS.js      # 할일 상태 상수
│   │   ├── ERROR_MESSAGES.js   # 에러 메시지
│   │   ├── API_ENDPOINTS.js    # API 엔드포인트
│   │   └── VALIDATION.js       # 검증 규칙 (정규식, 길이 등)
│   │
│   ├── App.jsx                 # 라우팅 및 전역 설정
│   ├── main.jsx                # 진입점
│   └── index.css               # 전역 스타일 (Tailwind)
│
├── .env.example                # 환경변수 예시 (버전 관리)
├── .gitignore                  # Git 무시 파일
├── .eslintrc.json              # ESLint 설정
├── index.html                  # HTML 템플릿
├── package.json                # 의존성 및 스크립트
├── vite.config.js              # Vite 설정
└── tailwind.config.js          # Tailwind CSS 설정
```

### 7.1 주요 파일 역할 설명

| 디렉토리 | 파일/폴더 | 역할 |
|---------|----------|------|
| api/ | client.js | Axios 인스턴스 생성, 인터셉터 설정 |
| api/ | todoApi.js | 할일 관련 API 호출 함수 (fetchTodos, createTodo 등) |
| assets/ | - | 이미지, 폰트, 아이콘 등 정적 자산 |
| components/common/ | Button.jsx | 재사용 가능한 버튼 컴포넌트 |
| components/layout/ | Header.jsx | 상단 헤더 레이아웃 |
| hooks/ | useTodos.js | TanStack Query를 사용한 할일 데이터 페칭 커스텀 훅 |
| hooks/ | useAuth.js | 현재 사용자 정보 및 인증 상태 관리 |
| pages/todo/ | TodoListPage.jsx | 할일 목록 페이지 컴포넌트 |
| stores/ | authStore.js | 전역 인증 상태 (Zustand) |
| utils/ | formatDate.js | 날짜 형식 변환 유틸리티 |
| constants/ | TODO_STATUS.js | 할일 상태 상수 (active, overdue, completed) |

### 7.2 Frontend 의존성 예시

```
App.jsx
  ├── pages/todo/TodoListPage.jsx
  │   ├── hooks/useTodos.js
  │   │   └── api/todoApi.js
  │   │       └── api/client.js
  │   └── components/TodoList.jsx
  │       ├── components/TodoItem.jsx
  │       └── utils/formatDate.js
  │
  └── pages/auth/SignInPage.jsx
      ├── stores/authStore.js
      ├── hooks/useAuth.js
      ├── api/authApi.js
      └── utils/validation.js
```

---

## 8. Backend 디렉토리 구조

```
backend/
├── src/
│   ├── config/                 # 설정 파일 (DB, 환경변수)
│   │   ├── env.js              # 환경변수 로드 및 검증
│   │   ├── database.js         # PostgreSQL 연결 풀 설정
│   │   └── constants.js        # 전역 상수 (오류 타입, HTTP 상태 등)
│   │
│   ├── middleware/             # Express 미들웨어
│   │   ├── authMiddleware.js   # JWT 토큰 검증
│   │   ├── errorHandler.js     # 전역 에러 핸들러
│   │   ├── logger.js           # 요청/응답 로깅
│   │   ├── validation.js       # 요청 검증 (선택사항)
│   │   └── corsMiddleware.js   # CORS 설정
│   │
│   ├── routes/                 # Express 라우터 (URL 정의)
│   │   ├── todoRoutes.js       # /todos 라우트
│   │   ├── categoryRoutes.js   # /categories 라우트
│   │   ├── authRoutes.js       # /auth 라우트
│   │   └── index.js            # 모든 라우트 통합
│   │
│   ├── controllers/            # 요청 처리 및 응답 포맷팅
│   │   ├── todoController.js
│   │   ├── categoryController.js
│   │   └── authController.js
│   │
│   ├── services/               # 비즈니스 로직
│   │   ├── todoService.js      # 할일 비즈니스 로직
│   │   ├── categoryService.js  # 카테고리 비즈니스 로직
│   │   └── authService.js      # 인증 비즈니스 로직
│   │
│   ├── repositories/           # 데이터 접근 레이어 (SQL 쿼리)
│   │   ├── todoRepository.js   # 할일 DB 쿼리
│   │   ├── categoryRepository.js # 카테고리 DB 쿼리
│   │   ├── userRepository.js   # 사용자 DB 쿼리
│   │   └── baseRepository.js   # 공통 Repository 기본 클래스 (선택사항)
│   │
│   ├── utils/                  # 공통 유틸리티 함수
│   │   ├── jwt.js              # JWT 생성/검증
│   │   ├── bcrypt.js           # 비밀번호 해시/검증
│   │   ├── errorHandler.js     # 커스텀 에러 클래스
│   │   ├── validation.js       # 데이터 검증 헬퍼
│   │   └── logger.js           # 로깅 유틸리티
│   │
│   ├── validators/             # 요청 검증 스키마 (선택사항)
│   │   ├── todoValidator.js    # 할일 요청 검증
│   │   ├── authValidator.js    # 인증 요청 검증
│   │   └── categoryValidator.js # 카테고리 요청 검증
│   │
│   └── app.js                  # Express 앱 초기화 (미들웨어, 라우트 등록)
│
├── server.js                   # 서버 진입점 (포트 리스닝)
├── .env.example                # 환경변수 예시 (버전 관리)
├── .gitignore                  # Git 무시 파일
├── .eslintrc.json              # ESLint 설정
├── package.json                # 의존성 및 스크립트
└── jest.config.js              # Jest 테스트 설정
```

### 8.1 주요 파일 역할 설명

| 디렉토리 | 파일/폴더 | 역할 |
|---------|----------|------|
| config/ | env.js | 환경변수 로드, 검증, 내보내기 |
| config/ | database.js | PostgreSQL 연결 풀 생성 및 관리 |
| middleware/ | authMiddleware.js | JWT 토큰 검증, 사용자 정보 req.user에 할당 |
| middleware/ | errorHandler.js | 모든 에러를 공통 포맷으로 처리 |
| routes/ | todoRoutes.js | GET /todos, POST /todos 등 할일 라우트 정의 |
| controllers/ | todoController.js | 요청에서 데이터 추출 → Service 호출 → 응답 포맷팅 |
| services/ | todoService.js | 비즈니스 로직 (데이터 검증, 변환, 계산) |
| repositories/ | todoRepository.js | SQL 쿼리 실행 (INSERT, SELECT, UPDATE, DELETE) |
| utils/ | jwt.js | JWT 생성 및 검증 함수 |
| utils/ | bcrypt.js | 비밀번호 해시 및 검증 함수 |

### 8.2 Backend 의존성 흐름

```
server.js
  ├── app.js
  │   ├── middleware/ (전역 미들웨어: CORS, logger, errorHandler)
  │   │
  │   └── routes/index.js
  │       ├── routes/todoRoutes.js
  │       │   └── controllers/todoController.js
  │       │       └── services/todoService.js
  │       │           └── repositories/todoRepository.js
  │       │               └── config/database.js (PostgreSQL)
  │       │
  │       └── routes/authRoutes.js
  │           └── controllers/authController.js
  │               └── services/authService.js
  │                   ├── repositories/userRepository.js
  │                   └── utils/ (jwt.js, bcrypt.js)
  │
  └── config/env.js (모든 곳에서 접근 가능한 환경변수)
```

### 8.3 Backend 실행 흐름 (요청 → 응답)

```javascript
// 1. server.js에서 포트 리스닝 시작
// 2. Express 앱에서 요청 수신

// 3. 미들웨어 순서대로 실행
corsMiddleware → loggerMiddleware → authMiddleware → ...

// 4. 라우터 매칭 후 컨트롤러 호출
GET /todos → todoRoutes.js → todoController.getTodos()

// 5. 컨트롤러에서 서비스 호출
todoController.getTodos() → todoService.getTodosByUserId()

// 6. 서비스에서 비즈니스 로직 수행
todoService.getTodosByUserId() → todoRepository.findByUserId()

// 7. 리포지토리에서 SQL 쿼리 실행
todoRepository.findByUserId() → SELECT * FROM todos WHERE user_id = $1

// 8. 응답 전달 (역순)
Repository → Service → Controller → Response JSON
```

---

## 9. 구체적 예시: 할일 조회 흐름

### Frontend: 할일 목록 조회

```javascript
// 1. TodoListPage.jsx - 페이지 컴포넌트
import { useTodos } from '../../hooks/useTodos.js';
import TodoList from '../../components/TodoList.jsx';

export default function TodoListPage() {
  const { data: todos, isLoading, error } = useTodos();

  if (isLoading) return <div>로딩 중...</div>;
  if (error) return <div>오류: {error.message}</div>;

  return <TodoList todos={todos} />;
}

// 2. hooks/useTodos.js - 커스텀 훅 (TanStack Query)
import { useQuery } from '@tanstack/react-query';
import { fetchTodos } from '../api/todoApi.js';

export function useTodos(filters = {}) {
  return useQuery({
    queryKey: ['todos', filters],
    queryFn: () => fetchTodos(filters)
  });
}

// 3. api/todoApi.js - API 호출
import { apiClient } from './client.js';

export async function fetchTodos(filters) {
  const response = await apiClient.get('/todos', { params: filters });
  return response.data; // { success: true, data: [...] }
}

// 4. api/client.js - Axios 인스턴스
import axios from 'axios';
import { config } from '../config/env.js';

export const apiClient = axios.create({
  baseURL: config.apiBaseUrl
});

// 요청 인터셉터: 토큰 추가
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 응답 인터셉터: 응답 데이터 추출
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => Promise.reject(error)
);

// 5. components/TodoList.jsx - UI 렌더링
function TodoList({ todos }) {
  return (
    <div className="todo-list">
      {todos.length === 0 ? (
        <p>할일이 없습니다.</p>
      ) : (
        <ul>
          {todos.map(todo => (
            <TodoItem key={todo.id} todo={todo} />
          ))}
        </ul>
      )}
    </div>
  );
}
```

### Backend: 할일 목록 조회

```javascript
// 1. server.js - 진입점
import app from './src/app.js';
import { env } from './src/config/env.js';

app.listen(env.port, () => {
  console.log(`서버가 포트 ${env.port}에서 시작되었습니다.`);
});

// 2. app.js - Express 초기화
import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { authMiddleware } from './middleware/authMiddleware.js';
import { errorHandler } from './middleware/errorHandler.js';
import { loggerMiddleware } from './middleware/logger.js';
import { env } from './config/env.js';

const app = express();

// 미들웨어
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());
app.use(loggerMiddleware);

// 라우트
app.use('/api', routes);

// 에러 핸들러 (마지막)
app.use(errorHandler);

export default app;

// 3. routes/index.js - 라우트 통합
import todoRoutes from './todoRoutes.js';
import authRoutes from './authRoutes.js';

export default function setupRoutes(app) {
  app.use('/todos', todoRoutes);
  app.use('/auth', authRoutes);
}

// 4. routes/todoRoutes.js - 라우트 정의
import express from 'express';
import * as todoController from '../controllers/todoController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', authMiddleware, todoController.getTodos);
router.post('/', authMiddleware, todoController.createTodo);

export default router;

// 5. controllers/todoController.js - 요청 처리
import { AppError } from '../utils/errorHandler.js';
import * as todoService from '../services/todoService.js';

export const getTodos = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { status, categoryId } = req.query;

    // 필터 객체 구성
    const filters = {
      ...(status && { status }),
      ...(categoryId && { categoryId })
    };

    const todos = await todoService.getTodosByUserId(userId, filters);

    res.json({
      success: true,
      data: todos
    });
  } catch (error) {
    next(error);
  }
};

// 6. services/todoService.js - 비즈니스 로직
import { AppError } from '../utils/errorHandler.js';
import * as todoRepository from '../repositories/todoRepository.js';

export async function getTodosByUserId(userId, filters = {}) {
  if (!userId) {
    throw new AppError('사용자 ID가 필요합니다.', 400);
  }

  const todos = await todoRepository.findByUserId(userId);

  // 필터 적용
  let filtered = todos;
  if (filters.status) {
    filtered = filtered.filter(todo => todo.status === filters.status);
  }
  if (filters.categoryId) {
    filtered = filtered.filter(todo => todo.category_id === filters.categoryId);
  }

  // 데이터 전환 (camelCase로)
  return filtered.map(todo => ({
    id: todo.id,
    title: todo.title,
    dueDate: todo.due_date,
    isCompleted: todo.is_completed,
    createdAt: todo.created_at
  }));
}

// 7. repositories/todoRepository.js - DB 접근
import { db } from '../config/database.js';

export async function findByUserId(userId) {
  const result = await db.query(
    'SELECT * FROM todos WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return result.rows;
}

// 8. config/database.js - DB 연결
import pg from 'pg';
import { env } from './env.js';

const pool = new pg.Pool({
  connectionString: env.databaseUrl
});

export const db = {
  query: (text, params) => pool.query(text, params)
};
```

---

## 10. 체크리스트

이 문서의 원칙을 준수하는지 확인하기 위한 체크리스트입니다.

### 공통 원칙
- [ ] 각 파일/모듈은 하나의 책임만 수행하는가?
- [ ] UI, 비즈니스 로직, 데이터 접근이 명확히 분리되어 있는가?
- [ ] 모든 의존성이 명시적으로 선언되어 있는가?
- [ ] 에러 처리가 일관된 포맷으로 수행되는가?
- [ ] 환경별 설정이 분리되어 있는가?

### Frontend
- [ ] React 컴포넌트는 모두 함수형이고 기본 내보내기인가?
- [ ] 파일명이 규칙을 따르는가? (PascalCase for components, camelCase for others)
- [ ] 컴포넌트에서 직접 API 호출을 하지 않는가? (hooks를 통해서만)
- [ ] Zustand 스토어를 적절히 사용하고 있는가?
- [ ] TanStack Query를 통해 서버 상태를 관리하는가?

### Backend
- [ ] 레이어 간 의존성이 올바른 방향인가? (Routes → Controllers → Services → Repositories)
- [ ] SQL Injection을 방지하기 위해 파라미터 바인딩을 사용하는가?
- [ ] 민감한 정보(JWT_SECRET, DB_PASSWORD)가 환경변수로 관리되는가?
- [ ] 비밀번호가 bcrypt로 해시되어 저장되는가?
- [ ] 운영 환경에서 에러 스택 트레이스가 노출되지 않는가?

### 보안
- [ ] JWT는 HS-512 알고리즘을 사용하는가?
- [ ] 토큰 만료 시간이 설정되어 있는가?
- [ ] CORS가 환경변수로 관리되는가?
- [ ] 환경변수 필수값이 검증되는가?

---

## 참고 자료

- [Express.js 공식 문서](https://expressjs.com/)
- [React 공식 문서](https://react.dev/)
- [TanStack Query 문서](https://tanstack.com/query/)
- [Zustand 문서](https://github.com/pmndrs/zustand)
- [PostgreSQL 공식 문서](https://www.postgresql.org/docs/)
- [JWT.io](https://jwt.io/)
- [OWASP 보안 가이드](https://owasp.org/)

