import { useState } from 'react'

/* Prestations supplémentaires DeepCleaning - -20% sur toutes les prestations - https://deepcleaning.fr/booking/ */
const SUPPLEMENTARY_SERVICES = [
  { id: 'kingsize', title: 'King size', duration: '30 min', priceDiscounted: 71.2, priceOriginal: 89 },
  { id: 'canape-8', title: 'Canapé 8 places', duration: '50 min', priceDiscounted: 127.2, priceOriginal: 159 },
  { id: 'repose-pied', title: 'Repose Pied', duration: '20 min', priceDiscounted: 28, priceOriginal: 35 },
  { id: 'matelas-bebe', title: 'Matelas Bébé', duration: '20 min', priceDiscounted: 39.2, priceOriginal: 49 },
  { id: 'sur-matelas', title: 'Sur-matelas', duration: '20 min', priceDiscounted: 39.2, priceOriginal: 49 },
  { id: 'sommier', title: 'Sommier', duration: '10 min', priceDiscounted: 31.2, priceOriginal: 39 },
  { id: 'tete-de-lit', title: 'Tete de lit', duration: '20 min', priceDiscounted: 39.2, priceOriginal: 49 },
  { id: 'fauteuil', title: 'Fauteuil', duration: '15 min', priceDiscounted: 31.2, priceOriginal: 39 },
  { id: 'chaise', title: 'Chaise', duration: '10 min', priceDiscounted: 15.2, priceOriginal: 19 },
  { id: 'matelas-1', title: 'Matelas 1 place (recto/verso)', duration: '15 min', priceDiscounted: 55.2, priceOriginal: 69 },
  { id: 'matelas-2', title: 'Matelas 2 places (recto/verso)', duration: '30 min', priceDiscounted: 63.2, priceOriginal: 79 },
  { id: 'canape-2-3', title: 'Canapé 2/3 places', duration: '30 min', priceDiscounted: 63.2, priceOriginal: 79 },
  { id: 'canape-4-5', title: 'Canapé 4/5 places', duration: '30 min', priceDiscounted: 71.2, priceOriginal: 89 },
  { id: 'canape-6', title: 'Canapé 6 places', duration: '50 min', priceDiscounted: 87.2, priceOriginal: 109 },
  { id: 'tapis', title: 'Tapis, Moquette 2.3×1.6m', duration: '15 min', priceDiscounted: 39.2, priceOriginal: 49 },
]

interface Step02PrestationProps {
  readonly onNext: () => void
  readonly onBack: () => void
  readonly onServicesChange?: (wantsSupplementary: boolean, quantities: Record<string, number>) => void
  readonly initialWantsSupplementary?: boolean
  readonly initialQuantities?: Record<string, number>
}

function Step02Prestation({ onNext, onBack, onServicesChange, initialWantsSupplementary, initialQuantities }: Step02PrestationProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>(initialQuantities ?? {})
  const [wantsSupplementary, setWantsSupplementary] = useState(initialWantsSupplementary ?? false)

  const getQuantity = (id: string) => quantities[id] ?? 0

  const setQuantity = (id: string, qty: number) => {
    const value = Math.max(0, Math.min(99, qty))
    const newQuantities = { ...quantities, [id]: value }
    setQuantities(newQuantities)
    onServicesChange?.(wantsSupplementary, newQuantities)
  }

  const handleToggleSupplementary = (value: boolean) => {
    setWantsSupplementary(value)
    onServicesChange?.(value, quantities)
  }

  return (
    <div className="form-step-card form-step-v2">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 15, paddingTop: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minWidth: 0 }}>
              <div className="supplementary-toggle-row">
                <h2 className="form-step-title supplementary-toggle-title" style={{ margin: 0 }}>
                  Voulez-vous des prestations supplémentaires ?
                  <span className="supplementary-toggle-group">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={wantsSupplementary}
                      aria-label={wantsSupplementary ? 'Désactiver les prestations supplémentaires' : 'Activer les prestations supplémentaires'}
                      className={`supplementary-toggle ${wantsSupplementary ? 'on' : ''}`}
                      onClick={() => handleToggleSupplementary(!wantsSupplementary)}
                    >
                      <span className="supplementary-toggle-track">
                        <span className="supplementary-toggle-thumb" />
                      </span>
                    </button>
                    <span className="supplementary-toggle-labels">
                      <span className={wantsSupplementary ? 'active' : ''}>oui</span>
                      <span>/</span>
                      <span className={!wantsSupplementary ? 'active' : ''}>non</span>
                    </span>
                  </span>
                </h2>
              </div>
              <div className="supplementary-discount-badge">
                <span className="supplementary-discount-badge-icon" aria-hidden>−30&nbsp;%</span>
                <span className="supplementary-discount-badge-text">Offre exclusive : économisez sur toutes les prestations supplémentaires</span>
              </div>
            </div>
            <span style={{ fontSize: 16, color: 'var(--color-text-muted)' }}>Étape 2/6</span>
          </div>

          {wantsSupplementary && (
          <div className="supplementary-services-grid">
            {SUPPLEMENTARY_SERVICES.map((service) => {
              const qty = getQuantity(service.id)
              const isSelected = qty > 0
              return (
                <div
                  key={service.id}
                  className={`supplementary-service-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    if (qty === 0) {
                      setQuantity(service.id, 1)
                    } else {
                      setQuantity(service.id, 0)
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="supplementary-service-content" style={{ flex: 1 }}>
                    <span className="supplementary-service-name">{service.title}</span>
                    <div className="supplementary-service-meta">
                      <span>{service.duration}</span>
                      <span className="supplementary-service-price">
                        <strong>{service.priceDiscounted}€</strong>
                        <span className="price-original">{service.priceOriginal} €</span>
                      </span>
                    </div>
                  </div>
                  
                  <div className="supplementary-service-control">
                    {!isSelected ? (
                      <div className="supplementary-service-checkbox"></div>
                    ) : (
                      <div 
                        className="quantity-selector"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="quantity-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            setQuantity(service.id, qty - 1)
                          }}
                          aria-label="Diminuer"
                        >
                          −
                        </button>
                        <span className="quantity-value">{qty}</span>
                        <button
                          type="button"
                          className="quantity-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            setQuantity(service.id, qty + 1)
                          }}
                          aria-label="Augmenter"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          )}
        </div>
      </div>

      <div className="plan-step-footer">
        <span style={{ fontSize: 16, color: 'var(--color-text-muted)' }}>Étape 2 sur 6</span>
        <div style={{ display: 'flex', gap: 24 }}>
          <button className="btn btn-secondary" onClick={onBack}>Retour</button>
          <button className="btn btn-primary" onClick={onNext}>Continuer</button>
        </div>
      </div>
    </div>
  )
}

export default Step02Prestation
