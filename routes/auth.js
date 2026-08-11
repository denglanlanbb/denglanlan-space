/*
 * 认证路由
 * - POST /api/auth/login        登录（返回 JWT）
 * - POST /api/auth/change-password  修改密码（需登录）
 * - GET  /api/auth/me           获取当前用户信息（需登录）
 *
 * 安全：无注册端点，单账号，密钥全走环境变量
 */
const express = require("express");
const bcrypt = require("bcryptjs");
const { query } = require("../lib/db");
const { signToken, requireAuth } = require("../lib/auth");

const router = express.Router();

// 登录
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "请输入用户名和密码" });
  }
  try {
    const { rows } = await query("SELECT id, username, password_hash FROM users WHERE username = $1", [username]);
    if (rows.length === 0) {
      return res.status(401).json({ error: "用户名或密码错误" });
    }
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "用户名或密码错误" });
    }
    const token = signToken({ userId: user.id, username: user.username });
    res.json({ token, username: user.username });
  } catch (err) {
    console.error("[AUTH] 登录错误:", err.message);
    res.status(500).json({ error: "登录失败" });
  }
});

// 获取当前用户信息
router.get("/me", requireAuth, async (req, res) => {
  try {
    const { rows } = await query("SELECT id, username, created_at FROM users WHERE id = $1", [req.userId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "用户不存在" });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "获取用户信息失败" });
  }
});

// 修改密码
router.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "请输入当前密码和新密码" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "新密码至少 6 位" });
  }
  try {
    const { rows } = await query("SELECT password_hash FROM users WHERE id = $1", [req.userId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "用户不存在" });
    }
    const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!ok) {
      return res.status(401).json({ error: "当前密码错误" });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, req.userId]);
    res.json({ success: true, message: "密码已修改" });
  } catch (err) {
    console.error("[AUTH] 改密错误:", err.message);
    res.status(500).json({ error: "修改密码失败" });
  }
});

module.exports = router;
