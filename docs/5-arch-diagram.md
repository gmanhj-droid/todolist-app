# 아키텍처 다이어그램

**변경이력**

| 버전 | 날짜 | 작성자 | 내용 |
|------|------|--------|------|
| 1.0.0 | 2026-04-28 | 최훈진 | 초판 작성 |

---

## 개요

이 문서는 Todo 리스트 애플리케이션의 시스템 아키텍처, 모노레포 구조, 도메인 모델, 그리고 인증 흐름을 시각화합니다.  
자세한 내용은 [PRD](./2-prd.md)와 [프로젝트 구조 설계 원칙](./4-project-structure.md)을 참고하세요.

---

## 1. 시스템 아키텍처

**설명**: 브라우저에서 데이터베이스까지의 3-tier 아키텍처로, 요청과 응답이 각 계층을 통과합니다.

```mermaid
graph TD
    A["Browser<br/>Web Client"]
    B["Frontend<br/>React 19"]
    C["Backend<br/>Node.js + Express"]
    D["PostgreSQL<br/>Database"]
    
    A -->|REST API| B
    B -->|REST API| C
    C -->|SQL| D
```

---

## 2. 모노레포 구조

**설명**: npm workspaces로 관리되는 모노레포의 디렉토리 계층 구조입니다.

```mermaid
graph TD
    root["todolist-app<br/>package.json<br/>workspaces"]
    
    fe["frontend/"]
    fe_src["src/"]
    fe_pkg["package.json"]
    
    be["backend/"]
    be_src["src/"]
    be_pkg["package.json"]
    
    docs["docs/"]
    
    root --> fe
    root --> be
    root --> docs
    
    fe --> fe_src
    fe --> fe_pkg
    
    be --> be_src
    be --> be_pkg
```

---

## 3. 도메인 모델 (ERD)

**설명**: 사용자, 카테고리, 할일의 관계를 표현하는 엔티티 관계도입니다.

```mermaid
erDiagram
    USER ||--o{ CATEGORY : creates
    USER ||--o{ TODO : creates
    CATEGORY ||--o{ TODO : groups
    
    USER {
        int id PK
        string email UK
        string password
        timestamp created_at
    }
    
    CATEGORY {
        int id PK
        int user_id FK
        string name
        timestamp created_at
    }
    
    TODO {
        int id PK
        int user_id FK
        int category_id FK "nullable"
        string title
        string description
        date due_date
        boolean is_completed
        timestamp created_at
        timestamp updated_at
    }
```

---

## 4. 인증 흐름

**설명**: 로그인 후 JWT 토큰 발급 및 이후 API 호출 시 토큰 검증 과정입니다.

```mermaid
sequenceDiagram
    participant Client
    participant Backend
    participant DB
    
    rect rgb(200, 220, 255)
    note over Client,DB: 로그인 (Sign In)
    Client ->> Backend: POST /auth/sign-in<br/>{ email, password }
    Backend ->> DB: SELECT * FROM users<br/>WHERE email = ?
    DB -->> Backend: User record
    Backend ->> Backend: bcrypt.compare(password)
    alt Password Valid
        Backend ->> Backend: Generate JWT<br/>HS-512
        Backend -->> Client: { token, user }
    else Password Invalid
        Backend -->> Client: 401 Unauthorized
    end
    end
    
    rect rgb(200, 255, 220)
    note over Client,DB: API 호출
    Client ->> Backend: GET /todos<br/>Authorization: Bearer {token}
    Backend ->> Backend: Verify JWT
    Backend ->> DB: SELECT * FROM todos<br/>WHERE user_id = ?
    DB -->> Backend: Todo records
    Backend -->> Client: { todos }
    end
```

---

## 관련 문서

- [PRD](./2-prd.md) — 제품 요구사항 정의
- [프로젝트 구조 설계 원칙](./4-project-structure.md) — 레이어별 책임과 구조
