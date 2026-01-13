import Image from 'next/image'

interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeMap = {
  sm: { icon: 36, text: 'text-lg' },
  md: { icon: 48, text: 'text-xl' },
  lg: { icon: 56, text: 'text-2xl' },
  xl: { icon: 64, text: 'text-3xl' },
}

export default function Logo({ className = '', size = 'lg' }: LogoProps) {
  const { icon, text } = sizeMap[size]

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image
        src="/fuelrx_logo.png"
        alt="FuelRx Logo"
        width={icon}
        height={icon}
        className="flex-shrink-0"
      />
      <span className={`${text} font-bold text-primary-600`}>
        Coach Hill&apos;s FuelRx
      </span>
    </div>
  )
}
