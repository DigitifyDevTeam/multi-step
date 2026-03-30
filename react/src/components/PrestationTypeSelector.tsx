/* Shared prestation type selector - used in Step01 and Step02Prestation */

const SERVICES = [
  { id: 'canape', label: 'Canapé', icon: 'sofa' },
  { id: 'matelas', label: 'Matelas', icon: 'bed' },
  { id: 'tapis', label: 'Tapis, Moquette', icon: 'rug' },
  { id: 'fauteuil', label: 'Fauteuil', icon: 'armchair' },
  { id: 'chaises', label: 'Chaises', icon: 'chairs' },
]

const ServiceIcon = ({ name, selected }: { name: string; selected: boolean }) => {
  const color = selected ? '#FFFFFF' : 'var(--color-primary)'
  const size = 32
  switch (name) {
    case 'sofa':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 9a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V9z" />
          <path d="M4 15v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          <path d="M6 12h.01M18 12h.01" />
        </svg>
      )
    case 'bed':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 4v16" />
          <path d="M2 8h18a2 2 0 0 1 2 2v10" />
          <path d="M2 17h20" />
          <path d="M6 8V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4" />
        </svg>
      )
    case 'rug':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18" />
          <path d="M3 15h18" />
          <path d="M9 3v18" />
          <path d="M15 3v18" />
        </svg>
      )
    case 'armchair':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3" />
          <path d="M3 11v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2" />
          <path d="M5 18v2" />
          <path d="M19 18v2" />
          <path d="M9 11v6" />
          <path d="M15 11v6" />
        </svg>
      )
    case 'chairs':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 10V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v6" />
          <path d="M5 10v10a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V10" />
          <path d="M15 10v10a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V10" />
          <path d="M5 10h14" />
          <path d="M8 7h8" />
        </svg>
      )
    default:
      return null
  }
}

interface PrestationTypeSelectorProps {
  readonly prestationType: string
  readonly onPrestationChange: (id: string) => void
  readonly stepLabel?: string
  readonly title?: string
}

export function PrestationTypeSelector({ prestationType, onPrestationChange, stepLabel, title = 'Choisissez votre type de prestation' }: PrestationTypeSelectorProps) {
  const selected = prestationType
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <h2 className="form-step-title" style={{ marginBottom: 0 }}>{title}</h2>
        {stepLabel && <span style={{ fontSize: 16, color: 'var(--color-text-muted)' }}>{stepLabel}</span>}
      </div>
      <div className="services-grid">
        {SERVICES.map((service) => (
          <button
            key={service.id}
            type="button"
            className={`service-card ${selected === service.id ? 'selected' : ''}`}
            onClick={() => onPrestationChange(service.id)}
          >
            <div className="service-card-radio">
              <span className="radio-dot" />
            </div>
            <div className={`service-card-icon-wrapper ${selected === service.id ? 'selected' : ''}`}>
              <ServiceIcon name={service.icon} selected={selected === service.id} />
            </div>
            <span className={`service-card-label ${selected === service.id ? 'selected' : ''}`}>
              {service.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
