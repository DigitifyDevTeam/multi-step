import { useState, useCallback, useEffect } from 'react'
import './App.css'
import Step02 from './components/Step02'
import Step02Prestation from './components/Step02Prestation'
import Step03DateHeure from './components/Step03DateHeure'
import Step04 from './components/Step04'
import Step01 from './components/Step01'
import Step05 from './components/Step05'
import { useReservation } from './hooks/useReservation'

const STEPS = [
  { id: 1, title: 'Prestation & Plan', description: 'Choisissez votre type de prestation et votre plan.' },
  { id: 2, title: 'Prestations supplémentaires', description: 'Des prestations supplémentaires ?' },
  { id: 3, title: 'Date et Heure', description: 'Sélectionnez le créneau qui vous convient.' },
  { id: 4, title: 'Informations personnelles', description: 'Présentez-vous pour commencer.' },
  { id: 5, title: 'Résumé et Confirmation', description: 'Vérifiez les détails de votre réservation.' },
  { id: 6, title: 'validation de la réservation', description: 'Payer et valider votre réservation.' },
]

// Plans DeepCleaning par type de prestation
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

function App() {
  const [currentStep, setCurrentStep] = useState(1)
  const [prestationType, setPrestationType] = useState<string>('')
  const [selectedPlan, setSelectedPlan] = useState<{ id: string; title: string; price: number; duration: string } | null>(null)

  const {
    formData,
    latestReservation,
    computedTotal,
    isSubmitting,
    error,
    setError,
    success,
    updateStep1,
    updateStep2,
    updateStep3,
    updateStep4,
    submitReservation,
    confirmReservation,
    confirmReservationById,
    resetForm,
  } = useReservation()

  // Get the first plan for a prestation type
  const getFirstPlan = useCallback((type: string) => {
    const plans = PLANS_BY_PRESTATION[type] ?? PLANS_BY_PRESTATION.canape
    return plans[0] ?? null
  }, [])

  const handlePrestationChange = useCallback((type: string) => {
    setPrestationType(type)
    const firstPlan = getFirstPlan(type)
    if (firstPlan) {
      setSelectedPlan(firstPlan)
    }
  }, [getFirstPlan])

  const handlePlanSelect = useCallback((plan: { id: string; title: string; price: number; duration: string }) => {
    setSelectedPlan(plan)
  }, [])

  const handleNext = useCallback(() => {
    // Save data before moving to next step
    if (currentStep === 1 && prestationType && selectedPlan) {
      updateStep1({ prestationType, selectedPlan })
    }
    if (currentStep < 6) setCurrentStep(currentStep + 1)
  }, [currentStep, prestationType, selectedPlan, updateStep1])

  const handleBack = useCallback(() => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }, [currentStep])

  const handleServicesChange = useCallback((wantsSupplementary: boolean, quantities: Record<string, number>) => {
    updateStep2({ wantsSupplementary, quantities })
  }, [updateStep2])

  const handleDateTimeChange = useCallback((date: Date | undefined, time: string | undefined) => {
    updateStep3({ selectedDate: date, timeSlot: time })
  }, [updateStep3])

  const handleStep1FormChange = useCallback((data: {
    nom: string; prenom: string; telephone: string; email: string;
    adresse: string; ville: string; codePostal: string; codePromo: string;
    autresInformations: string
  }) => {
    updateStep4(data)
  }, [updateStep4])

  const handleEditStep = useCallback((step: 1 | 2 | 3 | 4) => {
    setCurrentStep(step)
  }, [])


  const handleRestart = useCallback(() => {
    resetForm()
    setCurrentStep(1)
    setPrestationType('')
    setSelectedPlan(null)
  }, [resetForm])

  // Handle return from Stripe 3DS redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('payment') === 'complete') {
      const id = sessionStorage.getItem('pendingPaymentReservationId')
      if (id) {
        sessionStorage.removeItem('pendingPaymentReservationId')
        confirmReservationById(Number(id)).then(() => {
          setCurrentStep(6)
          window.history.replaceState({}, '', window.location.pathname)
        }).catch(() => {})
      }
    }
  }, [confirmReservationById])

  return (
    <div className="multistep-form-wrapper">
      {/* Error/Success Messages */}
      {error && (
        <div className="api-message api-error" style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#fee2e2', color: '#dc2626', padding: '12px 24px',
          borderRadius: '8px', zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          {error}
          <button onClick={() => window.location.reload()} style={{ marginLeft: 12, cursor: 'pointer' }}>×</button>
        </div>
      )}
      {success && (
        <div className="api-message api-success" style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#dcfce7', color: '#16a34a', padding: '12px 24px',
          borderRadius: '8px', zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          Reservation a bien été enregistrée.
        </div>
      )}

      {/* Tag Container */}
      <div className="tag-container">
        <div className="tab-pill">
          <span>Deep Cleaning</span>
        </div>
      </div>

      {/* Main Form Container */}
      <div className="form-main-container">
        <div className="form-card">
          <div className="form-inner">
            <aside className="sidebar sidebar-brix">
              <div className="sidebar-top">
                <div className="sidebar-logo-brix">
                  <img src="/logo_4.png" alt="Logo" className="sidebar-logo-img" />
                </div>
                <div className="sidebar-divider" />
                <div className="sidebar-steps-vertical">
                  {STEPS.map((step, index) => (
                    <div key={step.id} className="step-item-vertical">
                      <div className="step-icon-column">
                        <div className={`step-dot-brix ${currentStep >= step.id ? 'active' : 'inactive'}`}>
                          <span>{step.id}</span>
                        </div>
                        {index < STEPS.length - 1 && (
                          <div className={`step-connector ${currentStep > step.id ? 'active' : 'inactive'}`} />
                        )}
                      </div>
                      <div className="step-texts">
                        <span className="step-title">{step.title}</span>
                        <span className="step-paragraph">{step.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="sidebar-bottom">
                <div className="sidebar-bottom-inner">
                  <div>
                    <div className="sidebar-help-title">Besoin d'aide ?</div>
                    <div className="sidebar-help-text">discuter avec le support en direct</div>
                  </div>
                  <button className="help-button help-button-headphones" type="button" aria-label="Chat support">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                    </svg>
                  </button>
                </div>
              </div>
            </aside>

            {/* Right Column - Form Content */}
            <main className="form-content">
              {currentStep === 1 && (
                <Step02
                  prestationType={prestationType}
                  onPrestationChange={handlePrestationChange}
                  onNext={handleNext}
                  onBack={handleBack}
                  onPlanSelect={handlePlanSelect}
                  initialSelectedPlan={selectedPlan?.id}
                />
              )}
              {currentStep === 2 && (
                <Step02Prestation
                  onNext={handleNext}
                  onBack={handleBack}
                  onServicesChange={handleServicesChange}
                  initialWantsSupplementary={formData.step2?.wantsSupplementary}
                  initialQuantities={formData.step2?.quantities}
                />
              )}
              {currentStep === 3 && (
                <Step03DateHeure
                  onNext={handleNext}
                  onBack={handleBack}
                  onDateTimeChange={handleDateTimeChange}
                  initialSelectedDate={formData.step3?.selectedDate}
                  initialTimeSlot={formData.step3?.timeSlot}
                />
              )}
              {currentStep === 4 && (
                <Step01
                  onNext={handleNext}
                  onBack={handleBack}
                  onFormChange={handleStep1FormChange}
                  initialData={formData.step4 ?? undefined}
                />
              )}
              {currentStep === 5 && (
                <Step04
                  formData={formData}
                  latestReservation={latestReservation}
                  computedTotal={computedTotal}
                  onNext={handleNext}
                  onBack={handleBack}
                  onEditStep={handleEditStep}
                  onSubmitReservation={submitReservation}
                  onConfirmReservation={confirmReservation}
                  setError={setError}
                  isSubmitting={isSubmitting}
                />
              )}
              {currentStep === 6 && (
                <Step05
                  onNext={handleRestart}
                  onBack={handleBack}
                />
              )}
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
