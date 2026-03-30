import { useEffect, useState } from 'react'

interface Step03Props {
  readonly prestationType: string
  readonly onNext: () => void
  readonly onBack: () => void
}

/* Plans DeepCleaning par type de prestation - https://deepcleaning.fr/booking/ */
const PLANS_BY_PRESTATION: Record<string, Array<{ id: string; title: string; price: number; duration: string }>> = {
  canape: [
    { id: 'canape-2-3', title: 'Canapé 2-3 places', price: 79, duration: '30 min' },
    { id: 'canape-4-5', title: 'Canapé 4/5 places', price: 89, duration: '45 min' },
    { id: 'canape-6', title: 'Canapé 6 places', price: 109, duration: '50 min' },
    { id: 'canape-8', title: 'Canapé 8 places', price: 159, duration: '50 min' },
  ],
  matelas: [
    { id: 'matelas-1', title: 'Matelas 1 place (recto/verso)', price: 69, duration: '20 min' },
    { id: 'matelas-2', title: 'Matelas 2 place (recto/verso)', price: 79, duration: '30 min' },
    { id: 'matelas-kingsize', title: 'King size', price: 89, duration: '30 min' },
  ],
  tapis: [
    { id: 'tapis-23x16', title: 'Tapis, Moquette 2.3×1.6m', price: 49, duration: '15 min' },
  ],
  fauteuil: [
    { id: 'fauteuil-1', title: 'Fauteuil', price: 39, duration: '15 min' },
  ],
  chaises: [
    { id: 'chaises-4', title: 'Lots de 4 Chaises', price: 66, duration: '30 min' },
  ],
}

function Step03({ prestationType, onNext, onBack }: Step03Props) {
  const plans = PLANS_BY_PRESTATION[prestationType] ?? PLANS_BY_PRESTATION.canape
  const [selected, setSelected] = useState<string>(plans[0]?.id ?? '')

  useEffect(() => {
    const firstPlanId = (PLANS_BY_PRESTATION[prestationType] ?? PLANS_BY_PRESTATION.canape)[0]?.id ?? ''
    setSelected(firstPlanId)
  }, [prestationType])

  return (
    <div className="form-step-card form-step-v2">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
        <div className="stepper-horizontal">
          <div className="stepper-step">
            <div className="stepper-dot completed">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" fill="#1BB42D" />
                <path d="M4 7L6 9L10 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="stepper-title">Type de prestation</span>
          </div>
          <div style={{ flex: 1, height: 4, background: 'var(--color-primary-light)', borderRadius: 2, alignSelf: 'center', maxWidth: 80 }} />
          <div className="stepper-step">
            <div className="stepper-dot active">2</div>
            <span className="stepper-title active">Plan</span>
          </div>
          <div style={{ flex: 1, height: 4, background: 'var(--color-primary-light)', borderRadius: 2, alignSelf: 'center', maxWidth: 80 }} />
          <div className="stepper-step">
            <div className="stepper-dot pending">3</div>
            <span className="stepper-title pending">Infos personnelles</span>
          </div>
          <div style={{ flex: 1, height: 3, background: 'var(--color-border-input)', borderRadius: 2, alignSelf: 'center', maxWidth: 80 }} />
          <div className="stepper-step">
            <div className="stepper-dot pending">4</div>
            <span className="stepper-title pending">Identité</span>
          </div>
          <div style={{ flex: 1, height: 3, background: 'var(--color-border-input)', borderRadius: 2, alignSelf: 'center', maxWidth: 80 }} />
          <div className="stepper-step">
            <div className="stepper-dot pending">5</div>
            <span className="stepper-title pending">Activer</span>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--color-border)', width: '100%' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 32, paddingTop: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="form-step-title" style={{ marginBottom: 8 }}>Choisissez votre plan</h2>
            <span style={{ fontSize: 16, color: 'var(--color-text-muted)' }}>Étape 2/5</span>
          </div>
          <p style={{ fontSize: 16, color: 'var(--color-text-muted)', lineHeight: 1.5, marginTop: -16 }}>
            Sélectionnez le plan qui correspond à votre prestation.
          </p>

          <div className="plan-cards-grid">
            {plans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                className={`plan-card ${selected === plan.id ? 'selected' : ''}`}
                onClick={() => setSelected(plan.id)}
              >
                <div className="plan-card-radio">
                  <span className="radio-dot" />
                </div>
                <div className="plan-card-content">
                  <span className="plan-card-title">{plan.title}</span>
                  <div className="badges-row" style={{ marginTop: 16 }}>
                    <span className={`mini-tag ${selected === plan.id ? 'selected' : ''}`}>
                      <strong>{plan.price}€</strong>
                    </span>
                    <span className={`mini-tag ${selected === plan.id ? 'selected' : ''}`}>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ flexShrink: 0 }}>
                        <circle cx="8" cy="8" r="6" />
                        <path d="M8 4v4l2 2" strokeLinecap="round" />
                      </svg>
                      {plan.duration}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="plan-step-footer">
        <span style={{ fontSize: 16, color: 'var(--color-text-muted)' }}>Étape 2 sur 5</span>
        <div style={{ display: 'flex', gap: 24 }}>
          <button className="btn btn-secondary" onClick={onBack}>Retour</button>
          <button className="btn btn-primary" onClick={onNext}>Sélectionner votre plan</button>
        </div>
      </div>
    </div>
  )
}

export default Step03
