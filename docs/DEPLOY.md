# 部署指南

让「时光机」联网调用百炼 / DashScope 生成变老图。推荐用 **Vercel** 快速测试（自带 HTTPS，摄像头开箱即用）；也可自托管到云服务器。

> ⚠️ **摄像头需要 HTTPS**（`https://` 或 `localhost`）。Vercel 自动提供 HTTPS；自托管必须自己配 TLS（见 [自托管](#二自托管docker--node)）。

---

## 零、先自检 API Key（30 秒，强烈建议）

正式部署前，先在**有外网的机器**上确认 key 能用、地域对、图像模型已开通，避免部署后才发现出图失败。仓库自带一个自检脚本（复刻了应用里 qwen 引擎的请求）：

```bash
# 只验证鉴权 / 地域 / 模型开通（用内置测试图）
DASHSCOPE_API_KEY=sk-你的key DASHSCOPE_REGION=intl node scripts/check-qwen.mjs

# 想顺便肉眼看变老效果：传入一张人脸照片，结果存到 ./qwen-out.png
DASHSCOPE_API_KEY=sk-你的key node scripts/check-qwen.mjs ./face.jpg
```

看到 `✓ 成功！` 即代表 key、地域、模型都 OK，可以放心部署。常见失败会给出定向提示：

- `✗ 鉴权失败` → key 抄错，或用错地域（北京 cn / 新加坡 intl 的 key 各自独立，换 `DASHSCOPE_REGION` 再试）。
- `model … not … / 未开通` → 到百炼控制台开通 `qwen-image-edit`（图像模型通常需单独开通/计费）。
- `网络请求失败 / Host not in allowlist` → 当前网络（如受限沙箱 / Claude Code 网页版的出网白名单）不允许访问 dashscope，换一台能上网的机器，或把 `dashscope-intl.aliyuncs.com`（及 `dashscope.aliyuncs.com`）加入该环境的出网白名单。

> 🔒 脚本只从环境变量读 key，绝不写文件、绝不提交。

---

## 环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `AGING_PROVIDER` | 是 | 生图设 `qwen`（百炼）；也可 `gemini` 或 `mock`（占位、不联网） |
| `DASHSCOPE_API_KEY` | qwen 时必填 | 百炼 API Key（账号需已**开通图像模型**/计费） |
| `DASHSCOPE_REGION` | 否 | `cn`=北京（默认）/ `intl`=新加坡。两地 key 与地址独立、不可混用 |
| `QWEN_IMAGE_MODEL` | 否 | 默认 `qwen-image-edit`，可改用账号支持的其它图像编辑模型 |

> 🔒 **绝不要把 key 写进代码或提交**。一律用平台的环境变量配置；`.env*` 已被 git 忽略。

---

## 一、部署到 Vercel（推荐用于测试）

Vercel 是 Next.js 的原生平台，自动识别本项目（含 pnpm），**无需额外配置文件**。

1. **导入仓库**：Vercel → Add New → Project → 选这个 Git 仓库（分支 `claude/keen-knuth-1pyxxz`）。框架会自动识别为 Next.js。
2. **配置环境变量**：Project → Settings → Environment Variables，加入（Production 和 Preview 都勾）：
   ```
   AGING_PROVIDER   = qwen
   DASHSCOPE_API_KEY = sk-你的key
   DASHSCOPE_REGION = cn
   ```
3. **Deploy**。完成后 Vercel 给你一个 `https://xxx.vercel.app`，**自带 HTTPS，摄像头直接可用**。
4. 改了环境变量要 **重新部署**（Deployments → Redeploy）才生效。

### 建议：分两步降风险

先用占位引擎确认「部署管线 + 摄像头 + 时间轴」本身通了，再接真实生图：

1. 先设 `AGING_PROVIDER=mock` 部署 → 打开页面能拍照、出 7 张占位时间轴 → 说明 Vercel 这条链路 OK。
2. 再把 `AGING_PROVIDER` 改成 `qwen` 并填 key → 重新部署 → 出真实变老图。

### Vercel 注意事项

- **函数超时**：`/api/age` 已在代码里设 `maxDuration = 60`（秒）。生图较慢，Hobby（免费）套餐若仍超时，需要升级或换更快的模型。
- **函数区域与延迟**：Vercel 函数默认在美国区。若你的 key 是**北京(cn)**，跨境调 `dashscope.aliyuncs.com` 能通但延迟较高；新加坡(intl) key 通常更快。**key 的地域要和 `DASHSCOPE_REGION` 一致**。
- **图像模型权限**：若百炼套餐未含图像模型，调用会返回配额/权限错误——需到百炼控制台开通。

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
