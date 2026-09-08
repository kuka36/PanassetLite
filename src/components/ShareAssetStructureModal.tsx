import { useEffect, useState } from 'react'
import { Download, Share2 } from 'lucide-react'
import Modal, { btnGhost, btnPrimary } from './Modal'
import { useSummary } from '../hooks/useSummary'
import {
  buildStructureShareData,
  canShareImageFile,
  downloadBlob,
  renderStructureSharePng,
  structureShareFilename,
} from '../utils/shareAssetStructureImage'
import { color } from '../theme/colors'

interface Props {
  open: boolean
  onClose: () => void
}

export default function ShareAssetStructureModal({ open, onClose }: Props) {
  const summary = useSummary()
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [canNativeFileShare, setCanNativeFileShare] = useState(false)

  useEffect(() => {
    if (!open) return

    let revoked: string | null = null
    let cancelled = false

    const run = async () => {
      setBusy(true)
      setError('')
      setPreviewUrl(null)
      setBlob(null)
      setCanNativeFileShare(false)
      try {
        const data = buildStructureShareData(summary)
        const png = await renderStructureSharePng(data)
        if (cancelled) return
        const url = URL.createObjectURL(png)
        revoked = url
        setBlob(png)
        setPreviewUrl(url)
        const file = new File([png], structureShareFilename(), { type: 'image/png' })
        setCanNativeFileShare(canShareImageFile(file))
      } catch (e) {
        if (!cancelled) setError((e as Error).message || '生成失败')
      } finally {
        if (!cancelled) setBusy(false)
      }
    }

    void run()

    return () => {
      cancelled = true
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [open, summary])

  if (!open) return null

  const onSave = () => {
    if (!blob) return
    downloadBlob(blob, structureShareFilename())
  }

  const onSystemShare = async () => {
    if (!blob) return
    setError('')
    try {
      const file = new File([blob], structureShareFilename(), { type: 'image/png' })
      await navigator.share({
        files: [file],
        title: '我的资产结构',
        text: '已脱敏 · 仅展示类型占比',
      })
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setError('系统分享不可用，请改用保存到设备')
    }
  }

  return (
    <Modal title="脱敏资产结构图" onClose={onClose} size="lg">
      <div className="space-y-4">
        <p className={color.alertInfo}>
          仅含各资产类型占比{summary.totalDebtCNY > 0 && summary.totalAssetsCNY > 0 ? '与负债率' : ''}
          ，不含金额、资产名称与流水。
        </p>

        <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-slate-100 bg-slate-50 p-3">
          {busy && <p className="text-sm text-slate-500">正在生成…</p>}
          {!busy && previewUrl && (
            <img
              src={previewUrl}
              alt="脱敏资产结构预览"
              className="max-h-[min(60vh,520px)] w-auto max-w-full rounded-lg shadow-sm"
            />
          )}
          {!busy && !previewUrl && error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        {error && previewUrl && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`${btnPrimary} inline-flex items-center gap-1.5`}
            onClick={onSave}
            disabled={!blob || busy}
          >
            <Download className="h-4 w-4" />
            保存到设备
          </button>
          {canNativeFileShare && (
            <button
              type="button"
              className={`${btnGhost} inline-flex items-center gap-1.5`}
              onClick={onSystemShare}
              disabled={!blob || busy}
            >
              <Share2 className="h-4 w-4" />
              系统分享
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
