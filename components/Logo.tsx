import Image from 'next/image'

export function Logo({ size = 'default', variant = 'horizontal' }: { size?: 'small' | 'default' | 'large'; variant?: 'horizontal' | 'icon' }): React.ReactElement {
  const sizeMap = {
    small: { w: 200, h: 67 },
    default: { w: 400, h: 133 },
    large: { w: 600, h: 200 },
  }

  const dims = sizeMap[size]

  if (variant === 'horizontal') {
    return (
      <Image
        src="/images/guru-dev-logo.png"
        alt="Guru Dev - Your Ever Well Wisher"
        width={dims.w}
        height={dims.h}
        priority
        className="w-full h-auto object-contain"
      />
    )
  }

  // Icon-only variant (just the guru figure if needed)
  return (
    <Image
      src="/images/guru-dev-logo.png"
      alt="Guru Dev"
      width={dims.w}
      height={dims.h}
      priority
      className="w-auto h-auto object-contain"
    />
  )
}
