/*
 * 数据库连接层
 * PostgreSQL 连接池，支持 Neon / Supabase / Render PostgreSQL
 * 数据库仅通过连接字符串访问，不暴露公网端口
 */
const { Pool } = require("pg");

let pool = null;

function getPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL 环境变量未设置");
  }
  pool = new Pool({
    connectionString,
    // Neon 等托管 PostgreSQL 要求 SSL
    ssl: connectionString.includes("sslmode=require") || connectionString.includes("neon") || connectionString.includes("supabase")
      ? { rejectUnauthorized: false }
      : false,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
  pool.on("error", (err) => {
    console.error("[DB] 连接池错误:", err.message);
  });
  return pool;
}

async function query(text, params) {
  const client = getPool();
  try {
    return await client.query(text, params);
  } catch (err) {
    console.error("[DB] 查询失败:", err.message);
    throw err;
  }
}

// 初始化数据库表 + 管理员账号
async function initDB() {
  const client = getPool();
  // 1. 建表
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS study_state (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      state JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id)
    );
    CREATE TABLE IF NOT EXISTS backups (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      encrypted_data TEXT NOT NULL,
      data_size INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_backups_user_created ON backups(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_study_state_user ON study_state(user_id);
  `);
  console.log("[DB] 表结构已就绪");

  // 2. 检查是否已有管理员
  const adminUser = process.env.ADMIN_USERNAME || "admin";
  const { rows } = await client.query("SELECT id, username FROM users WHERE username = $1", [adminUser]);

  const bcrypt = require("bcryptjs");

  if (rows.length === 0) {
    // 首次启动：创建管理员
    const adminPass = process.env.ADMIN_PASSWORD;
    if (!adminPass) {
      throw new Error("首次启动需要设置 ADMIN_PASSWORD 环境变量");
    }
    const hash = await bcrypt.hash(adminPass, 10);
    const { rows: newRows } = await client.query(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id",
      [adminUser, hash]
    );
    // 创建空学习状态
    await client.query(
      "INSERT INTO study_state (user_id, state) VALUES ($1, $2)",
      [newRows[0].id, JSON.stringify({})]
    );
    console.log(`[DB] 管理员账号已创建: ${adminUser}`);
  } else if (process.env.RESET_PASSWORD === "true") {
    // 密码重置
    const adminPass = process.env.ADMIN_PASSWORD;
    if (!adminPass) {
      throw new Error("RESET_PASSWORD=true 但未设置 ADMIN_PASSWORD");
    }
    const hash = await bcrypt.hash(adminPass, 10);
    await client.query("UPDATE users SET password_hash = $1 WHERE username = $2", [hash, adminUser]);
    console.log(`[DB] 管理员密码已重置为 ADMIN_PASSWORD`);
  }
}

module.exports = { getPool, query, initDB };
