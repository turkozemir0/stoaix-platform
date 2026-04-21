// Brand SVG icons for integration providers
// All icons render at the given size (default 20) with proper viewBox

interface IconProps {
  size?: number
  className?: string
}

export function WhatsAppIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
        fill="#25D366"
      />
    </svg>
  )
}

export function NetgsmIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect width="24" height="24" rx="6" fill="#1A56DB" />
      <text x="12" y="16.5" textAnchor="middle" fill="white" fontSize="9" fontWeight="700" fontFamily="Arial, sans-serif">
        NET
      </text>
    </svg>
  )
}

export function VerimorIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect width="24" height="24" rx="6" fill="#059669" />
      <text x="12" y="17" textAnchor="middle" fill="white" fontSize="13" fontWeight="700" fontFamily="Arial, sans-serif">
        V
      </text>
    </svg>
  )
}

export function TwilioIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect width="24" height="24" rx="6" fill="#F22F46" />
      <circle cx="9.5" cy="9.5" r="2" fill="white" />
      <circle cx="14.5" cy="9.5" r="2" fill="white" />
      <circle cx="9.5" cy="14.5" r="2" fill="white" />
      <circle cx="14.5" cy="14.5" r="2" fill="white" />
    </svg>
  )
}

export function TelnyxIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect width="24" height="24" rx="6" fill="#00C08B" />
      <path d="M7 7h10v3H14v7h-4v-7H7V7z" fill="white" />
    </svg>
  )
}

export function GoogleCalendarIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M18 3h-1V2a1 1 0 00-2 0v1H9V2a1 1 0 00-2 0v1H6a3 3 0 00-3 3v12a3 3 0 003 3h12a3 3 0 003-3V6a3 3 0 00-3-3z" fill="#4285F4" />
      <rect x="5" y="9" width="14" height="11" rx="1" fill="white" />
      <rect x="7" y="11" width="3" height="2.5" rx="0.5" fill="#EA4335" />
      <rect x="10.5" y="11" width="3" height="2.5" rx="0.5" fill="#34A853" />
      <rect x="14" y="11" width="3" height="2.5" rx="0.5" fill="#FBBC04" />
      <rect x="7" y="14.5" width="3" height="2.5" rx="0.5" fill="#4285F4" />
      <rect x="10.5" y="14.5" width="3" height="2.5" rx="0.5" fill="#EA4335" />
      <rect x="14" y="14.5" width="3" height="2.5" rx="0.5" fill="#34A853" />
    </svg>
  )
}

export function DentSoftIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect width="24" height="24" rx="6" fill="#7C3AED" />
      {/* Tooth shape */}
      <path
        d="M12 5c-1.5 0-2.7.4-3.5 1.2C7.7 7 7.3 8 7.3 9.2c0 1 .2 1.8.5 2.8.3 1 .6 2.2.8 3.5.2 1.2.5 2.2 1 3 .4.7.9 1 1.4 1 .4 0 .7-.3 1-1l.5-1.5h1l.5 1.5c.3.7.6 1 1 1 .5 0 1-.3 1.4-1 .5-.8.8-1.8 1-3 .2-1.3.5-2.5.8-3.5.3-1 .5-1.8.5-2.8 0-1.2-.4-2.2-1.2-3C15.7 5.4 13.5 5 12 5z"
        fill="white"
      />
    </svg>
  )
}
