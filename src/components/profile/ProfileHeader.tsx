'use client'

import Image from 'next/image'

interface ProfileHeaderProps {
  displayName: string | null
  email: string
  mealPlanCount: number
  profilePhotoUrl?: string | null
}

export default function ProfileHeader({
  displayName,
  email,
  mealPlanCount,
  profilePhotoUrl
}: ProfileHeaderProps) {
  const initial = displayName?.[0]?.toUpperCase() || email[0].toUpperCase()

  return (
    <div className="text-white relative">
      {/* FuelRx Logo - positioned right of center */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-25">
        <Image
          src="/fuelrx_logo.png"
          alt="FuelRx"
          width={120}
          height={120}
          className="w-24 h-24 md:w-32 md:h-32"
        />
      </div>

      {/* Avatar */}
      {profilePhotoUrl ? (
        <div className="w-20 h-20 rounded-full overflow-hidden mb-3 ring-4 ring-white/20">
          <Image
            src={profilePhotoUrl}
            alt={displayName || 'Profile'}
            width={80}
            height={80}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl font-semibold mb-3 ring-4 ring-white/10">
          {initial}
        </div>
      )}

      <h1 className="text-2xl font-bold">
        {displayName || 'Athlete'}
      </h1>
      <p className="text-white/80 text-sm">{email}</p>

      {/* Fun stat */}
      <div className="mt-3 inline-flex items-center gap-2 bg-white/10 rounded-full px-3 py-1 text-sm">
        <span>🔥</span>
        <span>{mealPlanCount} meal plan{mealPlanCount !== 1 ? 's' : ''} generated</span>
      </div>
    </div>
  )
}
