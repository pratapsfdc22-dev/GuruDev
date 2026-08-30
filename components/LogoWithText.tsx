'use client'

import Image from 'next/image'
import Link from 'next/link'

interface LogoWithTextProps {
  href?: string | null
  size?: 'small' | 'default'
}

export function LogoWithText({ href, size = 'default' }: LogoWithTextProps): React.ReactElement {
  const sizeConfig = {
    small: { iconSize: 32, iconW: 32, iconH: 32, textSize: 'text-sm', taglineSize: 'text-xs' },
    default: { iconSize: 40, iconW: 40, iconH: 40, textSize: 'text-base', taglineSize: 'text-xs' },
  }

  const config = sizeConfig[size]

  const content = (
    <div className="flex items-center gap-3">
      <Image
        src="/images/V4-halo-gurudev-icon-64.png"
        width={config.iconW}
        height={config.iconH}
        alt="Guru Dev"
        className="rounded-full"
        priority
      />
      <div className="flex flex-col">
        <div className={`font-serif font-bold text-slate-50 leading-tight ${config.textSize}`}>
          Guru Dev
        </div>
        <div className={`text-slate-400 leading-tight ${config.taglineSize}`}>
          Your Ever Well-Wisher
        </div>
      </div>
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return <>{content}</>
}
