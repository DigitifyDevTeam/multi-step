import { useEffect, useState } from 'react'
import { PrestationTypeSelector } from './PrestationTypeSelector'

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

interface Step02Props {
  readonly prestationType: string
  readonly onPrestationChange: (id: string) => void
  readonly onNext: () => void
  readonly onBack: () => void
  readonly onPlanSelect?: (plan: { id: string; title: string; price: number; duration: string }) => void
  readonly initialSelectedPlan?: string
}

function Step02({ prestationType, onPrestationChange, onNext, onBack, onPlanSelect, initialSelectedPlan }: Step02Props) {
  const plans = PLANS_BY_PRESTATION[prestationType] ?? PLANS_BY_PRESTATION.canape
  const [selectedPlan, setSelectedPlan] = useState<string>(initialSelectedPlan ?? plans[0]?.id ?? '')

  useEffect(() => {
    const firstPlanId = (PLANS_BY_PRESTATION[prestationType] ?? PLANS_BY_PRESTATION.canape)[0]?.id ?? ''
    setSelectedPlan(initialSelectedPlan ?? firstPlanId)
  }, [prestationType, initialSelectedPlan])

  const canContinue = prestationType.length > 0

  return (
    <div className="form-step-card form-step-v2">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32, paddingTop: 32 }}>
          <PrestationTypeSelector
            prestationType={prestationType}
            onPrestationChange={onPrestationChange}
            stepLabel="Étape 1/6"
            title="Choisissez votre type de prestation et votre plan"
          />

          {prestationType && (
            <>
              <div style={{ borderTop: '1px solid var(--color-border)', width: '100%' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h3 className="form-step-title" style={{ margin: 0, fontSize: 18 }}>Choisissez votre plan</h3>
                <div className="plan-cards-grid">
                  {plans.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      className={`plan-card ${selectedPlan === plan.id ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedPlan(plan.id)
                        onPlanSelect?.(plan)
                      }}
                    >
                      <div className="plan-card-radio">
                        <span className="radio-dot" />
                      </div>
                      <div className="plan-card-content">
                        <span className="plan-card-title">{plan.title}</span>
                        <div className="badges-row" style={{ marginTop: 16 }}>
                          <span className={`mini-tag ${selectedPlan === plan.id ? 'selected' : ''}`}>
                            <strong>{plan.price}€</strong>
                          </span>
                          <span className={`mini-tag ${selectedPlan === plan.id ? 'selected' : ''}`}>
                            {plan.duration}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="plan-step-footer">
      <span style={{ fontSize: 16, color: 'var(--color-text-muted)' }}>Étape 1 sur 6</span>
        <div style={{ display: 'flex', gap: 24 }}>
          <button className="btn btn-primary" onClick={onNext} disabled={!canContinue} type="button">
            Continuer
          </button>
        </div>
      </div>
    </div>
  )
}

export default Step02
