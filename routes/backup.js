/*
 * 备份路由
 * - GET /api/backup/list     列出所有备份（时间、大小）
 * - GET /api/backup/latest   下载最新加密备份（.json.enc 文件）
 * - GET /api/backup/:id      下载指定备份
 *
 * 备份为 AES-256-GCM 加密的 JSON 文件，下载到本机后为加密状态
 */
const express = require("express");
const { query } = require("../lib/db");
const { requireAuth } = require("../lib/auth");

const router = express.Router();

router.use(requireAuth);

// 列出备份
router.get("/list", async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT id, data_size, created_at
      FROM backups
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 20
    `, [req.userId]);
    res.json(rows.map(r => ({
      id: r.id,
      size: r.data_size,
      date: r.created_at
    })));
  } catch (err) {
    console.error("[BACKUP] 列表失败:", err.message);
    res.status(500).json({ error: "获取备份列表失败" });
  }
});

// 下载最新备份
router.get("/latest", async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT id, encrypted_data, data_size, created_at
      FROM backups
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [req.userId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "暂无备份" });
    }
    const backup = rows[0];
    const dateStr = new Date(backup.created_at).toISOString().slice(0, 19).replace(/[:T]/g, "-");
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="backup-${dateStr}.json.enc"`);
    res.send(backup.encrypted_data);
  } catch (err) {
    console.error("[BACKUP] 下载最新失败:", err.message);
    res.status(500).json({ error: "下载备份失败" });
  }
});

// 下载指定备份
router.get("/:id", async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT encrypted_data, data_size, created_at
      FROM backups
      WHERE user_id = $1 AND id = $2
    `, [req.userId, parseInt(req.params.id, 10)]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "备份不存在" });
    }
    const backup = rows[0];
    const dateStr = new Date(backup.created_at).toISOString().slice(0, 19).replace(/[:T]/g, "-");
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="backup-${dateStr}.json.enc"`);
    res.send(backup.encrypted_data);
  } catch (err) {
    console.error("[BACKUP] 下载失败:", err.message);
    res.status(500).json({ error: "下载备份失败" });
  }
});

module.exports = router;
