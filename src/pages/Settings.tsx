import { useRef, useState } from 'react'
import { useStore } from '../store'
import { StorageService } from '../services/storage'
import { fetchFxRates } from '../services/prices'
import { buildDemoData } from '../demoData'
import { btnGhost, btnPrimary, inputCls, labelCls } from '../components/Modal'
import { color } from '../theme/colors'

export default function Settings() {
  const settings = useStore((s) => s.settings)
  const saveSettings = useStore((s) => s.saveSettings)
  const reload = useStore((s) => s.reload)
  const assets = useStore((s) => s.assets)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [fx, setFx] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(settings.fxRates).map(([k, v]) => [k, String(v)])),
  )
  const [finnhubKey, setFinnhubKey] = useState(settings.finnhubKey ?? '')
  const [llm, setLlm] = useState(settings.llm)
  const [llmSendAssetNames, setLlmSendAssetNames] = useState(settings.llmSendAssetNames !== false)

  const flash = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(''), 4000)
  }

  const saveFx = () => {
    const fxRates: Record<string, number> = {}
    for (const [k, v] of Object.entries(fx)) {
      const n = Number(v)
      if (n > 0) fxRates[k] = n
    }
    saveSettings({ fxRates })
    flash('汇率已保存')
  }

  const autoFx = async () => {
    try {
      const fxRates = await fetchFxRates(settings)
      saveSettings({ fxRates, fxUpdatedAt: Date.now() })
      setFx(Object.fromEntries(Object.entries(fxRates).map(([k, v]) => [k, v.toFixed(4)])))
      flash('汇率已自动更新(Frankfurter/欧洲央行)')
    } catch (e) {
      flash(`自动更新失败:${(e as Error).message}`)
    }
  }

  const exportData = () => {
    const blob = new Blob([StorageService.exportAll()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `panassetlite-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importData = async (file: File) => {
    try {
      const text = await file.text()
      const r = StorageService.importAll(text)
      reload()
      flash(`导入成功:${r.assets} 项资产、${r.transactions} 条交易`)
    } catch (e) {
      flash(`导入失败:${(e as Error).message}`)
    }
  }

  const loadDemo = () => {
    if (assets.length > 0 && !confirm('当前已有数据,加载演示数据会覆盖它们。继续?')) return
    const demo = buildDemoData()
    StorageService.saveAssets(demo.assets)
    StorageService.saveTransactions(demo.transactions)
    StorageService.savePrices(demo.prices)
    reload()
    flash('演示数据已加载,去「总览」看看效果')
  }

  const clearAll = () => {
    if (!confirm('确定清空所有本地数据?建议先导出备份。此操作不可恢复!')) return
    useStore.getState().clearAll()
    flash('已清空')
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold text-slate-100">设置</h1>
      {msg && <p className={color.alertInfo}>{msg}</p>}

      <Section
        title="汇率"
        desc="非人民币资产按此汇率折算为 CNY 展示。可手动填写,或一键从免费接口更新。"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.keys(fx).map((k) => (
            <div key={k}>
              <label className={labelCls}>{k} → CNY</label>
              <input
                className={inputCls}
                type="number"
                step="any"
                value={fx[k]}
                onChange={(e) => setFx({ ...fx, [k]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button className={btnPrimary} onClick={saveFx}>保存汇率</button>
          <button className={btnGhost} onClick={autoFx}>自动获取最新汇率</button>
          {settings.fxUpdatedAt && (
            <span className="text-xs text-slate-500">
              上次更新:{new Date(settings.fxUpdatedAt).toLocaleString('zh-CN')}
            </span>
          )}
        </div>
      </Section>

      <Section
        title="行情 API(可选)"
        desc="加密货币行情使用 CoinGecko 免费接口,无需配置。美股行情需要 Finnhub 免费 key(finnhub.io 注册即得)。"
      >
        <label className={labelCls}>Finnhub API Key</label>
        <input
          className={inputCls}
          type="password"
          value={finnhubKey}
          onChange={(e) => setFinnhubKey(e.target.value)}
          placeholder="留空则美股资产手动估值"
        />
        <button
          className={`${btnPrimary} mt-3`}
          onClick={() => {
            saveSettings({ finnhubKey: finnhubKey.trim() || undefined })
            flash('已保存')
          }}
        >
          保存
        </button>
      </Section>

      <Section
        title="AI 顾问 · LLM 接口(可选)"
        desc="OpenAI 兼容接口(OpenAI / DeepSeek / 通义 / 本地 LM Studio·Ollama 均可)。本地模型请填 http://127.0.0.1:端口/v1,通过 npm run dev 访问时会自动走代理避免 CORS。仅在主动触发时发送数据:AI 顾问发送资产汇总数字;自然语言记一笔发送你的原文,并可选择是否附带资产名称列表。"
      >
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Base URL</label>
            <input
              className={inputCls}
              value={llm.baseUrl}
              onChange={(e) => setLlm({ ...llm, baseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>API Key</label>
              <input
                className={inputCls}
                type="password"
                value={llm.apiKey}
                onChange={(e) => setLlm({ ...llm, apiKey: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>模型</label>
              <input
                className={inputCls}
                value={llm.model}
                onChange={(e) => setLlm({ ...llm, model: e.target.value })}
                placeholder="gpt-4o-mini / deepseek-chat"
              />
            </div>
          </div>
          <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              className="mt-0.5 accent-sky-500"
              checked={llmSendAssetNames}
              onChange={(e) => setLlmSendAssetNames(e.target.checked)}
            />
            <span>
              自然语言记一笔时发送资产名称
              <span className="mt-0.5 block text-xs text-slate-500">
                关闭后仅发送你的原文与资产类别统计,匹配准确度可能下降。
              </span>
            </span>
          </label>
          <button
            className={btnPrimary}
            onClick={() => {
              saveSettings({ llm, llmSendAssetNames })
              flash('LLM 配置已保存')
            }}
          >
            保存
          </button>
        </div>
      </Section>

      <Section
        title="数据管理"
        desc="所有数据仅保存在当前浏览器的 LocalStorage 中。换设备或清缓存前,请先导出备份。"
      >
        <div className="flex flex-wrap gap-2">
          <button className={btnPrimary} onClick={exportData}>导出备份(JSON)</button>
          <button className={btnGhost} onClick={() => fileRef.current?.click()}>导入备份</button>
          <button className={btnGhost} onClick={loadDemo}>加载演示数据</button>
          <button
            className={color.btnDanger}
            onClick={clearAll}
          >
            清空全部数据
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) importData(f)
              e.target.value = ''
            }}
          />
        </div>
      </Section>

      <p className="pb-6 text-center text-xs text-slate-600">
        PanassetLite · 本地优先 · 隐私至上 —— 不注册、不上传,你的财务数据只属于你。
      </p>
    </div>
  )
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <h3 className="text-sm font-medium text-slate-200">{title}</h3>
      <p className="mb-4 mt-1 text-xs leading-relaxed text-slate-500">{desc}</p>
      {children}
    </div>
  )
}
