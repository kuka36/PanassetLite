import { useEffect, useState } from 'react'
import { BookOpen, Check, Copy, Share2 } from 'lucide-react'
import Modal, { btnGhost, btnPrimary, inputCls } from './Modal'
import LogoMark from './LogoMark'
import {
  ABOUT_URL,
  APP_SHARE_URL,
  SHARE_TAGLINE,
  buildShareText,
} from '../constants/share'
import { copyText } from '../utils/clipboard'
import { color } from '../theme/colors'
import { setShortcutLayerPaused } from '../keyboard/shortcutCatalog'

interface Props {
  open: boolean
  onClose: () => void
}

type FlashKind = 'link' | 'text' | null

function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

export default function ShareAppModal({ open, onClose }: Props) {
  const [flash, setFlash] = useState<FlashKind>(null)
  const [error, setError] = useState('')
  const nativeShare = canNativeShare()

  useEffect(() => {
    if (!open) return
    setShortcutLayerPaused(true)
    return () => setShortcutLayerPaused(false)
  }, [open])

  useEffect(() => {
    if (!flash) return
    const t = window.setTimeout(() => setFlash(null), 2500)
    return () => window.clearTimeout(t)
  }, [flash])

  if (!open) return null

  const handleClose = () => {
    setFlash(null)
    setError('')
    onClose()
  }

  const onCopyLink = async () => {
    setError('')
    try {
      await copyText(APP_SHARE_URL)
      setFlash('link')
    } catch {
      setError('复制失败，请手动选择链接')
    }
  }

  const onCopyText = async () => {
    setError('')
    try {
      await copyText(buildShareText())
      setFlash('text')
    } catch {
      setError('复制失败，请手动选择文案')
    }
  }

  const onSystemShare = async () => {
    setError('')
    try {
      await navigator.share({
        title: 'PanassetLite',
        text: buildShareText(),
        url: APP_SHARE_URL,
      })
    } catch (e) {
      // 用户取消分享不提示错误
      if ((e as Error).name === 'AbortError') return
      setError('系统分享不可用，请改用复制链接')
    }
  }

  return (
    <Modal title="分享应用" onClose={handleClose} size="md">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <LogoMark className="h-10 w-10 shrink-0" />
          <div>
            <div className="text-base font-semibold text-slate-800">PanassetLite</div>
            <div className="text-xs text-slate-500">{SHARE_TAGLINE}</div>
          </div>
        </div>

        <p className={color.alertInfo}>只分享软件地址，不会带出你的资产与流水。</p>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">应用链接</label>
          <div className="flex gap-2">
            <input className={inputCls} readOnly value={APP_SHARE_URL} onFocus={(e) => e.target.select()} />
            <button type="button" className={`${btnPrimary} shrink-0 inline-flex items-center gap-1.5`} onClick={onCopyLink}>
              {flash === 'link' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {flash === 'link' ? '已复制' : '复制链接'}
            </button>
          </div>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
        {flash === 'text' && !error && (
          <p className="text-xs text-blue-600">介绍文案已复制到剪贴板</p>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="button" className={`${btnGhost} inline-flex items-center gap-1.5`} onClick={onCopyText}>
            <Copy className="h-4 w-4" />
            复制介绍文案
          </button>
          {nativeShare && (
            <button type="button" className={`${btnGhost} inline-flex items-center gap-1.5`} onClick={onSystemShare}>
              <Share2 className="h-4 w-4" />
              系统分享
            </button>
          )}
          <a
            href={ABOUT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`${btnGhost} inline-flex items-center gap-1.5`}
          >
            <BookOpen className="h-4 w-4" />
            阅读介绍
          </a>
        </div>
      </div>
    </Modal>
  )
}
