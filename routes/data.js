/*
 * 数据路由
 * - GET    /api/data       获取完整学习数据
 * - POST   /api/data       保存学习数据（自动生成加密备份）
 * - DELETE /api/data       清空学习数据（重置为空）
 * - POST   /api/data/import  导入 JSON 数据（从旧版本迁移）
 *
 * 数据以 JSONB 存储在 PostgreSQL，每次保存自动生成加密备份
 */
const express = require("express");
const { query } = require("../lib/db");
const { requireAuth } = require("../lib/auth");
const { encrypt } = require("../lib/crypto");

const router = express.Router();

// 所有路由都需要登录
router.use(requireAuth);

// 默认空数据结构
function defaultState() {
  return {
    createdAt: new Date().toISOString(),
    lastVisit: null,
    daily: {},
    exerciseLog: {},
    wrongBook: {},
    paperLog: {},
    notes: {},
    favorites: {}
  };
}

// 获取学习数据
router.get("/", async (req, res) => {
  try {
    const { rows } = await query("SELECT state FROM study_state WHERE user_id = $1", [req.userId]);
    if (rows.length === 0) {
      // 如果没有学习状态记录，创建一个
      const state = defaultState();
      await query("INSERT INTO study_state (user_id, state) VALUES ($1, $2)", [req.userId, JSON.stringify(state)]);
      return res.json(state);
    }
    const state = rows[0].state;
    // 合并默认值（防止旧数据缺少新字段）
    res.json(Object.assign(defaultState(), typeof state === "string" ? JSON.parse(state) : state));
  } catch (err) {
    console.error("[DATA] 获取失败:", err.message);
    res.status(500).json({ error: "获取数据失败" });
  }
});

// 保存学习数据（含自动备份）
router.post("/", async (req, res) => {
  const newData = req.body;
  if (!newData || typeof newData !== "object") {
    return res.status(400).json({ error: "无效的数据格式" });
  }
  try {
    newData.lastVisit = new Date().toISOString();
    const stateJson = JSON.stringify(newData);

    // Upsert 学习状态
    await query(`
      INSERT INTO study_state (user_id, state, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET state = $2, updated_at = NOW()
    `, [req.userId, stateJson]);

    // 自动生成加密备份
    try {
      const encrypted = encrypt(stateJson);
      await query(
        "INSERT INTO backups (user_id, encrypted_data, data_size) VALUES ($1, $2, $3)",
        [req.userId, encrypted, stateJson.length]
      );
      // 保留最近 20 条备份，删除更早的
      await query(`
        DELETE FROM backups
        WHERE user_id = $1
          AND id NOT IN (
            SELECT id FROM backups WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20
          )
      `, [req.userId]);
    } catch (encErr) {
      // 备份失败不阻塞数据保存
      console.warn("[DATA] 备份生成失败（不影响数据保存）:", encErr.message);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[DATA] 保存失败:", err.message);
    res.status(500).json({ error: "保存数据失败" });
  }
});

// 清空学习数据
router.delete("/", async (req, res) => {
  try {
    const state = defaultState();
    await query(`
      INSERT INTO study_state (user_id, state)
      VALUES ($1, $2)
      ON CONFLICT (user_id)
      DO UPDATE SET state = $2, updated_at = NOW()
    `, [req.userId, JSON.stringify(state)]);
    res.json({ success: true, message: "数据已清空" });
  } catch (err) {
    console.error("[DATA] 清空失败:", err.message);
    res.status(500).json({ error: "清空数据失败" });
  }
});

// 导入数据（从旧版本迁移）
router.post("/import", async (req, res) => {
  const importData = req.body;
  if (!importData || typeof importData !== "object") {
    return res.status(400).json({ error: "无效的导入数据" });
  }
  try {
    // 合并默认值
    const state = Object.assign(defaultState(), importData);
    state.lastVisit = new Date().toISOString();
    const stateJson = JSON.stringify(state);

    await query(`
      INSERT INTO study_state (user_id, state)
      VALUES ($1, $2)
      ON CONFLICT (user_id)
      DO UPDATE SET state = $2, updated_at = NOW()
    `, [req.userId, stateJson]);

    // 生成备份
    try {
      const encrypted = encrypt(stateJson);
      await query(
        "INSERT INTO backups (user_id, encrypted_data, data_size) VALUES ($1, $2, $3)",
        [req.userId, encrypted, stateJson.length]
      );
    } catch (e) {
      console.warn("[DATA] 导入备份生成失败:", e.message);
    }

    res.json({ success: true, message: "数据导入成功" });
  } catch (err) {
    console.error("[DATA] 导入失败:", err.message);
    res.status(500).json({ error: "导入数据失败" });
  }
});

module.exports = router;
