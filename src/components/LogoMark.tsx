import { palette } from '../theme/colors'

export default function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect x="2" y="2" width="28" height="28" rx="7" fill={palette.blue600} />
      <path
        d="M9 22 L13 14 L17 18 L23 9"
        stroke="#fff"
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="23" cy="9" r="2.2" fill="#fff" />
    </svg>
  )
}
