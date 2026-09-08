import { useEffect, useState } from 'react'
import { BookOpen, Check, Copy, PieChart, Share2 } from 'lucide-react'
import Modal, { btnGhost, btnPrimary, formGroupCls, inputCls } from './Modal'
import LogoMark from './LogoMark'
import ShareAssetStructureModal from './ShareAssetStructureModal'
import {
  ABOUT_URL,
  APP_SHARE_URL,
  SHARE_TAGLINE,
  buildShareText,
} from '../constants/share'
import { copyText } from '../utils/clipboard'
import { color } from '../theme/colors'
import { setShortcutLayerPaused } from '../keyboard/shortcutCatalog'
import { useSummary } from '../hooks/useSummary'
import { hasShareableStructure } from '../utils/shareAssetStructureImage'

interface Props {
  open: boolean
  onClose: () => void
}

type FlashKind = 'link' | 'text' | null

function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

export default function ShareAppModal({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return
    setShortcutLayerPaused(true)
    return () => setShortcutLayerPaused(false)
  }, [open])

  if (!open) return null

  return <ShareAppModalBody onClose={onClose} />
}

function ShareAppModalBody({ onClose }: { onClose: () => void }) {
  const [flash, setFlash] = useState<FlashKind>(null)
  const [error, setError] = useState('')
  const [structureOpen, setStructureOpen] = useState(false)
  const nativeShare = canNativeShare()
  const summary = useSummary()
  const canShareStructure = hasShareableStructure(summary)

  useEffect(() => {
    if (!flash) return
    const t = window.setTimeout(() => setFlash(null), 2500)
    return () => window.clearTimeout(t)
  }, [flash])

  const handleClose = () => {
    setFlash(null)
    setError('')
    setStructureOpen(false)
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
      if ((e as Error).name === 'AbortError') return
      setError('系统分享不可用，请改用复制链接')
    }
  }

  return (
    <>
      {!structureOpen && (
        <Modal title="分享" onClose={handleClose} size="md">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <LogoMark className="h-10 w-10 shrink-0" />
              <div>
                <div className="text-base font-semibold text-slate-800">PanassetLite</div>
                <div className="text-xs text-slate-500">{SHARE_TAGLINE}</div>
              </div>
            </div>

            <section className={`${formGroupCls} space-y-3`}>
              <h3 className="text-sm font-semibold text-slate-800">分享应用</h3>
              <p className={color.alertInfo}>
                只分享软件地址与介绍文案，不会带出你的资产与流水。
              </p>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">应用链接</label>
                <div className="flex gap-2">
                  <input
                    className={inputCls}
                    readOnly
                    value={APP_SHARE_URL}
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    type="button"
                    className={`${btnPrimary} shrink-0 inline-flex items-center gap-1.5`}
                    onClick={onCopyLink}
                  >
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
                  <button
                    type="button"
                    className={`${btnGhost} inline-flex items-center gap-1.5`}
                    onClick={onSystemShare}
                  >
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
            </section>

            <section className={`${formGroupCls} space-y-3`}>
              <h3 className="text-sm font-semibold text-slate-800">分享资产结构</h3>
              <p className={color.alertInfo}>
                仅导出各资产类型占比（及负债率），不含金额、资产名称与流水；需你主动生成。
              </p>
              <button
                type="button"
                className={`${btnPrimary} inline-flex items-center gap-1.5`}
                onClick={() => setStructureOpen(true)}
                disabled={!canShareStructure}
              >
                <PieChart className="h-4 w-4" />
                生成脱敏结构图
              </button>
              {!canShareStructure && (
                <p className="text-xs text-slate-500">暂无资产可分享</p>
              )}
            </section>
          </div>
        </Modal>
      )}

      <ShareAssetStructureModal open={structureOpen} onClose={() => setStructureOpen(false)} />
    </>
  )
}
