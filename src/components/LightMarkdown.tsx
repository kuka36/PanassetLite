import { type ReactNode, useMemo } from 'react'

type Block =
  | { type: 'h1' | 'h2' | 'h3'; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={`${keyPrefix}-${i}`} className="font-semibold text-slate-200">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return part
  })
}

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }

    const h1 = line.match(/^#\s+(.+)/)
    if (h1) {
      blocks.push({ type: 'h1', text: h1[1].trim() })
      i++
      continue
    }
    const h2 = line.match(/^##\s+(.+)/)
    if (h2) {
      blocks.push({ type: 'h2', text: h2[1].trim() })
      i++
      continue
    }
    const h3 = line.match(/^###\s+(.+)/)
    if (h3) {
      blocks.push({ type: 'h3', text: h3[1].trim() })
      i++
      continue
    }

    const ulMatch = line.match(/^[-*]\s+(.+)/)
    if (ulMatch) {
      const items: string[] = []
      while (i < lines.length) {
        const m = lines[i].match(/^[-*]\s+(.+)/)
        if (!m) break
        items.push(m[1].trim())
        i++
      }
      blocks.push({ type: 'ul', items })
      continue
    }

    const olMatch = line.match(/^\d+\.\s+(.+)/)
    if (olMatch) {
      const items: string[] = []
      while (i < lines.length) {
        const m = lines[i].match(/^\d+\.\s+(.+)/)
        if (!m) break
        items.push(m[1].trim())
        i++
      }
      blocks.push({ type: 'ol', items })
      continue
    }

    blocks.push({ type: 'p', text: line.trim() })
    i++
  }

  return blocks
}

export default function LightMarkdown({ text }: { text: string }) {
  const blocks = useMemo(() => parseBlocks(text), [text])

  return (
    <div className="space-y-2">
      {blocks.map((block, i) => {
        const key = `${block.type}-${i}`
        switch (block.type) {
          case 'h1':
            return (
              <h2 key={key} className="text-base font-semibold text-slate-100">
                {renderInline(block.text, key)}
              </h2>
            )
          case 'h2':
            return (
              <h3 key={key} className="text-sm font-semibold text-slate-200">
                {renderInline(block.text, key)}
              </h3>
            )
          case 'h3':
            return (
              <h4 key={key} className="text-sm font-medium text-slate-200">
                {renderInline(block.text, key)}
              </h4>
            )
          case 'ul':
            return (
              <ul key={key} className="list-disc space-y-1 pl-5">
                {block.items.map((item, j) => (
                  <li key={j}>{renderInline(item, `${key}-${j}`)}</li>
                ))}
              </ul>
            )
          case 'ol':
            return (
              <ol key={key} className="list-decimal space-y-1 pl-5">
                {block.items.map((item, j) => (
                  <li key={j}>{renderInline(item, `${key}-${j}`)}</li>
                ))}
              </ol>
            )
          case 'p':
            return <p key={key}>{renderInline(block.text, key)}</p>
        }
      })}
    </div>
  )
}
