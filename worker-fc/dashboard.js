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
    const label=t.date.slice(5);
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

    document.getElementById('hits').innerHTML=d.recentHits.map(h=>\`<tr>
      <td class="ts">\${fmt(h.ts)}</td><td>\${deviceTag(h.device)}</td>
      <td>\${h.browser}</td><td>\${h.os}</td>
      <td>\${h.country}</td><td style="color:#38bdf8">\${fmtPage(h.path)}</td>
    </tr>\`).join('');
  }catch(e){console.error(e);}
}
load();
setInterval(load,60000);
</script>
</body>
</html>`

module.exports = { DASHBOARD_HTML }
