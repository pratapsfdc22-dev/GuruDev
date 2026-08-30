export function Logo({ size = 'default' }: { size?: 'small' | 'default' | 'large' }): React.ReactElement {
  const sizeMap = {
    small: 'w-8 h-8',
    default: 'w-12 h-12',
    large: 'w-16 h-16',
  }

  const textSizeMap = {
    small: 'text-lg',
    default: 'text-2xl',
    large: 'text-4xl',
  }

  return (
    <div className={`flex items-center gap-2 ${sizeMap[size]}`}>
      <div className="relative w-full h-full">
        {/* Logo SVG with spiritual aesthetic */}
        <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Background circle */}
          <circle cx="32" cy="32" r="30" fill="#2a2a2a" stroke="#d4a574" strokeWidth="1.5" />

          {/* Saffron accent */}
          <path
            d="M32 12C22 12 14 20 14 30C14 40 22 46 32 46C42 46 50 40 50 30C50 20 42 12 32 12Z"
            fill="none"
            stroke="#d4a574"
            strokeWidth="1"
            opacity="0.6"
          />

          {/* Spiritual figure (simplified lotus hands) */}
          <g>
            {/* Head */}
            <circle cx="32" cy="18" r="4" fill="#d4a574" />
            {/* Body */}
            <rect x="30" y="23" width="4" height="12" fill="#c59966" />
            {/* Legs */}
            <line x1="31" y1="35" x2="29" y2="42" stroke="#c59966" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="33" y1="35" x2="35" y2="42" stroke="#c59966" strokeWidth="1.5" strokeLinecap="round" />
            {/* Arms in prayer position */}
            <line x1="30" y1="26" x2="26" y2="28" stroke="#d4a574" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="34" y1="26" x2="38" y2="28" stroke="#d4a574" strokeWidth="1.5" strokeLinecap="round" />
          </g>

          {/* Decorative elements */}
          <circle cx="20" cy="32" r="1.5" fill="#d4a574" opacity="0.5" />
          <circle cx="44" cy="32" r="1.5" fill="#d4a574" opacity="0.5" />
        </svg>
      </div>
    </div>
  )
}
