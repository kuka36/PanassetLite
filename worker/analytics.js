/**
 * PanassetLite Analytics Worker
 * Cloudflare Worker + KV 自建访问统计
 *
 * KV 免费版每日仅约 1000 次 put；合并为单 key 读写，且仅在 new=1 时写入。
 *
 *   stats:bundle → { total, days, sessions, recent }
 */

const ALLOWED_ORIGIN = 'https://kuka36.github.io';
const BUNDLE_KEY = 'stats:bundle';
const RECENT_MAX = 200;
const SESSION_TTL_MS = 300_000;
const TREND_DAYS = 30;

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

function clientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const ip = forwarded.split(',')[0]?.trim();
    if (ip) return ip;
  }
  for (const name of ['x-real-ip', 'ali-real-client-ip', 'cf-connecting-ip']) {
    const ip = request.headers.get(name)?.trim();
    if (ip) return ip;
  }
  return null;
}

function countryFromHeaders(request) {
  if (request.cf?.country) return request.cf.country;
  for (const name of ['cf-ipcountry', 'ali-ip-country', 'x-vercel-ip-country']) {
    const val = request.headers.get(name);
    if (val && /^[A-Za-z]{2}$/.test(val)) return val.toUpperCase();
  }
  return null;
}

/** Cloudflare cf.country、CDN 注入头，或 IP 地理库回退 */
async function resolveCountry(request) {
  const fromHeaders = countryFromHeaders(request);
  if (fromHeaders) return fromHeaders;

  const ip = clientIp(request);
  if (!ip || ip === '127.0.0.1' || ip.startsWith('10.') || ip.startsWith('192.168.')) {
    return '?';
  }

  try {
    const res = await fetch(`https://ipwho.is/${ip}`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return '?';
    const data = await res.json();
    if (data.success && data.country_code && /^[A-Z]{2}$/.test(data.country_code)) {
      return data.country_code;
    }
  } catch (err) {
    console.error('geo lookup failed:', err);
  }
  return '?';
}

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

function emptyBundle() {
  return { total: 0, days: {}, sessions: {}, recent: [] };
}

function pruneSessions(raw, cutoff = Date.now() - SESSION_TTL_MS) {
  for (const sid of Object.keys(raw)) {
    if (!raw[sid]?.ts || raw[sid].ts < cutoff) delete raw[sid];
  }
  return raw;
}

function pruneOldDays(days) {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - TREND_DAYS);
  const min = cutoff.toISOString().slice(0, 10);
  for (const date of Object.keys(days)) {
    if (date < min) delete days[date];
  }
  return days;
}

/** 从旧版分散 key 迁移（一次性，读到即写入 bundle） */
async function migrateLegacyBundle(env) {
  const bundle = emptyBundle();
  bundle.total = parseInt((await env.KV.get('counter:total')) || '0', 10);

  const now = new Date();
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const date = d.toISOString().slice(0, 10);
    const count = parseInt((await env.KV.get(`counter:day:${date}`)) || '0', 10);
    if (count) bundle.days[date] = count;
  }

  bundle.sessions = (await env.KV.get('stats:sessions', 'json')) || {};
  bundle.recent = (await env.KV.get('stats:recent', 'json')) || [];
  return bundle;
}

async function loadBundle(env) {
  const raw = await env.KV.get(BUNDLE_KEY, 'json');
  if (raw && typeof raw === 'object') {
    return {
      total: raw.total || 0,
      days: raw.days || {},
      sessions: raw.sessions || {},
      recent: Array.isArray(raw.recent) ? raw.recent : [],
    };
  }
  return migrateLegacyBundle(env);
}

async function saveBundle(env, bundle) {
  await env.KV.put(BUNDLE_KEY, JSON.stringify(bundle));
}

/** 新访问：单次 put 更新会话、近期记录与计数 */
async function recordNewVisit(env, sid, data) {
  const bundle = await loadBundle(env);
  pruneSessions(bundle.sessions);
  bundle.sessions[sid] = data;
  bundle.recent.unshift(data);
  if (bundle.recent.length > RECENT_MAX) bundle.recent.length = RECENT_MAX;
  bundle.total += 1;
  const day = todayKey();
  bundle.days[day] = (bundle.days[day] || 0) + 1;
  pruneOldDays(bundle.days);
  await saveBundle(env, bundle);
}

async function removeSession(env, sid) {
  const bundle = await loadBundle(env);
  if (!bundle.sessions[sid]) return;
  delete bundle.sessions[sid];
  await saveBundle(env, bundle);
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
        const country = await resolveCountry(request);
        const ua      = request.headers.get('user-agent') || '';
        const ts      = Date.now();
        const { device, browser, os } = parseUA(ua);

        const isNew = url.searchParams.get('new') === '1';
        // 免费 KV 每日 put 约 1000 次：仅 new=1（本会话首次）写入，页面切换不落库
        if (isNew) {
          const sessionData = { sid, path, ref, country, device, browser, os, ts };
          await recordNewVisit(env, sid, sessionData);
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
      if (sid) {
        try {
          await removeSession(env, sid);
        } catch (err) {
          console.error('/leave failed:', err);
        }
      }
      return new Response('ok', { headers: cors });
    }

    // ── /stats  实时统计数据（JSON）─────────────────────
    if (url.pathname === '/stats') {
      try {
        if (!env.KV) throw new Error('KV binding missing');

        const bundle = await loadBundle(env);
        const activeSessions = Object.values(pruneSessions(bundle.sessions));
        const recentHits = [...bundle.recent].sort((a, b) => b.ts - a.ts);

        const since24h = Date.now() - 86400_000;
        const daily = recentHits.filter((h) => h.ts > since24h);

        const countBy = (arr, key) =>
          arr.reduce((acc, h) => {
            acc[h[key]] = (acc[h[key]] || 0) + 1;
            return acc;
          }, {});

        const totalVisits = bundle.total;
        const todayVisits = bundle.days[todayKey()] || 0;

        const now = new Date();
        const trend = Array.from({ length: TREND_DAYS }, (_, i) => {
          const d = new Date(now);
          d.setUTCDate(d.getUTCDate() - (TREND_DAYS - 1 - i));
          const date = d.toISOString().slice(0, 10);
          return { date, count: bundle.days[date] || 0 };
        });

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
      } catch (err) {
        console.error('/stats failed:', err);
        return json(
          { ok: false, error: err instanceof Error ? err.message : String(err) },
          503,
          cors
        );
      }
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
const countryNames=new Intl.DisplayNames(['zh-CN'],{type:'region'});
function fmtCountry(code){
  const raw=(code||'').trim();
  if(!raw||raw==='?')return '未知';
  const upper=raw.toUpperCase();
  if(!/^[A-Z]{2}$/.test(upper))return raw;
  try{return countryNames.of(upper)||raw;}catch{return raw;}
}
function deviceTag(d){return '<span class="tag '+d+'">'+d+'</span>';}
const PAGE_LABEL={dashboard:'总览',assets:'资产',flows:'资产流水',strategies:'策略',settings:'设置'};
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
        <td>\${fmtCountry(s.country)}</td><td style="color:#38bdf8">\${fmtPage(s.path)}</td>
        <td class="ts">\${fmt(s.ts)}</td>
      </tr>\`).join('');
    }

    // recent hits
    document.getElementById('hits').innerHTML=d.recentHits.map(h=>\`<tr>
      <td class="ts">\${fmt(h.ts)}</td><td>\${deviceTag(h.device)}</td>
      <td>\${h.browser}</td><td>\${h.os}</td>
      <td>\${fmtCountry(h.country)}</td><td style="color:#38bdf8">\${fmtPage(h.path)}</td>
    </tr>\`).join('');
  }catch(e){console.error(e);}
}
load();
setInterval(load,60000);
</script>
</body>
</html>`;
