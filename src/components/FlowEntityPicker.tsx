import { btnGhost, btnPrimary, inputCls, labelCls } from './Modal'

interface Option {
  id: string
  label: string
}

interface Props {
  label: string
  placeholder: string
  options: Option[]
  value: string
  onChange: (id: string) => void
  onCancel: () => void
  onContinue: () => void
}

/** 记流水前选择资产/策略的中间步骤 */
export default function FlowEntityPicker({
  label,
  placeholder,
  options,
  value,
  onChange,
  onCancel,
  onContinue,
}: Props) {
  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls}>{label}</label>
        <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className={btnGhost} onClick={onCancel}>
          取消
        </button>
        <button type="button" className={btnPrimary} disabled={!value} onClick={onContinue}>
          继续
        </button>
      </div>
    </div>
  )
}
