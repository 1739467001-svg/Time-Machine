# 部署指南

让「时光机」联网调用百炼 / DashScope 生成变老图。推荐用 **Vercel** 快速测试（自带 HTTPS，摄像头开箱即用）；也可自托管到云服务器。

> ⚠️ **摄像头需要 HTTPS**（`https://` 或 `localhost`）。Vercel 自动提供 HTTPS；自托管必须自己配 TLS（见 [自托管](#二自托管docker--node)）。

---

## 环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `AGING_PROVIDER` | 是 | 生图设 `qwen`、`stepfun` 或 `gemini`；也可 `mock`（占位、不联网） |
| `DASHSCOPE_API_KEY` | qwen 时必填 | 百炼按量付费业务空间 API Key（`sk-` / `sk-ws`）；不能使用 `sk-sp-` Token/Coding Plan 密钥 |
| `DASHSCOPE_REGION` | 否 | `cn`=北京（默认）/ `intl`=新加坡。两地 key 与地址独立、不可混用 |
| `DASHSCOPE_BASE_URL` | 新版 `sk-ws` 必填 | 创建 API Key 时弹窗显示的 API Host，例如 `https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com` |
| `QWEN_IMAGE_MODEL` | 否 | 默认 `qwen-image-edit`，可改用账号支持的其它图像编辑模型 |
| `STEPFUN_API_KEY` | stepfun 时必填 | Step Plan 接口密钥 |
| `STEPFUN_BASE_URL` | 否 | 默认 `https://api.stepfun.com/step_plan/v1` |
| `STEPFUN_IMAGE_MODEL` | 否 | 默认 `step-image-edit-2` |

> 🔒 **绝不要把 key 写进代码或提交**。一律用平台的环境变量配置；`.env*` 已被 git 忽略。

---

## 一、部署到 Vercel（推荐用于测试）

Vercel 是 Next.js 的原生平台，自动识别本项目（含 pnpm），**无需额外配置文件**。

1. **导入仓库**：Vercel → Add New → Project → 选这个 Git 仓库（分支 `claude/keen-knuth-1pyxxz`）。框架会自动识别为 Next.js。
2. **配置环境变量**：Project → Settings → Environment Variables，加入（Production 和 Preview 都勾）：
   ```
   AGING_PROVIDER   = qwen
   DASHSCOPE_API_KEY = sk-ws-你的key
   DASHSCOPE_REGION = cn
   DASHSCOPE_BASE_URL = https://你的WorkspaceId.cn-beijing.maas.aliyuncs.com
   ```
3. **Deploy**。完成后 Vercel 给你一个 `https://xxx.vercel.app`，**自带 HTTPS，摄像头直接可用**。
4. 改了环境变量要 **重新部署**（Deployments → Redeploy）才生效。

### 建议：分两步降风险

先用占位引擎确认「部署管线 + 摄像头 + 时间轴」本身通了，再接真实生图：

1. 先设 `AGING_PROVIDER=mock` 部署 → 打开页面能拍照、出 7 张占位时间轴 → 说明 Vercel 这条链路 OK。
2. 再把 `AGING_PROVIDER` 改成 `qwen` 并填 key → 重新部署 → 出真实变老图。

### Vercel 注意事项

- **函数超时**：`/api/age` 已在代码里设 `maxDuration = 60`（秒）。生图较慢，Hobby（免费）套餐若仍超时，需要升级或换更快的模型。
- **函数区域与延迟**：Vercel 函数默认在美国区。北京业务空间跨境调用延迟较高；新加坡业务空间通常更快。**key、API Host 和 `DASHSCOPE_REGION` 必须属于同一地域**。
- **图像模型权限**：若百炼套餐未含图像模型，调用会返回配额/权限错误——需到百炼控制台开通。
- **密钥类型**：`sk-sp-` 是 Token Plan / Coding Plan 专属密钥，与百炼通用按量付费 API Key 不可混用；本项目当前的 Qwen-Image-Edit Provider 需要后者。
- **StepFun 图像接口**：Step Plan 的 `step-image-edit-2` 使用 `POST /images/edits` multipart 接口，不是 Chat Completions；项目已按该协议接入。

---

## 二、自托管（Docker / Node）

适合部署到自己的云服务器（如阿里云 ECS，与百炼同云最稳）。

### Docker Compose（推荐）

```bash
git clone <你的仓库> time-machine && cd time-machine
git checkout claude/keen-knuth-1pyxxz

# .env 与 docker-compose.yml 同级（已被忽略，不会提交）
cat > .env <<'EOF'
AGING_PROVIDER=qwen
DASHSCOPE_API_KEY=sk-你的key
DASHSCOPE_REGION=cn
EOF

docker compose up -d --build      # 监听 127.0.0.1:3000
docker compose logs -f
```

### 或：直接用 Node

```bash
pnpm install && pnpm build
AGING_PROVIDER=qwen DASHSCOPE_API_KEY=sk-... DASHSCOPE_REGION=cn pnpm start
# 用 pm2 / systemd 守护
```

### HTTPS（自托管时摄像头必需）

需要一个域名指向服务器。用 **Caddy** 自动签证书最省事，新建 `Caddyfile`：
```
your.domain.com {
    reverse_proxy 127.0.0.1:3000
}
```
```bash
caddy run --config ./Caddyfile
# 或：docker run -d --name caddy --network host \
#       -v $PWD/Caddyfile:/etc/caddy/Caddyfile -v caddy_data:/data caddy:2
```

<details>
<summary>Nginx + Certbot 替代方案</summary>

```nginx
server {
    listen 443 ssl;
    server_name your.domain.com;
    ssl_certificate     /etc/letsencrypt/live/your.domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your.domain.com/privkey.pem;
    client_max_body_size 10m;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
证书：`certbot --nginx -d your.domain.com`。安全组放行 80/443，不要对公网开放 3000。
</details>

---

## 三、验证 & 排错

**验证**：打开站点 → 允许摄像头 → 拍照 → 时间轴逐张生成真实变老图（引擎 `qwen`）。

| 现象 | 原因 / 处理 |
| --- | --- |
| 摄像头打不开 | 没走 HTTPS。Vercel 自带；自托管要配 TLS |
| 函数超时 / 504 | 生图太慢。已设 `maxDuration=60`；Hobby 套餐受限则升级或换更快模型 |
| 百炼 `InvalidApiKey` | key 与地域不匹配：北京用 `cn`、新加坡用 `intl` |
| 百炼 配额 / 权限错误 | 图像模型未开通/计费，去百炼控制台开通 |
| 返回结构异常 | `qwen-image-edit` 请求/响应若有调整，把日志里的报错发来，按需微调 `src/lib/aging/qwen-provider.ts` |

> 变老引擎**可插拔**（`src/lib/aging/`）。想换 `gemini` 或自托管模型，只改环境变量 / 加一个 Provider，前端无需改动。
