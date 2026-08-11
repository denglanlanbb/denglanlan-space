/*
 * 邓兰兰工作台 · 云端部署版 · Express 服务器
 *
 * 架构：
 * - 前端静态文件 (public/) 由 Express 直接提供
 * - API 路由 (/api/*) 处理认证、数据CRUD、备份
 * - 数据持久化在 PostgreSQL (Neon 等)
 * - 每次数据变更自动生成加密 JSON 备份
 *
 * 安全约束：
 * - 所有 /api/* 路由（除登录）强制 JWT 校验，禁止匿名访问
 * - 密钥/密码/凭证全部从环境变量读取，零硬编码
 * - 数据库仅通过连接字符串内网访问，不暴露公网端口
 * - 服务器不发起任何外部网络请求（仅数据库连接）
 * - 使用 helmet 添加安全响应头
 * - 使用 express-rate-limit 防止暴力破解
 */

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const path = require("path");
const { initDB } = require("./lib/db");

const app = express();
const PORT = process.env.PORT || 3000;

// ----- 安全中间件 -----
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("tiny"));

// 登录限流：防止暴力破解
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 10, // 最多 10 次尝试
  message: { error: "登录尝试过多，请 15 分钟后再试" },
  standardHeaders: true,
});
// API 通用限流
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  standardHeaders: true,
});

// ----- 静态文件 -----
app.use(express.static(path.join(__dirname, "public"), {
  maxAge: "1h",
  setHeaders: (res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
  },
}));

// ----- API 路由 -----
app.use("/api/auth/login", loginLimiter);
app.use("/api", apiLimiter);

app.use("/api/auth", require("./routes/auth"));
app.use("/api/data", require("./routes/data"));
app.use("/api/backup", require("./routes/backup"));

// 健康检查
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// SPA 回退：所有非 /api 路由返回 index.html
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: "资源不存在" });
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error("[SERVER] 错误:", err.message);
  res.status(500).json({ error: "服务器内部错误" });
});

// ----- 启动 -----
async function start() {
  try {
    await initDB();
    app.listen(PORT, () => {
      console.log(`[SERVER] 邓兰兰工作台已启动 → http://localhost:${PORT}`);
      console.log(`[SERVER] 环境: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (err) {
    console.error("[SERVER] 启动失败:", err.message);
    process.exit(1);
  }
}

start();
