import { useState, useMemo } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { paymentsApi, promoCodeApi } from '../services/api'
import type { ReservationFormData } from '../hooks/useReservation'
import type { Reservation } from '../services/api'
import { SUPPLEMENTARY_SERVICES } from '../hooks/useReservation'

interface Step04Props {
  readonly formData: ReservationFormData
  readonly latestReservation: Reservation | null
  readonly computedTotal: number
  readonly onNext: () => void
  readonly onBack: () => void
  readonly onEditStep: (step: 1 | 2 | 3 | 4) => void
  readonly onSubmitReservation: (promoCodeOverride?: string) => Promise<number | null>
  readonly onConfirmReservation: () => Promise<void>
  readonly setError: (msg: string | null) => void
  readonly isSubmitting: boolean
}

// Stripe form (rendered inside Elements)
function StripePaymentForm({
  onSuccess,
  onError,
  disabled,
}: {
  onSuccess: () => void
  onError: (msg: string) => void
  disabled: boolean
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setSubmitting(true)
    onError('')

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}${window.location.pathname}?payment=complete`,
      },
    })

    setSubmitting(false)

    if (result.error) {
      onError(result.error.message ?? 'Paiement échoué')
      return
    }
    const pi = (result as { paymentIntent?: { status: string } }).paymentIntent
    if (pi?.status === 'succeeded') {
      onSuccess()
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%' }}>
      <div style={{ marginBottom: 16 }}>
        <PaymentElement
          options={{
            layout: 'tabs',
            paymentMethodOrder: ['card'],
            wallets: { link: 'never' },
          }}
        />
      </div>
      <button
        type="submit"
        className="btn btn-primary"
        disabled={!stripe || submitting || disabled}
        style={{ width: '100%', padding: 14, fontSize: 16 }}
      >
        {submitting ? 'Traitement...' : 'Payer'}
      </button>
    </form>
  )
}

function Step04({
  formData,
  latestReservation,
  computedTotal,
  onNext,
  onBack,
  onEditStep,
  onSubmitReservation,
  onConfirmReservation,
  setError,
  isSubmitting,
}: Step04Props) {
  const [paymentPhase, setPaymentPhase] = useState<'ready' | 'paying'>('ready')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [stripePromise, setStripePromise] = useState<Promise<any> | null>(null)
  const [paymentError, setPaymentError] = useState('')
  const [promoCodeInput, setPromoCodeInput] = useState((formData.step4?.codePromo ?? '').trim())
  const [promoState, setPromoState] = useState<{
    status: 'idle' | 'valid' | 'invalid'
    message: string
    discountAmount: number
  }>({
    status: 'idle',
    message: '',
    discountAmount: 0,
  })
  const [promoLoading, setPromoLoading] = useState(false)

  const validatePromo = async () => {
    const code = promoCodeInput.trim()
    if (!code) {
      setPromoState({ status: 'idle', message: '', discountAmount: 0 })
      return true
    }
    setPromoLoading(true)
    try {
      const result = await promoCodeApi.validate(code, computedTotal)
      if (!result.valid) {
        setPromoState({ status: 'invalid', message: 'Code invalide', discountAmount: 0 })
        return false
      }
      const discountAmount = Number(result.discount_amount ?? 0)
      setPromoState({
        status: 'valid',
        message: 'Code promo appliqué',
        discountAmount,
      })
      return true
    } catch {
      setPromoState({ status: 'invalid', message: 'Code invalide', discountAmount: 0 })
      return false
    } finally {
      setPromoLoading(false)
    }
  }

  const handleStartPayment = async () => {
    setError(null)
    setPaymentError('')
    await validatePromo()
    // Only apply promo code if valid; otherwise proceed without discount
    const codeToApply = promoState.status === 'valid' ? promoCodeInput.trim() : ''
    const id = await onSubmitReservation(codeToApply || undefined)
    if (!id) return

    try {
      sessionStorage.setItem('pendingPaymentReservationId', String(id))
      const { client_secret, publishable_key } = await paymentsApi.createIntent(id)
      if (!client_secret) throw new Error('Pas de client_secret')
      setClientSecret(client_secret)
      if (publishable_key) {
        setStripePromise(loadStripe(publishable_key))
      } else {
        const config = await paymentsApi.getConfig()
        setStripePromise(loadStripe(config.publishable_key))
      }
      setPaymentPhase('paying')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur création paiement')
    }
  }

  const handlePaymentSuccess = async () => {
    setPaymentError('')
    try {
      await onConfirmReservation()
      onNext()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur confirmation')
    }
  }

  const step1 = formData.step1
  const step2 = formData.step2
  const step3 = formData.step3
  const step4 = formData.step4

  const supplementaryItems = useMemo(() => {
    if (!step2?.wantsSupplementary || !step2.quantities) return []
    const items: Array<{ title: string; price: number; quantity: number }> = []
    Object.entries(step2.quantities).forEach(([serviceId, quantity]) => {
      if (quantity > 0) {
        const def = SUPPLEMENTARY_SERVICES.find((s) => s.id === serviceId)
        if (def) items.push({ title: def.title, price: def.priceDiscounted, quantity })
      }
    })
    return items
  }, [step2])

  const optionsTotal = supplementaryItems.reduce((s, i) => s + i.price * i.quantity, 0)
  const pricing = useMemo(() => {
    const original = Number(latestReservation?.original_price ?? computedTotal)
    const total = Number(latestReservation?.total_price ?? computedTotal)
    const discount = Number(latestReservation?.discount_amount ?? 0)
    const effectiveDiscount = Number(
      latestReservation?.effective_discount_percentage ??
      (original > 0 ? (discount / original) * 100 : 0),
    )
    return {
      original,
      total,
      discount,
      effectiveDiscount,
      promoCode: latestReservation?.promo_code ?? null,
      promoType: latestReservation?.promo_discount_type ?? null,
      promoValue: latestReservation?.promo_discount_value ?? null,
    }
  }, [latestReservation, computedTotal])
  const previewTotal = useMemo(() => {
    if (latestReservation) return pricing.total
    if (promoState.status === 'valid') {
      return Math.max(0, computedTotal - promoState.discountAmount)
    }
    return computedTotal
  }, [latestReservation, pricing.total, promoState, computedTotal])

  return (
    <div className="form-step-card form-step-v2">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32, paddingTop: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h2 className="form-step-title" style={{ marginBottom: 8 }}>Résumé et Confirmation</h2>
              <p style={{ fontSize: 16, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                Vérifiez les détails de votre réservation avant de payer.
              </p>
            </div>
            <span style={{ fontSize: 16, color: 'var(--color-text-muted)' }}>Étape 5/6</span>
          </div>

          <div className="step04-columns-wrapper" style={{ display: 'flex', gap: '24px', width: '100%', flexWrap: 'wrap' }}>
            {/* Left Column */}
            <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '24px', minWidth: '300px' }}>
              {/* Prestation Info */}
              {step1 && (
                <div style={{ padding: '24px', backgroundColor: 'var(--color-bg-fbfbfe)', border: '1px solid var(--color-border-input)', borderRadius: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-dark)', margin: 0 }}>Prestation</h3>
                    <button
                      type="button"
                      onClick={() => onEditStep(1)}
                      style={{ border: 'none', background: 'transparent', color: 'var(--color-primary)', fontSize: 14, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Modifier
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-secondary)', fontSize: '15px' }}>{step1.prestationType} • {step1.selectedPlan.title}</span>
                      <span style={{ fontWeight: 600, color: 'var(--color-text-dark)' }}>{step1.selectedPlan.price.toFixed(2)} €</span>
                    </div>
                  </div>
                  {supplementaryItems.length > 0 && (
                    <>
                      <div style={{ height: '1px', background: 'var(--color-border-input)', margin: '16px 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                        <button
                          type="button"
                          onClick={() => onEditStep(2)}
                          style={{ border: 'none', background: 'transparent', color: 'var(--color-primary)', fontSize: 14, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                        >
                          Modifier les options
                        </button>
                      </div>
                      {supplementaryItems.map((item) => (
                        <div key={item.title} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: '15px' }}>{item.title} (x{item.quantity})</span>
                          <span style={{ fontWeight: 600, color: 'var(--color-text-dark)' }}>{(item.price * item.quantity).toFixed(2)} €</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* Date & Time */}
              {step3 && (
                <div style={{ padding: '24px', backgroundColor: 'var(--color-bg-fbfbfe)', border: '1px solid var(--color-border-input)', borderRadius: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-dark)', margin: 0 }}>Date & Heure</h3>
                    <button
                      type="button"
                      onClick={() => onEditStep(3)}
                      style={{ border: 'none', background: 'transparent', color: 'var(--color-primary)', fontSize: 14, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Modifier
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ padding: '12px 16px', background: 'var(--color-bg-white)', border: '1px solid var(--color-border-input)', borderRadius: 8, flex: 1 }}>
                      <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: 4 }}>Date</div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-dark)' }}>
                        {step3.selectedDate ? format(step3.selectedDate, 'EEEE d MMMM yyyy', { locale: fr }) : '—'}
                      </div>
                    </div>
                    <div style={{ padding: '12px 16px', background: 'var(--color-bg-white)', border: '1px solid var(--color-border-input)', borderRadius: 8, flex: 1 }}>
                      <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: 4 }}>Heure</div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-dark)' }}>{step3.timeSlot ?? '—'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Personal Info */}
              <div style={{ padding: '24px', backgroundColor: 'var(--color-bg-fbfbfe)', border: '1px solid var(--color-border-input)', borderRadius: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-dark)', margin: 0 }}>Informations</h3>
                  <button
                    type="button"
                    onClick={() => onEditStep(4)}
                    style={{ border: 'none', background: 'transparent', color: 'var(--color-primary)', fontSize: 14, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Modifier
                  </button>
                </div>
                {step4 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: 4 }}>Nom complet</div>
                      <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--color-text-dark)' }}>{step4.prenom} {step4.nom}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: 4 }}>Téléphone</div>
                      <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--color-text-dark)' }}>{step4.telephone}</div>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: 4 }}>Adresse</div>
                      <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--color-text-dark)' }}>{step4.adresse}, {step4.codePostal} {step4.ville}</div>
                    </div>
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: 15, color: 'var(--color-text-secondary)' }}>
                    Aucune information personnelle enregistrée pour le moment.
                  </p>
                )}
              </div>
            </div>

            {/* Right Column: Total & Payment */}
            <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column' }}>
              <div style={{
                padding: '24px',
                backgroundColor: 'var(--color-bg-white)',
                border: '2px solid var(--color-primary)',
                borderRadius: 16,
                boxShadow: 'var(--shadow-primary-04)',
                position: 'sticky',
                top: 24,
              }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-dark)', marginBottom: 16, marginTop: 0 }}>Total à payer</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {step1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-secondary)', fontSize: 15 }}>Prestation principale</span>
                      <span style={{ fontWeight: 500 }}>{step1.selectedPlan.price.toFixed(2)} €</span>
                    </div>
                  )}
                  {optionsTotal > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-secondary)', fontSize: 15 }}>Options ({supplementaryItems.length})</span>
                      <span style={{ fontWeight: 500 }}>{optionsTotal.toFixed(2)} €</span>
                    </div>
                  )}
                  <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />
                  {!latestReservation && promoState.status === 'valid' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-success)', fontSize: 15, fontWeight: 600 }}>
                        Réduction ({promoCodeInput.trim().toUpperCase()})
                      </span>
                      <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>
                        -{promoState.discountAmount.toFixed(2)} €
                      </span>
                    </div>
                  )}
                  {pricing.discount > 0 && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--color-success)', fontSize: 15, fontWeight: 600 }}>
                          Réduction
                          {pricing.promoCode ? ` (${pricing.promoCode})` : ''}
                        </span>
                        <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>
                          -{pricing.discount.toFixed(2)} €
                        </span>
                      </div>
                      <div
                        style={{
                          marginTop: 4,
                          padding: '10px 12px',
                          borderRadius: 10,
                          background: 'linear-gradient(90deg, rgba(16,185,129,0.1), rgba(59,130,246,0.08))',
                          border: '1px solid rgba(16,185,129,0.35)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <span style={{ fontSize: 13, color: 'var(--color-text-dark)' }}>
                          Offre appliquée
                          {pricing.promoType === 'percentage' && pricing.promoValue !== null
                            ? `: ${Number(pricing.promoValue).toFixed(0)}%`
                            : ''}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-success)' }}>
                          -{pricing.effectiveDiscount.toFixed(1)}%
                        </span>
                      </div>
                    </>
                  )}
                  {pricing.original > pricing.total && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>Sous-total avant remise</span>
                      <span style={{ fontWeight: 500, textDecoration: 'line-through', color: 'var(--color-text-muted)' }}>
                        {pricing.original.toFixed(2)} €
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: 16, fontWeight: 600 }}>Total TTC</span>
                    <span style={{ fontWeight: 800, color: 'var(--color-primary)', fontSize: 28 }}>{previewTotal.toFixed(2)} €</span>
                  </div>
                </div>

                <div style={{ marginTop: 20 }}>
                  <div style={{ marginBottom: 12 }}>
                    <label htmlFor="promo-code-input" className="input-label" style={{ marginBottom: 6, display: 'block' }}>Code promo</label>
                    <div className="input-field" style={{ gap: 8 }}>
                      <input
                        id="promo-code-input"
                        type="text"
                        placeholder="Saisissez votre code promo"
                        value={promoCodeInput}
                        onChange={(e) => {
                          setPromoCodeInput(e.target.value)
                          if (promoState.status !== 'idle') {
                            setPromoState({ status: 'idle', message: '', discountAmount: 0 })
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={validatePromo}
                        disabled={promoLoading}
                        style={{ minHeight: 38, padding: '8px 12px', fontSize: 14 }}
                      >
                        {promoLoading ? '...' : 'Appliquer'}
                      </button>
                    </div>
                    {promoState.message && (
                      <p
                        style={{
                          margin: '8px 0 0 0',
                          fontSize: 13,
                          color: promoState.status === 'valid' ? 'var(--color-success)' : '#dc2626',
                          fontWeight: 600,
                        }}
                      >
                        {promoState.message}
                      </p>
                    )}
                  </div>

                  {paymentPhase === 'ready' ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleStartPayment}
                      disabled={isSubmitting || promoLoading || !step1 || !step3 || !step4}
                      style={{ width: '100%', padding: 14, fontSize: 16, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}
                    >
                      {isSubmitting ? 'Création en cours...' : 'Confirmer et Payer'}
                      {!isSubmitting && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                        </svg>
                      )}
                    </button>
                  ) : clientSecret && stripePromise ? (
                    <Elements stripe={stripePromise} options={{ clientSecret }}>
                      <StripePaymentForm
                        onSuccess={handlePaymentSuccess}
                        onError={setPaymentError}
                        disabled={isSubmitting}
                      />
                    </Elements>
                  ) : (
                    <div style={{ color: 'var(--color-text-muted)' }}>Chargement du formulaire de paiement...</div>
                  )}
                  {paymentError && (
                    <p style={{ color: '#dc2626', fontSize: 14, marginTop: 8 }}>{paymentError}</p>
                  )}
                  <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-text-light)', marginTop: 8, marginBottom: 0 }}>
                    Paiement 100% sécurisé via Stripe
                  </p>
                </div>

                <div style={{ marginTop: 16, padding: 12, backgroundColor: 'var(--color-bg-fbfbfe)', borderRadius: 8, border: '1px solid var(--color-border-input)' }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px 0' }}>Récapitulatif</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {['Professionnel certifié', 'Garantie satisfaction', 'Équipements professionnels'].map((t) => (
                      <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="plan-step-footer">
        <span style={{ fontSize: 16, color: 'var(--color-text-muted)' }}>Étape 5 sur 6</span>
        <div style={{ display: 'flex', gap: 24 }}>
        </div>
      </div>
    </div>
  )
}

export default Step04
