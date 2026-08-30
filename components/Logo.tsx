import Image from 'next/image'

export function Logo({ size = 'default', variant = 'horizontal' }: { size?: 'small' | 'default' | 'large'; variant?: 'horizontal' | 'icon' }): React.ReactElement {
  const sizeMap = {
    small: { w: 120, h: 40 },
    default: { w: 240, h: 80 },
    large: { w: 400, h: 133 },
  }

  const dims = sizeMap[size]

  if (variant === 'horizontal') {
    return (
      <div className="relative" style={{ width: dims.w, height: dims.h }}>
        <Image
          src="/images/guru-dev-logo.png"
          alt="Guru Dev - Your Ever Well Wisher"
          width={dims.w}
          height={dims.h}
          priority
          className="object-contain"
        />
      </div>
    )
  }

  // Icon-only variant (just the guru figure if needed)
  return (
    <div className="relative" style={{ width: dims.w / 6, height: dims.h }}>
      <Image
        src="/images/guru-dev-logo.png"
        alt="Guru Dev"
        width={dims.w}
        height={dims.h}
        priority
        className="object-contain"
      />
    </div>
  )
}
