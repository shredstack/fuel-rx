'use client'

import NumericInput from './NumericInput'
import ProfilePhotoUpload from './ProfilePhotoUpload'

interface BasicInfoValues {
  name: string
  weight: number | null
  profile_photo_url: string | null
}

interface Props {
  values: BasicInfoValues
  onChange: (values: BasicInfoValues) => void
}

export default function BasicInfoEditor({ values, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Profile Photo (optional)
        </label>
        <ProfilePhotoUpload
          currentPhotoUrl={values.profile_photo_url}
          onPhotoChange={(url) => onChange({ ...values, profile_photo_url: url })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Name (optional)
        </label>
        <input
          type="text"
          value={values.name}
          onChange={(e) => onChange({ ...values, name: e.target.value })}
          className="input-field"
          placeholder="Your name"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Weight in lbs (optional)
        </label>
        <NumericInput
          value={values.weight || 0}
          onChange={(val) => onChange({ ...values, weight: val || null })}
          className="input-field"
          placeholder="e.g., 175"
          min={0}
          max={999}
        />
        <p className="mt-1 text-sm text-gray-500">
          Helps personalize recommendations
        </p>
      </div>
    </div>
  )
}
