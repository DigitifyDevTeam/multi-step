interface Step05Props {
  readonly onNext: () => void
  readonly onBack: () => void
}

function Step05({ onNext }: Step05Props) {
  return (
    <div className="form-step-card form-step-v2">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 15, paddingTop: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <p style={{ fontSize: 16, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              </p>
            </div>
          </div>

          <div
            style={{
              padding: 48,
              background: 'var(--color-bg-main)',
              borderRadius: 24,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                margin: '0 auto 24px',
                background: 'var(--gradient-primary)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-dark)', marginBottom: 8 }}>
              Paiement confirmé
            </p>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
              Merci ! Votre réservation est validée .
            </p>
          </div>
        </div>
      </div>

      
    </div>
  )
}

export default Step05