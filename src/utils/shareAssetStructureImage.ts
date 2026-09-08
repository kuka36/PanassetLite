import { APP_SHARE_URL } from '../constants/share'
import { palette } from '../theme/colors'
import {
  ASSET_TYPE_COLOR,
  ASSET_TYPE_LABEL,
  type AssetType,
  type PortfolioSummary,
} from '../types'

export interface StructureSegment {
  type: AssetType
  label: string
  percent: number
  color: string
}

export interface StructureShareData {
  segments: StructureSegment[]
  /** 负债率 = totalDebt / totalAssets；无正资产时为 null */
  debtRatio: number | null
}

const CARD_W = 1080
const CARD_H = 1350

/** 从组合摘要提取脱敏结构（仅类型占比，无金额/名称） */
export function buildStructureShareData(summary: PortfolioSummary): StructureShareData {
  const total = summary.totalAssetsCNY
  const segments =
    total > 0
      ? summary.byType
          .filter((t) => t.type !== 'debt' && t.valueCNY > 0)
          .map((t) => ({
            type: t.type,
            label: ASSET_TYPE_LABEL[t.type],
            percent: (t.valueCNY / total) * 100,
            color: ASSET_TYPE_COLOR[t.type],
          }))
      : []

  const debtRatio =
    total > 0 && summary.totalDebtCNY > 0 ? summary.totalDebtCNY / total : null

  return { segments, debtRatio }
}

export function hasShareableStructure(summary: PortfolioSummary): boolean {
  return buildStructureShareData(summary).segments.length > 0
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function drawLogoMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const s = size / 32
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  roundRect(ctx, 2, 2, 28, 28, 7)
  ctx.fillStyle = palette.blue600
  ctx.fill()
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2.6
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(9, 22)
  ctx.lineTo(13, 14)
  ctx.lineTo(17, 18)
  ctx.lineTo(23, 9)
  ctx.stroke()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(23, 9, 2.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function formatPct(n: number): string {
  const rounded = Math.round(n * 10) / 10
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`
}

function drawDonut(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  segments: StructureSegment[],
) {
  let start = -Math.PI / 2
  for (const seg of segments) {
    const sweep = (seg.percent / 100) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(start) * outerR, cy + Math.sin(start) * outerR)
    ctx.arc(cx, cy, outerR, start, start + sweep)
    ctx.arc(cx, cy, innerR, start + sweep, start, true)
    ctx.closePath()
    ctx.fillStyle = seg.color
    ctx.fill()
    start += sweep
  }

  // 扇区边界白线，增强分隔
  start = -Math.PI / 2
  ctx.strokeStyle = palette.surface
  ctx.lineWidth = 4
  for (const seg of segments) {
    const x0 = cx + Math.cos(start) * innerR
    const y0 = cy + Math.sin(start) * innerR
    const x1 = cx + Math.cos(start) * outerR
    const y1 = cy + Math.sin(start) * outerR
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.stroke()
    start += (seg.percent / 100) * Math.PI * 2
  }
}

/** 绘制脱敏资产结构分享卡，返回 PNG Blob */
export async function renderStructureSharePng(data: StructureShareData): Promise<Blob> {
  if (data.segments.length === 0) {
    throw new Error('暂无资产可分享')
  }

  const canvas = document.createElement('canvas')
  canvas.width = CARD_W
  canvas.height = CARD_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布')

  // 背景
  ctx.fillStyle = palette.bg
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  // 主卡片
  const pad = 48
  const cardX = pad
  const cardY = pad
  const cardW = CARD_W - pad * 2
  const cardH = CARD_H - pad * 2
  roundRect(ctx, cardX, cardY, cardW, cardH, 32)
  ctx.fillStyle = palette.surface
  ctx.fill()
  ctx.strokeStyle = palette.surfaceBorder
  ctx.lineWidth = 2
  ctx.stroke()

  const contentX = cardX + 56
  let y = cardY + 56

  // 顶栏品牌
  drawLogoMark(ctx, contentX, y, 56)
  ctx.fillStyle = palette.textTitle
  ctx.font = '600 36px system-ui, -apple-system, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText('PanassetLite', contentX + 72, y + 28)
  y += 100

  // 标题
  ctx.fillStyle = palette.textTitle
  ctx.font = '700 52px system-ui, -apple-system, sans-serif'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('我的资产结构', contentX, y)
  y += 48

  ctx.fillStyle = palette.textMuted
  ctx.font = '400 28px system-ui, -apple-system, sans-serif'
  ctx.fillText('已脱敏 · 仅展示类型占比', contentX, y)
  y += 72

  // 环形图
  const donutCx = CARD_W / 2
  const donutCy = y + 220
  const outerR = 200
  const innerR = 118
  drawDonut(ctx, donutCx, donutCy, outerR, innerR, data.segments)

  ctx.fillStyle = palette.textMuted
  ctx.font = '500 24px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('类型占比', donutCx, donutCy)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  y = donutCy + outerR + 64

  // 图例
  const legendLeft = contentX
  const legendColW = (cardW - 112) / 2
  const rowH = 52
  data.segments.forEach((seg, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const lx = legendLeft + col * legendColW
    const ly = y + row * rowH

    ctx.beginPath()
    ctx.arc(lx + 12, ly - 8, 10, 0, Math.PI * 2)
    ctx.fillStyle = seg.color
    ctx.fill()

    ctx.fillStyle = palette.text
    ctx.font = '500 28px system-ui, -apple-system, sans-serif'
    ctx.fillText(seg.label, lx + 32, ly)

    const pct = formatPct(seg.percent)
    ctx.fillStyle = palette.textTitle
    ctx.font = '600 28px system-ui, -apple-system, sans-serif'
    const pctW = ctx.measureText(pct).width
    ctx.fillText(pct, lx + legendColW - 24 - pctW, ly)
  })

  const legendRows = Math.ceil(data.segments.length / 2)
  y += legendRows * rowH + 24

  if (data.debtRatio != null) {
    ctx.fillStyle = palette.textMuted
    ctx.font = '400 26px system-ui, -apple-system, sans-serif'
    ctx.fillText(`负债率 ${formatPct(data.debtRatio * 100)}（相对正资产合计）`, contentX, y)
    y += 48
  }

  // 底栏
  const footerY = cardY + cardH - 88
  ctx.strokeStyle = palette.surfaceBorder
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(contentX, footerY - 36)
  ctx.lineTo(cardX + cardW - 56, footerY - 36)
  ctx.stroke()

  ctx.fillStyle = palette.textMuted
  ctx.font = '400 22px system-ui, -apple-system, sans-serif'
  ctx.fillText('不含金额、资产名称与流水 · 本地生成', contentX, footerY)

  ctx.fillStyle = palette.blue600
  ctx.font = '500 24px system-ui, -apple-system, sans-serif'
  ctx.fillText(APP_SHARE_URL, contentX, footerY + 36)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('生成图片失败'))
    }, 'image/png')
  })
}

export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export function structureShareFilename(): string {
  return `panassetlite-structure-${new Date().toISOString().slice(0, 10)}.png`
}

export function canShareImageFile(file: File): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  )
}
