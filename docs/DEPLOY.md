# 部署指南（云服务器）

本指南把「时光机」部署到你自己的云服务器，让它联网调用百炼 / DashScope 生成变老图。

> ⚠️ **最重要的一条：摄像头需要 HTTPS。** 浏览器只在**安全上下文**（`https://` 或 `localhost`）下允许 `getUserMedia`。
> 用 `http://你的IP` 直接打开，摄像头会**无法启用**。所以生产部署务必配 HTTPS（见 [第 4 节](#4-https摄像头必需)）。

---

## 0. 准备

- 一台能联网的云服务器（建议**阿里云 ECS**，与百炼同云，访问 `dashscope.aliyuncs.com` 最稳）。
- 已安装 **Docker + Docker Compose**（推荐），或 **Node ≥ 22 + pnpm**。
- 一个**已开通图像模型**的百炼 API Key（图像模型 `qwen-image-edit` 需开通/计费）。
- 确认服务器能访问百炼域名：
  ```bash
  curl -i https://dashscope.aliyuncs.com    # 北京；新加坡为 dashscope-intl.aliyuncs.com
  ```

## 1. 环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `AGING_PROVIDER` | 是 | 部署生图设为 `qwen`（百炼）。也可 `gemini` 或 `mock` |
| `DASHSCOPE_API_KEY` | qwen 时必填 | 百炼 API Key |
| `DASHSCOPE_REGION` | 否 | `cn`=北京（默认）/ `intl`=新加坡。两地 key 与地址独立、不可混用 |
| `QWEN_IMAGE_MODEL` | 否 | 默认 `qwen-image-edit`，可改用账号支持的其它图像编辑模型 |

> 🔒 **绝不要把 key 写进代码或镜像。** 一律用环境变量 / `.env` 注入；`.env*` 已被 git 和 Docker 构建忽略。

## 2. 用 Docker Compose 部署（推荐）

```bash
# 1) 拉取代码
git clone <你的仓库地址> time-machine && cd time-machine
git checkout claude/keen-knuth-1pyxxz

# 2) 新建 .env（与 docker-compose.yml 同级，已被忽略，不会提交）
cat > .env <<'EOF'
AGING_PROVIDER=qwen
DASHSCOPE_API_KEY=sk-你的key
DASHSCOPE_REGION=cn
EOF

# 3) 构建并启动
docker compose up -d --build

# 4) 查看日志 / 状态
docker compose logs -f
docker compose ps
```

服务监听 `http://127.0.0.1:3000`（容器内 `0.0.0.0:3000`）。**先别直接对外暴露 3000**，下一步用反向代理加 HTTPS。

更新版本：`git pull && docker compose up -d --build`。

## 3. 不用 Docker：直接用 Node 跑

```bash
pnpm install
pnpm build
AGING_PROVIDER=qwen DASHSCOPE_API_KEY=sk-... DASHSCOPE_REGION=cn pnpm start
# 监听 3000；用 pm2 或 systemd 守护进程
```

用 pm2 守护示例：
```bash
pnpm add -g pm2
AGING_PROVIDER=qwen DASHSCOPE_API_KEY=sk-... pm2 start "pnpm start" --name time-machine
```

## 4. HTTPS（摄像头必需）

需要一个**域名**指向服务器。下面用 **Caddy**（自动签发并续期 Let's Encrypt 证书，最省事）。

新建 `Caddyfile`：
```
your.domain.com {
    reverse_proxy 127.0.0.1:3000
}
```
启动 Caddy（任选其一）：
```bash
# A) 系统安装的 caddy
caddy run --config ./Caddyfile

# B) 用 Docker 跑 caddy（与 app 同机）
docker run -d --name caddy --network host \
  -v $PWD/Caddyfile:/etc/caddy/Caddyfile \
  -v caddy_data:/data caddy:2
```
完成后用 `https://your.domain.com` 访问，摄像头即可正常工作。

<details>
<summary>用 Nginx + Certbot 的替代方案</summary>

```nginx
server {
    listen 443 ssl;
    server_name your.domain.com;
    ssl_certificate     /etc/letsencrypt/live/your.domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your.domain.com/privkey.pem;

    client_max_body_size 10m;   # 上传的人脸图（base64）
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
证书：`certbot --nginx -d your.domain.com`。
</details>

> 安全组 / 防火墙：放行 **80、443**；**不要**对公网开放 3000。

## 5. 验证

1. 浏览器开 `https://your.domain.com` → 能进入、允许摄像头、拍照。
2. 拍照后时间轴逐张生成真实变老图（引擎为 `qwen`）。
3. 服务器日志无报错；若某段失败，UI 可单独重试。

## 6. 排错

| 现象 | 原因 / 处理 |
| --- | --- |
| 摄像头打不开、无授权弹窗 | 没走 HTTPS。用域名 + TLS（第 4 节） |
| 生图报 `Host not in allowlist` | 出现在受限网络里；你自己的服务器一般不会，确认能直连百炼域名 |
| 百炼报 `InvalidApiKey` / 鉴权失败 | key 与地域不匹配。北京用 `cn`、新加坡用 `intl` |
| 百炼报 配额/欠费 | 图像模型未开通或未计费，去百炼控制台开通 |
| 首次调用返回结构异常 | `qwen-image-edit` 的请求/响应若有调整，把日志里的报错发来即可按需微调 Provider |

> 变老引擎是**可插拔**的（见 `src/lib/aging/`）。若想换 `gemini` 或自托管模型，只改环境变量 / 加一个 Provider，前端无需改动。
