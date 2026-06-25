import { useRef, useState } from 'react'
import { useStore } from '../store'
import { StorageService } from '../services/storage'
import { fetchFxRates } from '../services/prices'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { btnGhost, btnPrimary, inputCls, labelCls } from '../components/Modal'
import { color } from '../theme/colors'
import { formatFxRate, staleUpdateCls } from '../utils/format'
import { isLocalLlmBaseUrl, isLocalLlmUnavailableOnRemoteHost } from '../services/llmClient'

const FX_STALE_DAYS = 7

export default function Settings() {
  const settings = useStore((s) => s.settings)
  const saveSettings = useStore((s) => s.saveSettings)
  const loadDemoData = useStore((s) => s.loadDemo)
  const reload = useStore((s) => s.reload)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [fx, setFx] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(settings.fxRates).map(([k, v]) => [k, formatFxRate(v)])),
  )
  const [finnhubKey, setFinnhubKey] = useState(settings.finnhubKey ?? '')
  const [llm, setLlm] = useState(settings.llm)
  const [llmSendAssetNames, setLlmSendAssetNames] = useState(settings.llmSendAssetNames !== false)
  const [llmContextPrivacy, setLlmContextPrivacy] = useState<'summary' | 'detailed'>(
    settings.llmContextPrivacy === 'summary' ? 'summary' : 'detailed',
  )

  const flash = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(''), 4000)
  }

  const saveFx = () => {
    const fxRates: Record<string, number> = {}
    for (const [k, v] of Object.entries(fx)) {
      const n = Number(v)
      if (n > 0) fxRates[k] = Number(n.toFixed(4))
    }
    saveSettings({ fxRates })
    setFx(Object.fromEntries(Object.entries(fxRates).map(([k, v]) => [k, formatFxRate(v)])))
    flash('汇率已保存')
  }

  const autoFx = async () => {
    try {
      const fxRates = await fetchFxRates(settings)
      saveSettings({ fxRates, fxUpdatedAt: Date.now() })
      setFx(Object.fromEntries(Object.entries(fxRates).map(([k, v]) => [k, formatFxRate(v)])))
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
      flash(`导入成功:${r.assets} 项资产、${r.transactions} 条流水`)
    } catch (e) {
      flash(`导入失败:${(e as Error).message}`)
    }
  }

  const loadDemo = () => {
    if (loadDemoData()) flash('演示数据已加载,去「总览」看看效果')
  }

  const clearAll = () => {
    if (!confirm('确定清空所有本地数据?建议先导出备份。此操作不可恢复!')) return
    useStore.getState().clearAll()
    flash('已清空')
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">设置</h1>
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
                step="0.0001"
                value={fx[k]}
                onChange={(e) => setFx({ ...fx, [k]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button className={btnPrimary} onClick={saveFx}>
            保存汇率
          </button>
          <button className={btnGhost} onClick={autoFx}>
            自动获取最新汇率
          </button>
          {settings.fxUpdatedAt && (
            <span
              className={`text-xs ${staleUpdateCls(new Date(settings.fxUpdatedAt).toISOString(), FX_STALE_DAYS)}`}
            >
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
        title="AI 助手 · LLM 接口(可选)"
        desc="OpenAI 兼容接口(默认 DeepSeek,亦可切换 OpenAI / 通义 / 本地 LM Studio·Ollama)。本地模型仅能在本机通过 npm run dev 使用;GitHub Pages 等云端部署请改用云端 API。仅在主动触发时发送数据。"
      >
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Base URL</label>
            <input
              className={inputCls}
              value={llm.baseUrl}
              onChange={(e) => setLlm({ ...llm, baseUrl: e.target.value })}
              placeholder="https://api.deepseek.com"
            />
            {isLocalLlmUnavailableOnRemoteHost(llm.baseUrl) && (
              <p className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
                当前页面部署在云端,无法访问你电脑上的本地模型。请改用 DeepSeek、OpenAI 等云端 API,或在本地通过 npm run dev 运行应用。
              </p>
            )}
            {isLocalLlmBaseUrl(llm.baseUrl) && !isLocalLlmUnavailableOnRemoteHost(llm.baseUrl) && (
              <p className="mt-1 text-xs text-slate-500">
                本地模型请填 http://127.0.0.1:端口/v1,通过 npm run dev 访问时会自动走代理避免 CORS。
              </p>
            )}
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
                placeholder="deepseek-chat / gpt-4o-mini"
              />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600">AI 助手发送给 LLM 的组合上下文</p>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="llmContextPrivacy"
                className="mt-0.5 accent-indigo-600"
                checked={llmContextPrivacy === 'summary'}
                onChange={() => setLlmContextPrivacy('summary')}
              />
              <span>
                仅汇总
                <span className="mt-0.5 block text-xs text-slate-500">
                  仅发送净资产、类别占比、健康评分标题等汇总数字,不含具体持仓名称与单项盈亏。
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="llmContextPrivacy"
                className="mt-0.5 accent-indigo-600"
                checked={llmContextPrivacy === 'detailed'}
                onChange={() => setLlmContextPrivacy('detailed')}
              />
              <span>
                含明细
                <span className="mt-0.5 block text-xs text-slate-500">
                  另含每项持仓的资产名称、市值、累计盈亏与年化收益率。
                </span>
              </span>
            </label>
          </div>
          <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-0.5 accent-indigo-600"
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
              saveSettings({ llm, llmSendAssetNames, llmContextPrivacy })
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
          <button className={btnPrimary} onClick={exportData}>
            导出备份(JSON)
          </button>
          <button className={btnGhost} onClick={() => fileRef.current?.click()}>
            导入备份
          </button>
          <button className={btnGhost} onClick={loadDemo}>
            加载演示数据
          </button>
          <button className={color.btnDanger} onClick={clearAll}>
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

      <p className="pb-6 text-center text-xs text-slate-400">
        PanassetLite · 本地优先 · 隐私至上 —— 不注册、不上传,你的财务数据只属于你。
      </p>
    </div>
  )
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-medium text-slate-800">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{desc}</p>
      </CardHeader>
      <CardBody className="pt-4">{children}</CardBody>
    </Card>
  )
}
