-- ===== 邓兰兰工作台 · 数据库 Schema =====
-- 适用于 PostgreSQL (Neon / Supabase / Render PostgreSQL)
-- 单用户架构：仅一个管理员账号，无注册入口

-- 用户表（单账号）
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  username    VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 学习状态表（JSONB 存储完整学习数据）
CREATE TABLE IF NOT EXISTS study_state (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  state       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 加密备份表（每次数据变更自动生成）
CREATE TABLE IF NOT EXISTS backups (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
  encrypted_data  TEXT NOT NULL,
  data_size       INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_backups_user_created ON backups(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_state_user ON study_state(user_id);

-- 自动更新 updated_at 触发器
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_users_updated
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_study_state_updated
  BEFORE UPDATE ON study_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
