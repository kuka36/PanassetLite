# PanassetLite 访问统计（阿里云 FC + OSS）

替代 Cloudflare Worker + KV，解决大陆网络无法访问 `*.workers.dev` 导致统计缺失的问题。

## 架构

```
浏览器 (GitHub Pages)
    │  GET /hit  POST /leave
    ▼
阿里云 FC 3.0（HTTP 触发器）
    │  读写 stats/bundle.json
    ▼
OSS Bucket（单对象存储，等价于 KV bundle）
```

## 前置准备

1. **OSS Bucket**（与 FC 同地域，如 `cn-hangzhou`）
   - 无需公开读；由 FC 执行角色通过 RAM 访问
   - 标准存储即可，月访问量很小

2. **RAM 角色**（供 FC 扮演）
   - 信任主体：函数计算
   - 策略示例（将 `YOUR_BUCKET` 换成实际 Bucket）：

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["oss:GetObject", "oss:PutObject"],
      "Resource": ["acs:oss:*:*:YOUR_BUCKET/stats/*"]
    }
  ]
}
```

3. **（可选）Serverless Devs CLI**

```bash
npm install -g @serverless-devs/s
s config add
```

## 部署

### 方式 A：Serverless Devs（推荐）

编辑 `s.yaml` 中的 `ossBucket`、`roleArn`、`allowedOrigin`。

#### 首次部署（函数尚不存在）

```bash
cd worker-fc
npm install
s deploy
```

部署完成后控制台会输出 HTTP 触发器 URL，形如：

`https://panassetlite-analytics.cn-hangzhou.fcapp.run`

#### 日常更新代码（函数已存在，最常用）

函数和 HTTP 触发器已在控制台创建好后，**只更新代码**请用：

```bash
cd worker-fc
s deploy --function code -y
```

> **务必记住 `--function code`**：裸跑 `s deploy` 会尝试再次创建 HTTP 触发器，报错 `can not create more than one http trigger`；也会重复校验 `ram:PassRole`。

| 场景 | 命令 |
|------|------|
| 函数已存在，改代码后发布 | `s deploy --function code -y` |
| 只改环境变量/内存/超时 | `s deploy --function config -y` |
| 全新创建（函数还不存在） | `s deploy` |

### 方式 B：控制台手动创建

见下文「阿里云控制台部署」。

## 阿里云控制台部署

以下按实际操作顺序排列；**地域建议统一选华东 1（杭州）`cn-hangzhou`**。

### 第一步：创建 OSS Bucket

1. 打开 [对象存储 OSS 控制台](https://oss.console.aliyun.com/)
2. **Bucket 列表 → 创建 Bucket**
3. 填写：
   - **Bucket 名称**：全局唯一，如 `panassetlite-stats`（记下，后面要用）
   - **地域**：华东 1（杭州）
   - **存储类型**：标准存储
   - **读写权限**：私有（不要选公共读）
   - 其余保持默认
4. 创建完成即可，**不用**手动上传文件；函数首次写入时会自动创建 `stats/bundle.json`

### 第二步：创建 RAM 角色（FC 访问 OSS）

1. 打开 [RAM 控制台 → 角色](https://ram.console.aliyun.com/roles)
2. **创建角色**
   - **信任主体类型**：云产品
   - **云产品**：函数计算 / Function Compute
   - **角色名称**：如 `fc-panassetlite-analytics`
3. 创建后进入该角色 → **权限管理 → 新增授权** → **新建权限策略**（脚本编辑），粘贴（把 `panassetlite-stats` 换成你的 Bucket 名）：

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["oss:GetObject", "oss:PutObject"],
      "Resource": ["acs:oss:*:*:panassetlite-stats/stats/*"]
    }
  ]
}
```

4. 策略命名如 `fc-panassetlite-oss`，保存并授权给该角色
5. 在角色详情页复制 **ARN**，形如：`acs:ram::1234567890123456:role/fc-panassetlite-analytics`

### 第三步：创建函数（FC 3.0）

1. 打开 [函数计算 FC 控制台](https://fcnext.console.aliyun.com/)
2. 左上角地域选 **华东 1（杭州）**（与 OSS 一致）
3. **创建函数**
   - **创建方式**：从头开始创建
   - **函数类型**：事件函数（内置运行时 + HTTP 触发器即可）
   - **函数名称**：`panassetlite-analytics`
   - **运行环境**：Node.js 18
   - **请求处理程序**：`index.handler`
   - **内存**：256 MB
   - **执行超时**：30 秒
   - **执行角色**：选择第二步创建的 RAM 角色（**必配**，否则无法读写 OSS）

### 第四步：配置环境变量

函数详情 → **配置** → **环境变量**，新增：

| 键 | 值 | 说明 |
|----|-----|------|
| `ALLOWED_ORIGIN` | `https://kuka36.github.io` | GitHub Pages 站点源；多个用英文逗号分隔 |
| `OSS_BUCKET` | `panassetlite-stats` | 你的 Bucket 名称 |
| `OSS_REGION` | `cn-hangzhou` | 与 Bucket 地域一致（也支持 `oss-cn-hangzhou`） |

保存配置。

### 第五步：创建 HTTP 触发器

函数详情 → **触发器** → **创建触发器**：

| 项 | 值 |
|----|-----|
| 触发器类型 | HTTP 触发器 |
| 请求方法 | 勾选 **GET**、**POST**、**OPTIONS** |
| 认证方式 | 匿名访问 |

创建后复制 **公网访问地址**，形如：

`https://panassetlite-analytics-xxx.cn-hangzhou.fcapp.run`

### 第六步：打包并上传代码

在本地项目目录执行：

```bash
cd worker-fc
npm install
zip -r analytics-fc.zip index.js http-req.js stats-core.js storage-oss.js dashboard.js package.json node_modules
```

回到函数详情 → **代码** → **上传代码** → 选择 **通过 ZIP 包上传**，选中 `analytics-fc.zip` → 部署。

> ZIP 根目录需直接包含 `index.js` 和 `node_modules/`，不要多套一层 `worker-fc/` 文件夹。

### 第七步：验证

```bash
# 路径诊断（若 /hit 返回 HTML，先看实际解析到的 path）
curl "https://你的触发器地址/hit?debug=path"

# 上报（注意 p 参数里的 / 要编码为 %2F）
curl "https://你的触发器地址/hit?new=1&p=%2Ftest&sid=test-1"
curl "https://你的触发器地址/stats"
```

浏览器打开 `https://你的触发器地址/` 可查看内置面板。

### 第八步：接入前端

**本地开发**：项目根目录 `.env.local`：

```
VITE_ANALYTICS_URL=https://你的触发器地址
```

**GitHub Pages**：仓库 **Settings → Secrets and variables → Actions → Variables** 添加 `VITE_ANALYTICS_URL`，值同上。下次发版后前端即走 FC。

### 常见问题

| 现象 | 处理 |
|------|------|
| `can not create more than one http trigger` | 函数已有 HTTP 触发器；改用 `s deploy --function code -y` 只更新代码 |
| `ram:PassRole` 403 | 部署账号缺 PassRole 权限；或函数已存在时直接用 `--function code` 跳过 |
| `Assume role ... fail` | RAM 执行角色信任策略须为 `"Service": ["fc.aliyuncs.com"]`，不是 `RAM: root` |
| `缺少环境变量 OSS_BUCKET` | 检查环境变量是否保存、是否重新部署 |
| `FC 执行角色凭证不可用` | 函数未绑定 RAM 角色，或角色信任主体不是函数计算 |
| `AccessDenied` 读写 OSS | RAM 策略中 Bucket 名或路径 `stats/*` 写错 |
| 浏览器跨域失败 | `ALLOWED_ORIGIN` 必须与 Pages 地址完全一致（含 `https://`，无末尾 `/`） |
| `502 Internal Server Error` | 多为代码或依赖问题；查函数调用日志 |
| `/hit` 返回 HTML 面板 | 路径被识别为 `/`：确认函数类型为**事件函数**+ Node.js 18；重新上传含 `http-req.js` 的 zip；用 `?debug=path` 诊断 |
| 更新代码不生效 | 确认用了 `s deploy --function code -y`，或重新 zip 上传并点 **部署** |

浏览器打开 `https://xxx.fcapp.run/` 若直接**下载** HTML 而非渲染页面，是阿里云默认域名的已知限制（强制加 `Content-Disposition: attachment`），**不是地址写错**。

**处理方式（任选其一）：**

1. **绑定自定义域名**（推荐，可正常在浏览器打开面板）  
   FC 控制台 → **自定义域名** → 添加域名 → DNS 配置 CNAME → 绑定到本函数的 HTTP 触发器 → 用自定义域名访问 `/`

2. **不绑域名时查看数据**  
   - JSON：`curl "https://你的触发器地址/stats"`  
   - 或把下载下来的 HTML 用浏览器「打开文件」本地查看（体验较差）

自定义域名配置：[解决浏览器访问 HTTP 函数强制下载](https://help.aliyun.com/zh/functioncompute/fc/return-results-forcibly-downloaded-when-i-access-an-http-function-through-a-browser)

## 前端配置

本地开发（`.env.local`，勿提交）：

```bash
VITE_ANALYTICS_URL=https://你的函数.fcapp.run
```

GitHub Pages 自动部署：在仓库 **Settings → Secrets and variables → Actions → Variables** 添加：

| 变量名 | 值 |
|--------|-----|
| `VITE_ANALYTICS_URL` | FC HTTP 触发器地址 |
| `VITE_ANALYTICS_FALLBACK` | （可选）Cloudflare Worker 地址，双写 |

未配置 `VITE_ANALYTICS_URL` 时，前端仍回退到原 Cloudflare Worker。

## 验证

```bash
# 记录访问
curl "https://你的函数.fcapp.run/hit?new=1&p=/test&sid=test-1"

# 查看统计 JSON
curl "https://你的函数.fcapp.run/stats"

# 内置面板
open "https://你的函数.fcapp.run/"
```

## API

与 `worker/analytics.js`（Cloudflare 版）保持一致：

| 路径 | 方法 | 说明 |
|------|------|------|
| `/hit` | GET | 上报访问；`new=1` 时写入 |
| `/leave` | POST | 会话结束（sendBeacon） |
| `/stats` | GET | JSON 统计数据 |
| `/debug/geoip` | GET | 诊断 IP 与国家解析（见下方） |
| `/` | GET | 内置 HTML 面板 |

### 国家解析诊断

部署后若国家仍显示「未知」，先访问：

```bash
curl "https://你的触发器地址/debug/geoip"
```

返回示例：

```json
{
  "country": "CN",
  "source": "geo",
  "sourceIp": "1.2.3.4",
  "clientIp": "1.2.3.4",
  "ipHeaders": { "x-forwarded-for": "1.2.3.4" },
  "geo": { "country": "CN", "provider": "ip-api" }
}
```

- `sourceIp`：FC 3.0 的 `requestContext.http.sourceIp`（直连 HTTP 触发器时最可靠）
- `clientIp`：实际用于 geo 查询的 IP
- `geo.provider`：命中的 geo 服务（`ip-api` / `ipwho` / `ip-sb`）
- `reason: no_public_ip`：未拿到公网 IP；`geo_lookup_failed`：IP 有但 geo 全失败

也可在 `/hit` 加 `debug=1` 查看单次上报解析结果（不写 OSS 时仍返回诊断字段）。

## 费用参考

- FC：新用户 3 个月每月 15 万 CU 试用；本项目仅会话首次写入，用量极低
- OSS：标准存储 + 少量 PUT/GET，通常每月几分钱量级
- 出网：FC 试用含 CDT 流量赠送

## 与 Cloudflare 版差异

- 存储从 KV 改为 OSS 单文件 `stats/bundle.json`
- 无 `request.cf.country`；优先读 FC `sourceIp` + CDN 头，再依次尝试 ip-api / ipwho / ip-sb
- 需配置 RAM 角色与环境变量

Cloudflare 版仍保留在 `worker/`，可作为 `VITE_ANALYTICS_FALLBACK` 双写备用。
