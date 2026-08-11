/*
 * JWT 认证中间件
 * - 所有 /api 路由（除 /api/auth/login 外）均需携带有效 JWT
 * - Token 通过 Authorization: Bearer <token> 传递
 * - 禁止匿名访问
 */
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// Express 中间件：校验 JWT
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "未登录，请先登录" });
  }
  const token = auth.slice(7);
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: "登录已过期，请重新登录" });
  }
  req.userId = decoded.userId;
  req.username = decoded.username;
  next();
}

module.exports = { signToken, verifyToken, requireAuth, JWT_SECRET, JWT_EXPIRES_IN };
