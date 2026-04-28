-- =============================================================
-- TodoList Application — Database Schema
-- DBMS   : PostgreSQL
-- Encoding: UTF-8
-- =============================================================

-- -------------------------------------------------------------
-- 초기화 (재실행 시 기존 테이블 제거, 의존성 역순)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS todos;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;


-- =============================================================
-- 1. users
-- =============================================================
CREATE TABLE users (
    id          BIGSERIAL       PRIMARY KEY,
    email       VARCHAR(255)    NOT NULL,
    password    VARCHAR(255)    NOT NULL,
    created_at  TIMESTAMP       NOT NULL DEFAULT now(),

    CONSTRAINT uq_users_email UNIQUE (email)
);

COMMENT ON TABLE  users          IS '서비스 사용자';
COMMENT ON COLUMN users.email    IS '로그인 이메일 (전체 시스템 유일)';
COMMENT ON COLUMN users.password IS 'bcrypt 해시 비밀번호';


-- =============================================================
-- 2. categories
-- =============================================================
CREATE TABLE categories (
    id          BIGSERIAL       PRIMARY KEY,
    user_id     BIGINT          NOT NULL,
    name        VARCHAR(20)     NOT NULL,
    created_at  TIMESTAMP       NOT NULL DEFAULT now(),

    CONSTRAINT fk_categories_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE,

    CONSTRAINT uq_categories_user_name
        UNIQUE (user_id, name)
);

COMMENT ON TABLE  categories         IS '사용자 정의 할일 분류 그룹';
COMMENT ON COLUMN categories.user_id IS '카테고리 소유 사용자';
COMMENT ON COLUMN categories.name    IS '카테고리 이름 (사용자 내 유일, 최대 20자)';


-- =============================================================
-- 3. todos
-- =============================================================
CREATE TABLE todos (
    id           BIGSERIAL       PRIMARY KEY,
    user_id      BIGINT          NOT NULL,
    category_id  BIGINT,
    title        VARCHAR(50)     NOT NULL,
    description  VARCHAR(200),
    due_date     DATE,
    is_completed BOOLEAN         NOT NULL DEFAULT false,
    created_at   TIMESTAMP       NOT NULL DEFAULT now(),
    updated_at   TIMESTAMP       NOT NULL DEFAULT now(),

    CONSTRAINT fk_todos_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_todos_category
        FOREIGN KEY (category_id) REFERENCES categories (id)
        ON DELETE SET NULL
);

COMMENT ON TABLE  todos              IS '사용자가 등록한 할일';
COMMENT ON COLUMN todos.user_id      IS '할일 소유 사용자';
COMMENT ON COLUMN todos.category_id  IS '분류 카테고리 (선택, 카테고리 삭제 시 NULL)';
COMMENT ON COLUMN todos.title        IS '할일 제목 (최대 50자)';
COMMENT ON COLUMN todos.description  IS '할일 상세 내용 (최대 200자, 선택)';
COMMENT ON COLUMN todos.due_date     IS '종료일 (선택)';
COMMENT ON COLUMN todos.is_completed IS '완료 여부 (false=미완료, true=완료)';
COMMENT ON COLUMN todos.updated_at   IS '최종 수정 일시';


-- =============================================================
-- 인덱스
-- =============================================================

-- categories: user_id 기준 조회 (사용자별 카테고리 목록)
CREATE INDEX idx_categories_user_id
    ON categories (user_id);

-- todos: user_id 기준 조회 (사용자별 할일 목록) — 가장 빈번한 쿼리
CREATE INDEX idx_todos_user_id
    ON todos (user_id);

-- todos: category_id 기준 조회 (카테고리별 필터링)
CREATE INDEX idx_todos_category_id
    ON todos (category_id);

-- todos: 상태 필터링 (활성/기한초과 조회 시 is_completed + due_date 복합 조건)
CREATE INDEX idx_todos_user_status
    ON todos (user_id, is_completed, due_date);
