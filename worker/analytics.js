/**
 * PanassetLite Analytics Worker
 * Cloudflare Worker + KV 自建访问统计
 *
 * KV 结构：
 *   session:{sid}          → 活跃会话，TTL 5 分钟（心跳续期）
 *   hit:{ts}:{sid_prefix}  → 历史访问记录，TTL 30 天
 *   counter:total          → 累积总访问数（永久）
 *   counter:day:{YYYY-MM-DD} → 每日访问数，TTL 365 天
 */

const ALLOWED_ORIGIN = 'https://kuka36.github.io';
/** KV expirationTtl 上限为 365 天（秒） */
const DAY_COUNTER_TTL = 31536000;

const CORS = (origin) => ({
  'Access-Control-Allow-Origin': origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : '',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Vary': 'Origin',
});

// ── 工具 ──────────────────────────────────────────────
function parseUA(ua = '') {
  // 设备类型
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);
  const isTablet = /iPad|Tablet/i.test(ua);
  const device = isTablet ? 'Tablet' : isMobile ? 'Mobile' : 'Desktop';

  // 浏览器
  let browser = 'Other';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';

  // OS
  let os = 'Other';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X/i.test(ua) && !/iPhone|iPad/i.test(ua)) os = 'macOS';
  else if (/iPhone/i.test(ua)) os = 'iOS';
  else if (/iPad/i.test(ua)) os = 'iPadOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return { device, browser, os };
}

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

async function kvPut(env, key, value, ttl) {
  if (ttl) {
    await env.KV.put(key, value, { expirationTtl: ttl });
  } else {
    await env.KV.put(key, value);
  }
}

async function increment(env, key, ttl) {
  const cur = parseInt((await env.KV.get(key)) || '0', 10);
  await kvPut(env, key, String(cur + 1), ttl);
  return cur + 1;
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

// ── 主处理 ────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const cors = CORS(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // ── /hit  记录一次访问 / 心跳 ──────────────────────
    if (url.pathname === '/hit') {
      const debug = url.searchParams.get('debug') === '1';
      try {
        if (!env.KV) throw new Error('KV binding missing');

        const sid     = url.searchParams.get('sid') || crypto.randomUUID();
        const path    = url.searchParams.get('p')   || '/';
        const ref     = url.searchParams.get('r')   || '';
        const country = request.cf?.country          || '?';
        const ua      = request.headers.get('user-agent') || '';
        const ts      = Date.now();
        const { device, browser, os } = parseUA(ua);

        const sessionData = { path, ref, country, device, browser, os, ts };
        const payload = JSON.stringify(sessionData);

        // 活跃会话：5 分钟 TTL，心跳续期
        await kvPut(env, `session:${sid}`, payload, 300);

        // 首次访问：写历史记录 + 累积计数（失败不阻断心跳）
        const isNew = url.searchParams.get('new') === '1';
        if (isNew) {
          const results = await Promise.allSettled([
            kvPut(env, `hit:${ts}:${sid.slice(0, 8)}`, payload, 86400 * 30),
            increment(env, 'counter:total'),
            increment(env, `counter:day:${todayKey()}`, DAY_COUNTER_TTL),
          ]);
          const failed = results.filter((r) => r.status === 'rejected');
          if (failed.length) {
            console.error('/hit new writes failed:', failed.map((r) => r.reason));
          }
        }

        return json({ sid, ok: true }, 200, cors);
      } catch (err) {
        console.error('/hit failed:', err);
        const body = debug
          ? { ok: false, error: err instanceof Error ? err.message : String(err) }
          : { ok: false };
        // 统计为尽力而为：避免前端网络面板持续报 500
        return json(body, 200, cors);
      }
    }

    // ── /leave  主动离线 ───────────────────────────────
    if (url.pathname === '/leave') {
      const sid = url.searchParams.get('sid');
      if (sid) await env.KV.delete(`session:${sid}`);
      return new Response('ok', { headers: cors });
    }

    // ── /stats  实时统计数据（JSON）─────────────────────
    if (url.pathname === '/stats') {
      // 当前在线
      const sessionList = await env.KV.list({ prefix: 'session:' });
      const sessions = await Promise.all(
        sessionList.keys.map((k) => env.KV.get(k.name, 'json'))
      );
      const activeSessions = sessions.filter(Boolean);

      // 近期历史（最多取 200 条）
      const hitList = await env.KV.list({ prefix: 'hit:', limit: 200 });
      const hits    = await Promise.all(
        hitList.keys.map((k) => env.KV.get(k.name, 'json'))
      );
      const recentHits = hits.filter(Boolean).sort((a, b) => b.ts - a.ts);

      // 近 24h 聚合
      const since24h = Date.now() - 86400_000;
      const daily    = recentHits.filter((h) => h.ts > since24h);

      const countBy = (arr, key) =>
        arr.reduce((acc, h) => {
          acc[h[key]] = (acc[h[key]] || 0) + 1;
          return acc;
        }, {});

      // 累积计数
      const totalVisits = parseInt((await env.KV.get('counter:total')) || '0', 10);
      const todayVisits = parseInt((await env.KV.get(`counter:day:${todayKey()}`)) || '0', 10);

      // 近 30 天每日趋势
      const trend = [];
      const now = new Date();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setUTCDate(d.getUTCDate() - i);
        const key = d.toISOString().slice(0, 10);
        const val = parseInt((await env.KV.get(`counter:day:${key}`)) || '0', 10);
        trend.push({ date: key, count: val });
      }

      return json({
        activeCount  : activeSessions.length,
        activeSessions,
        totalVisits,
        todayVisits,
        last24hCount : daily.length,
        trend,
        byPage       : countBy(daily, 'path'),
        byDevice     : countBy(daily, 'device'),
        byBrowser    : countBy(daily, 'browser'),
        byOS         : countBy(daily, 'os'),
        byCountry    : countBy(daily, 'country'),
        recentHits   : recentHits.slice(0, 50),
      }, 200, cors);
    }

    // ── /  内置面板 HTML ────────────────────────────────
    if (url.pathname === '/' || url.pathname === '/dashboard') {
      return new Response(DASHBOARD_HTML, {
        headers: { 'Content-Type': 'text/html;charset=utf-8' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};

// ── 内置面板 ──────────────────────────────────────────
const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>PanassetLite · 访问统计</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;padding:24px}
  h1{font-size:1.4rem;font-weight:700;color:#38bdf8;margin-bottom:20px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:24px}
  .card{background:#1e293b;border-radius:12px;padding:16px}
  .card .label{font-size:.75rem;color:#94a3b8;margin-bottom:4px}
  .card .value{font-size:2rem;font-weight:700;color:#f0f9ff}
  .card.online .value{color:#4ade80}
  .card.total .value{color:#fbbf24}
  .card.today .value{color:#a78bfa}
  table{width:100%;border-collapse:collapse;background:#1e293b;border-radius:12px;overflow:hidden;margin-bottom:24px}
  th{background:#0ea5e9;color:#fff;padding:8px 12px;text-align:left;font-size:.8rem}
  td{padding:8px 12px;font-size:.82rem;border-top:1px solid #334155}
  tr:hover td{background:#263348}
  .tag{display:inline-block;padding:2px 8px;border-radius:999px;font-size:.72rem;font-weight:600}
  .Desktop{background:#1d4ed8;color:#bfdbfe}
  .Mobile{background:#7c3aed;color:#e9d5ff}
  .Tablet{background:#065f46;color:#a7f3d0}
  .refresh{background:#0ea5e9;color:#fff;border:none;border-radius:8px;padding:8px 20px;cursor:pointer;font-size:.85rem;margin-bottom:16px}
  .refresh:hover{background:#0284c7}
  .ts{color:#64748b;font-size:.75rem}
  h2{font-size:1rem;color:#94a3b8;margin:20px 0 10px}
  /* 趋势图 */
  .chart{background:#1e293b;border-radius:12px;padding:16px;margin-bottom:24px}
  .chart-title{font-size:.75rem;color:#94a3b8;margin-bottom:12px}
  .bars{display:flex;align-items:flex-end;gap:3px;height:80px}
  .bar-wrap{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px}
  .bar{width:100%;background:#0ea5e9;border-radius:2px 2px 0 0;min-height:2px;transition:height .3s}
  .bar:hover{background:#38bdf8}
  .bar-label{font-size:.55rem;color:#475569;writing-mode:vertical-rl;transform:rotate(180deg);max-height:30px;overflow:hidden}
</style>
</head>
<body>
<h1>📊 PanassetLite 实时统计</h1>
<button class="refresh" onclick="load()">↻ 刷新</button>
<div class="grid">
  <div class="card online"><div class="label">当前在线</div><div class="value" id="active">…</div></div>
  <div class="card total"><div class="label">累积总访问</div><div class="value" id="total">…</div></div>
  <div class="card today"><div class="label">今日访问</div><div class="value" id="today">…</div></div>
  <div class="card"><div class="label">近 24h 访问</div><div class="value" id="daily">…</div></div>
</div>

<div class="chart">
  <div class="chart-title">近 30 天每日访问趋势</div>
  <div class="bars" id="trend-bars"></div>
</div>

<h2>当前在线设备</h2>
<table>
  <thead><tr><th>设备</th><th>浏览器</th><th>OS</th><th>国家</th><th>页面</th><th>最后活跃</th></tr></thead>
  <tbody id="sessions"></tbody>
</table>

<h2>近期访问记录（50条）</h2>
<table>
  <thead><tr><th>时间</th><th>设备</th><th>浏览器</th><th>OS</th><th>国家</th><th>页面</th></tr></thead>
  <tbody id="hits"></tbody>
</table>

<script>
function fmt(ts){
  return new Date(ts).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
}
function deviceTag(d){return '<span class="tag '+d+'">'+d+'</span>';}
const PAGE_LABEL={dashboard:'总览',assets:'资产',transactions:'流水',settings:'设置'};
function fmtPage(p){
  const m=p.match(/(?:#\\/|\\/)([^/]+)$/);
  const id=m?m[1]:'';
  return PAGE_LABEL[id]?PAGE_LABEL[id]+' <span class="ts">'+p+'</span>':p;
}

function renderTrend(trend){
  const max=Math.max(...trend.map(t=>t.count),1);
  document.getElementById('trend-bars').innerHTML=trend.map(t=>{
    const h=Math.max(Math.round((t.count/max)*76),t.count>0?4:1);
    const label=t.date.slice(5); // MM-DD
    return \`<div class="bar-wrap" title="\${t.date}: \${t.count}次">
      <div class="bar" style="height:\${h}px"></div>
      <div class="bar-label">\${label}</div>
    </div>\`;
  }).join('');
}

async function load(){
  try{
    const r=await fetch('/stats');
    const d=await r.json();
    document.getElementById('active').textContent=d.activeCount;
    document.getElementById('total').textContent=d.totalVisits.toLocaleString();
    document.getElementById('today').textContent=d.todayVisits;
    document.getElementById('daily').textContent=d.last24hCount;

    if(d.trend) renderTrend(d.trend);

    // sessions
    const sb=document.getElementById('sessions');
    if(!d.activeSessions.length){
      sb.innerHTML='<tr><td colspan="6" style="color:#64748b;text-align:center">暂无在线设备</td></tr>';
    }else{
      sb.innerHTML=d.activeSessions.map(s=>\`<tr>
        <td>\${deviceTag(s.device)}</td><td>\${s.browser}</td><td>\${s.os}</td>
        <td>\${s.country}</td><td style="color:#38bdf8">\${fmtPage(s.path)}</td>
        <td class="ts">\${fmt(s.ts)}</td>
      </tr>\`).join('');
    }

    // recent hits
    document.getElementById('hits').innerHTML=d.recentHits.map(h=>\`<tr>
      <td class="ts">\${fmt(h.ts)}</td><td>\${deviceTag(h.device)}</td>
      <td>\${h.browser}</td><td>\${h.os}</td>
      <td>\${h.country}</td><td style="color:#38bdf8">\${fmtPage(h.path)}</td>
    </tr>\`).join('');
  }catch(e){console.error(e);}
}
load();
setInterval(load,15000);
</script>
</body>
</html>`;
