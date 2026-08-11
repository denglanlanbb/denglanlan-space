FROM node:20-slim

WORKDIR /app

# 安装依赖
COPY package.json ./
RUN npm install --production

# 复制项目文件
COPY . .

# 环境变量
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+ (process.env.PORT||3000) +'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
