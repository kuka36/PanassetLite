import type { PortfolioSummary, Settings } from '../types'
import { ASSET_TYPE_LABEL } from '../types'
import { postChatCompletions } from './llmClient'

/**
 * AI 智能顾问。
 * 第一层:内置规则引擎,完全本地运行,零配置可用 —— 风险评估、健康检查、配置建议。
 * 第二层:可选接入 OpenAI 兼容接口,生成更个性化的深度分析(仅发送汇总数字,不含资产名称之外的隐私)。
 */

export type InsightLevel = 'good' | 'info' | 'warn' | 'danger'

export interface Insight {
  level: InsightLevel
  title: string
  detail: string
}

export interface HealthReport {
  score: number // 0-100
  grade: string
  insights: Insight[]
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`

export function analyzePortfolio(summary: PortfolioSummary): HealthReport {
  const insights: Insight[] = []
  let score = 100
  const { totalAssetsCNY: assets, totalDebtCNY: debt, snapshots } = summary
  const positives = snapshots.filter((s) => s.asset.type !== 'debt' && s.valueCNY > 0)

  if (assets <= 0) {
    return {
      score: 0,
      grade: '—',
      insights: [
        {
          level: 'info',
          title: '暂无数据',
          detail: '先添加几项资产并记录交易,AI 顾问就能开始为你做风险评估和健康检查。',
        },
      ],
    }
  }

  // 1. 单一资产集中度
  const top = positives[0]
  if (top && top.valueCNY / assets > 0.5) {
    score -= 15
    insights.push({
      level: 'danger',
      title: '资产高度集中',
      detail: `「${top.asset.name}」占总资产 ${pct(top.valueCNY / assets)},超过一半。一旦该资产波动,整体财富会剧烈起伏,建议分散到不同类别。`,
    })
  } else if (top && top.valueCNY / assets > 0.3) {
    score -= 8
    insights.push({
      level: 'warn',
      title: '单一资产占比偏高',
      detail: `「${top.asset.name}」占总资产 ${pct(top.valueCNY / assets)}。占比超过 30% 时建议留意集中风险。`,
    })
  }

  // 2. 高波动资产(股票+加密)占比
  const volatile = summary.byType
    .filter((t) => t.type === 'stock' || t.type === 'crypto')
    .reduce((s, t) => s + t.valueCNY, 0)
  const volRatio = volatile / assets
  if (volRatio > 0.6) {
    score -= 15
    insights.push({
      level: 'danger',
      title: '高波动资产占比过高',
      detail: `股票 + 加密货币合计占 ${pct(volRatio)}。这意味着市场大跌时净资产可能缩水严重,建议把一部分转入存款或稳健理财。`,
    })
  } else if (volRatio > 0.4) {
    score -= 7
    insights.push({
      level: 'warn',
      title: '风险资产偏多',
      detail: `股票 + 加密货币合计占 ${pct(volRatio)},风格偏激进。如果近期有大额支出计划,考虑适当降低仓位。`,
    })
  }

  // 3. 加密货币单独提示
  const crypto = summary.byType.find((t) => t.type === 'crypto')?.valueCNY ?? 0
  if (crypto / assets > 0.15) {
    score -= 8
    insights.push({
      level: 'warn',
      title: '加密货币敞口较大',
      detail: `加密货币占 ${pct(crypto / assets)}。波动率远高于传统资产,一般建议控制在 5%–10% 以内。`,
    })
  }

  // 4. 现金缓冲
  const cash = summary.byType.find((t) => t.type === 'cash')?.valueCNY ?? 0
  const cashRatio = cash / assets
  if (cashRatio < 0.05) {
    score -= 10
    insights.push({
      level: 'warn',
      title: '应急现金偏少',
      detail: `现金类资产仅占 ${pct(cashRatio)}。建议保留 3–6 个月生活开支的活钱,避免急用钱时被迫割肉。`,
    })
  } else if (cashRatio > 0.5) {
    score -= 5
    insights.push({
      level: 'info',
      title: '现金闲置较多',
      detail: `现金类资产占 ${pct(cashRatio)}。长期看会被通胀稀释,可以考虑把一部分转入稳健理财提升收益。`,
    })
  } else {
    insights.push({
      level: 'good',
      title: '现金缓冲合理',
      detail: `现金类资产占 ${pct(cashRatio)},应急能力与资金效率比较平衡。`,
    })
  }

  // 5. 负债率
  if (debt > 0) {
    const debtRatio = debt / assets
    if (debtRatio > 0.6) {
      score -= 15
      insights.push({
        level: 'danger',
        title: '负债率偏高',
        detail: `负债占总资产 ${pct(debtRatio)}。杠杆较重,优先保证现金流稳定,避免新增负债。`,
      })
    } else if (debtRatio > 0.35) {
      score -= 7
      insights.push({
        level: 'warn',
        title: '负债需要关注',
        detail: `负债占总资产 ${pct(debtRatio)}。在可控范围内,但建议规划提前还款或控制消费贷。`,
      })
    } else {
      insights.push({
        level: 'good',
        title: '负债水平健康',
        detail: `负债占总资产 ${pct(debtRatio)},杠杆温和。`,
      })
    }
  }

  // 6. 低收益理财识别
  for (const s of snapshots) {
    if (s.asset.type === 'wealth' && s.recentAnnualized != null) {
      if (s.recentAnnualized < 0.02) {
        score -= 4
        insights.push({
          level: 'warn',
          title: `「${s.asset.name}」收益偏低`,
          detail: `最近区间年化约 ${pct(s.recentAnnualized)},低于 2%。对比同类产品后,可以考虑换仓收益更好的标的。`,
        })
      } else if (s.recentAnnualized > 0.035) {
        insights.push({
          level: 'good',
          title: `「${s.asset.name}」表现不错`,
          detail: `最近区间年化约 ${pct(s.recentAnnualized)},值得继续持有。`,
        })
      }
    }
  }

  // 7. 亏损资产
  const losers = snapshots.filter(
    (s) => s.asset.type !== 'debt' && s.netInvestedCNY > 0 && s.totalPnlCNY < -s.netInvestedCNY * 0.1,
  )
  for (const s of losers.slice(0, 3)) {
    score -= 3
    insights.push({
      level: 'warn',
      title: `「${s.asset.name}」浮亏较大`,
      detail: `累计盈亏 ${s.totalPnlCNY.toFixed(0)} 元(约 ${pct(s.totalPnlCNY / s.netInvestedCNY)})。回顾一下当初的买入逻辑是否仍然成立。`,
    })
  }

  // 8. 数据新鲜度:手动估值超过 45 天未更新
  const now = Date.now()
  const stale = snapshots.filter(
    (s) =>
      s.asset.priceSource === 'manual' &&
      s.asset.type !== 'cash' &&
      s.asset.type !== 'debt' &&
      s.lastUpdated &&
      now - Date.parse(s.lastUpdated) > 45 * 86400_000,
  )
  if (stale.length > 0) {
    score -= 4
    insights.push({
      level: 'info',
      title: '部分资产估值过期',
      detail: `${stale.map((s) => `「${s.asset.name}」`).join('、')}超过 45 天未更新估值。每月更新一次,收益率统计才准确。`,
    })
  }

  // 9. 类别多样性
  const typeCount = summary.byType.filter((t) => t.type !== 'debt' && t.valueCNY > 0).length
  if (typeCount >= 4) {
    insights.push({
      level: 'good',
      title: '资产类别多元',
      detail: `持有 ${typeCount} 个类别的资产,分散度较好。`,
    })
  }

  score = Math.max(0, Math.min(100, score))
  const grade = score >= 85 ? '优秀' : score >= 70 ? '良好' : score >= 55 ? '一般' : '需改善'
  const order: Record<InsightLevel, number> = { danger: 0, warn: 1, info: 2, good: 3 }
  insights.sort((a, b) => order[a.level] - order[b.level])
  return { score, grade, insights }
}

// ── LLM 增强(可选) ─────────────────────────────────────────────────────────

export function buildPortfolioBrief(summary: PortfolioSummary): string {
  const lines: string[] = []
  lines.push(`总资产 ¥${summary.totalAssetsCNY.toFixed(0)},负债 ¥${summary.totalDebtCNY.toFixed(0)},净资产 ¥${summary.netWorthCNY.toFixed(0)}`)
  lines.push('类别分布:' + summary.byType
    .map((t) => `${ASSET_TYPE_LABEL[t.type]} ¥${t.valueCNY.toFixed(0)}`)
    .join(','))
  lines.push('持仓明细:')
  for (const s of summary.snapshots) {
    if (s.valueCNY <= 0) continue
    const parts = [
      `- ${s.asset.name}(${ASSET_TYPE_LABEL[s.asset.type]}):市值 ¥${s.valueCNY.toFixed(0)}`,
    ]
    if (s.asset.type !== 'debt') {
      parts.push(`累计盈亏 ¥${s.totalPnlCNY.toFixed(0)}`)
      if (s.xirr != null) parts.push(`年化 ${(s.xirr * 100).toFixed(1)}%`)
      if (s.recentAnnualized != null)
        parts.push(`近期区间年化 ${(s.recentAnnualized * 100).toFixed(1)}%`)
    }
    lines.push(parts.join(','))
  }
  const h = summary.history
  if (h.length >= 2) {
    const monthAgoIdx = Math.max(0, h.length - 31)
    const delta = h[h.length - 1].netWorth - h[monthAgoIdx].netWorth
    lines.push(`近一个月净资产变动:¥${delta.toFixed(0)}`)
  }
  return lines.join('\n')
}

export async function fetchLlmAdvice(
  summary: PortfolioSummary,
  settings: Settings,
  question?: string,
): Promise<string> {
  const { baseUrl, apiKey, model } = settings.llm
  if (!apiKey) throw new Error('未配置 LLM API key,请到设置页填写(或仅使用本地规则分析)')

  const system =
    '你是一位专业、务实的个人理财顾问。基于用户的资产组合数据,用简体中文给出具体、可执行的建议。' +
    '直接给结论和理由,不要免责声明套话。用 markdown 列表组织内容,控制在 400 字以内。'
  const user = `我的资产组合如下:\n${buildPortfolioBrief(summary)}\n\n${
    question?.trim() || '请做一次整体健康检查:评估风险点、配置是否合理、哪些资产应该调整,并给出 3 条最重要的行动建议。'
  }`

  const res = await postChatCompletions(baseUrl, apiKey, {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.4,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`LLM 接口请求失败 (${res.status}): ${text.slice(0, 200)}`)
  }
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('LLM 返回内容为空')
  return content
}
