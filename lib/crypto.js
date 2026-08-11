/*
 * 备份加密/解密模块
 * AES-256-GCM 对称加密
 * - 密钥来自环境变量 BACKUP_ENCRYPTION_KEY（32字节 hex）
 * - 每次加密生成随机 IV，输出格式: iv:encryptedData:authTag（均为 hex）
 * - 用于每次数据变更时自动生成加密 JSON 备份
 */

const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM 推荐 12 字节 IV

function getKey() {
  const hex = process.env.BACKUP_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("BACKUP_ENCRYPTION_KEY 必须是 64 位十六进制字符串（32字节）");
  }
  return Buffer.from(hex, "hex");
}

function encrypt(plainText) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  // 格式: iv:encryptedData:authTag
  return `${iv.toString("hex")}:${encrypted}:${authTag}`;
}

function decrypt(encryptedStr) {
  const key = getKey();
  const parts = encryptedStr.split(":");
  if (parts.length !== 3) {
    throw new Error("加密数据格式错误");
  }
  const [ivHex, encryptedHex, authTagHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

module.exports = { encrypt, decrypt, getKey, ALGORITHM };
