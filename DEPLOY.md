# 邓兰兰工作台 · 云端部署指南

## 架构概览

```
用户浏览器 (电脑端)
    ↕ HTTPS
Render (免费托管) ← Express 服务器 (Node.js)
    ↹ 内网连接
Neon (免费 PostgreSQL) ← 数据持久化
```

- **前端**：静态 HTML/CSS/JS（Express 直接提供）
- **后端**：Express + JWT 认证 + AES-256-GCM 加密备份
- **数据库**：Neon 免费 PostgreSQL（0.5GB，7天 PITR 自动备份）
- **部署**：Render 免费托管（HTTPS 自动启用）
- **关闭电脑后**：公网网址仍可正常访问

> ⚠️ 本项目仅供个人学习测试，禁止用于正式业务。免费托管平台存在休眠、额度耗尽、服务中断风险。

---

## 第一步：创建 Neon 数据库（免费）

1. 访问 https://neon.tech 注册账号
2. 点击 **New Project** → 选择区域（推荐 Singapore 或 AWS US East）
3. 创建完成后，在 Dashboard 找到 **Connection String**
4. 复制连接字符串，格式类似：
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require
   ```
5. 保存好这个字符串，后面要用

> Neon 免费版：0.5GB 存储，7天 PITR（时间点恢复），足够个人使用。

---

## 第二步：生成密钥

在终端执行以下命令生成两个密钥：

```bash
# JWT 密钥（用于登录 Token 签名）
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 备份加密密钥（AES-256-GCM，32字节 = 64位十六进制）
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

保存好这两个密钥。

---

## 第三步：部署到 Render（免费）

### 方式 A：GitHub 仓库部署（推荐）

1. 将 `cloud-workbench/` 目录推送到 GitHub 仓库
2. 访问 https://render.com 注册账号
3. 点击 **New +** → **Web Service**
4. 连接你的 GitHub 仓库
5. 填写配置：
   - **Name**: `deng-lanlan-workbench`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: `Free`

### 方式 B：Render Blueprint（一键部署）

1. 将代码推送到 GitHub
2. 在 Render Dashboard 点击 **New +** → **Blueprint**
3. 选择你的仓库，Render 会自动读取 `render.yaml` 配置

---

## 第四步：配置环境变量

在 Render 的 **Environment** 页面添加以下变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `DATABASE_URL` | Neon 连接字符串 | 第一步复制的 |
| `JWT_SECRET` | 第一步生成的密钥 | JWT 签名密钥 |
| `ADMIN_USERNAME` | `admin` | 管理员用户名 |
| `ADMIN_PASSWORD` | 你的密码（如 `MyPass2027!`） | 至少 6 位 |
| `BACKUP_ENCRYPTION_KEY` | 第二步生成的 64 位 hex | 备份加密密钥 |
| `RESET_PASSWORD` | `false` | 密码重置开关 |
| `JWT_EXPIRES_IN` | `7d` | Token 有效期 |

> ⚠️ 所有密钥仅存在于 Render 环境变量中，不会写入代码或配置文件。

配置完成后点击 **Save Changes**，Render 会自动部署。

---

## 第五步：验证部署

1. 部署完成后，Render 会提供一个 HTTPS 公网地址，如：
   ```
   https://deng-lanlan-workbench.onrender.com
   ```
2. 打开该地址，应看到登录页面
3. 使用 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 登录
4. 登录后可看到完整的工作台界面

---

## 功能说明

### 数据存储
- 学习数据存储在 Neon PostgreSQL 数据库
- 每次数据变更自动生成 AES-256-GCM 加密备份（保留最近 20 条）
- 关闭电脑后数据不丢失，公网网址仍可访问

### 备份下载
- 在 **设置 → 加密备份** 页面点击"下载最新加密备份"
- 备份文件为 `.json.enc` 加密格式，保存到浏览器默认下载文件夹
- 建议将浏览器下载文件夹设为本机指定业务文件夹

### 数据导入
- 在 **设置 → 数据管理** 可导入之前导出的 JSON 数据
- 适用于从旧版本（本地版）迁移数据

### 修改密码
- 在 **设置 → 修改登录密码** 页面操作
- 需输入当前密码和新密码

### 忘记密码重置
1. 在 Render Dashboard → **Environment** 中设置 `RESET_PASSWORD` = `true`
2. 确保 `ADMIN_PASSWORD` 设置为你想要的新密码
3. Render 会自动重新部署，密码被重置
4. 重置后登录，然后将 `RESET_PASSWORD` 改回 `false`

### 安全约束
- ✅ 所有公网访问强制 JWT 登录
- ✅ 无注册入口，仅单账号
- ✅ 密钥/密码/凭证全部在环境变量
- ✅ 数据库仅内网连接（Neon 连接字符串），不暴露公网端口
- ✅ 服务器不发起外部网络请求
- ✅ helmet 安全头 + rate-limit 防暴力破解
- ✅ CSP 限制资源加载源

---

## 本地开发

```bash
# 1. 安装依赖
cd cloud-workbench
npm install

# 2. 创建 .env 文件
cp .env.example .env
# 编辑 .env 填写真实值

# 3. 启动服务器
npm start

# 4. 打开 http://localhost:3000
```

---

## 项目结构

```
cloud-workbench/
├── server.js              # Express 服务器入口
├── package.json           # 依赖配置
├── schema.sql             # 数据库建表语句
├── .env.example           # 环境变量模板
├── Dockerfile             # Docker 部署
├── render.yaml            # Render Blueprint 配置
├── DEPLOY.md              # 本文件
├── lib/
│   ├── db.js              # PostgreSQL 连接池 + 初始化
│   ├── auth.js            # JWT 认证中间件
│   └── crypto.js          # AES-256-GCM 加密/解密
├── routes/
│   ├── auth.js            # 登录/改密/用户信息
│   ├── data.js            # 数据CRUD + 自动备份
│   └── backup.js          # 备份列表/下载
└── public/                # 前端静态文件
    ├── index.html
    └── assets/
        ├── css/style.css
        └── js/
            ├── data.js    # 学习内容（三科/题库/真题）
            ├── api.js     # API 客户端（替代 localStorage）
            └── app.js     # 主逻辑
```
