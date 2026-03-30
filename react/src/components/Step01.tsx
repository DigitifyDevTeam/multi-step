import { useState, useRef, useEffect, useCallback } from 'react'
import { placesApi } from '../services/api'

interface Step01Props {
  onNext: () => void
  onBack: () => void
  onFormChange?: (data: { nom: string; prenom: string; telephone: string; email: string; adresse: string; ville: string; codePostal: string; codePromo: string; autresInformations: string }) => void
  initialData?: { nom: string; prenom: string; telephone: string; email: string; adresse: string; ville: string; codePostal: string; codePromo: string; autresInformations: string }
}

function generateSessionToken(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 15)}`
}

function Step01({ onNext, onBack, onFormChange, initialData }: Step01Props) {
  const addressInputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionTokenRef = useRef<string>(generateSessionToken())

  const [formData, setFormData] = useState({
    nom: initialData?.nom ?? '',
    prenom: initialData?.prenom ?? '',
    telephone: initialData?.telephone ?? '',
    email: initialData?.email ?? '',
    adresse: initialData?.adresse ?? '',
    ville: initialData?.ville ?? '',
    codePostal: initialData?.codePostal ?? '',
    codePromo: initialData?.codePromo ?? '',
    autresInformations: initialData?.autresInformations ?? '',
  })

  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  const [suggestions, setSuggestions] = useState<Array<{ place_id: string; description: string }>>([])
  const [suggestionsVisible, setSuggestionsVisible] = useState(false)
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    const newFormData = { ...formData, [name]: value }
    setFormData(newFormData)
    onFormChange?.(newFormData)
    
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }

    if (name === 'adresse') {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (value.trim().length < 2) {
        setSuggestions([])
        setSuggestionsVisible(false)
        return
      }
      setSuggestionsLoading(true)
      debounceRef.current = setTimeout(() => {
        placesApi.autocomplete(value, sessionTokenRef.current)
          .then((res) => {
            setSuggestions(res.predictions)
            setSuggestionsVisible(res.predictions.length > 0)
          })
          .catch(() => {
            setSuggestions([])
            setSuggestionsVisible(false)
          })
          .finally(() => setSuggestionsLoading(false))
        debounceRef.current = null
      }, 300)
    }
  }

  const selectSuggestion = useCallback((placeId: string) => {
    setSuggestionsVisible(false)
    setSuggestions([])
    setSuggestionsLoading(true)

    placesApi.details(placeId, sessionTokenRef.current)
      .then((res) => {
        const newFormData = {
          ...formData,
          adresse: res.formatted_address,
          ville: res.ville,
          codePostal: res.code_postal,
        }
        setFormData(newFormData)
        onFormChange?.(newFormData)
        sessionTokenRef.current = generateSessionToken()
      })
      .catch(() => {})
      .finally(() => setSuggestionsLoading(false))
  }, [formData, onFormChange])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        addressInputRef.current &&
        !addressInputRef.current.contains(e.target as Node)
      ) {
        setSuggestionsVisible(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {}
    
    if (!formData.nom.trim()) newErrors.nom = 'Le nom est obligatoire'
    if (!formData.prenom.trim()) newErrors.prenom = 'Le prénom est obligatoire'
    if (!formData.telephone.trim()) newErrors.telephone = 'Le téléphone est obligatoire'
    if (!formData.email.trim()) newErrors.email = 'L\'email est obligatoire'
    if (!formData.adresse.trim()) newErrors.adresse = 'L\'adresse est obligatoire'
    if (!formData.ville.trim()) newErrors.ville = 'La ville est obligatoire'
    if (!formData.codePostal.trim()) newErrors.codePostal = 'Le code postal est obligatoire'
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateForm()) {
      onNext()
    }
  }

  return (
    <div className="form-step-card form-step-v2">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 15, paddingTop: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <h2 className="form-step-title" style={{ marginBottom: 8 }}>Merci de renseigner vos coordonnées de contact</h2>
            <span style={{ fontSize: 16, color: 'var(--color-text-muted)' }}>Étape 4/6</span>
          </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>
          {/* Row 1: Nom + Prénom */}
          <div className="input-row">
            <div className="input-group" style={{ flex: 1, minWidth: 274 }}>
              <label className="input-label">Nom</label>
              <div className="input-field">
                <input
                  type="text"
                  name="nom"
                  placeholder="Votre nom"
                  value={formData.nom}
                  onChange={handleChange}
                  required
                />
                {errors.nom && <span style={{ color: 'red', fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.nom}</span>}
              </div>
            </div>
            <div className="input-group" style={{ flex: 1, minWidth: 274 }}>
              <label className="input-label">Prénom</label>
              <div className="input-field">
                <input
                  type="text"
                  name="prenom"
                  placeholder="Votre prénom"
                  value={formData.prenom}
                  onChange={handleChange}
                  required
                />
                {errors.prenom && <span style={{ color: 'red', fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.prenom}</span>}
              </div>
            </div>
          </div>

          {/* Row 2: Téléphone + Email */}
          <div className="input-row">
            <div className="input-group" style={{ flex: 1, minWidth: 274 }}>
              <label className="input-label">Numéro de téléphone</label>
              <div className="input-field">
                <input
                  type="tel"
                  name="telephone"
                  placeholder="Votre numéro de téléphone"
                  value={formData.telephone}
                  onChange={handleChange}
                  required
                />
                {errors.telephone && <span style={{ color: 'red', fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.telephone}</span>}
              </div>
            </div>
            <div className="input-group" style={{ flex: 1, minWidth: 274 }}>
              <label className="input-label">Email</label>
              <div className="input-field">
                <input
                  type="email"
                  name="email"
                  placeholder="Votre adresse e-mail"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
                {errors.email && <span style={{ color: 'red', fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.email}</span>}
              </div>
            </div>
          </div>

          {/* Row 3: Adresse (full width) – Places API autocomplete via backend */}
          <div className="input-row">
            <div className="input-group" style={{ flex: 1, minWidth: '100%', position: 'relative' }}>
              <label className="input-label">Adresse</label>
              <div className="input-field" style={{ position: 'relative' }}>
                <input
                  ref={addressInputRef}
                  type="text"
                  name="adresse"
                  placeholder="Commencez à taper votre adresse..."
                  value={formData.adresse}
                  onChange={handleChange}
                  autoComplete="off"
                  required
                />
                {suggestionsLoading && (
                  <span
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: 12,
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    Recherche...
                  </span>
                )}
              </div>
              {errors.adresse && <span style={{ color: 'red', fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.adresse}</span>}
              {suggestionsVisible && suggestions.length > 0 && (
                <div
                  ref={suggestionsRef}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: 4,
                    background: 'var(--color-bg-white)',
                    border: '1px solid var(--color-border-input)',
                    borderRadius: 8,
                    boxShadow: 'var(--shadow-neutral-03)',
                    zIndex: 100,
                    maxHeight: 240,
                    overflowY: 'auto',
                  }}
                >
                  {suggestions.map((s) => (
                    <button
                      key={s.place_id}
                      type="button"
                      onClick={() => selectSuggestion(s.place_id)}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '12px 16px',
                        textAlign: 'left',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontSize: 14,
                        color: 'var(--color-text-dark)',
                        fontFamily: 'inherit',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--color-bg-f9f8ff)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      {s.description}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 4: Ville + Code postal */}
          <div className="input-row">
            <div className="input-group" style={{ flex: 1, minWidth: 274 }}>
              <label className="input-label">Ville</label>
              <div className="input-field">
                <input
                  type="text"
                  name="ville"
                  placeholder="Votre ville"
                  value={formData.ville}
                  onChange={handleChange}
                  required
                />
                {errors.ville && <span style={{ color: 'red', fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.ville}</span>}
              </div>
            </div>
            <div className="input-group" style={{ flex: 1, minWidth: 274 }}>
              <label className="input-label">Code postal</label>
              <div className="input-field">
                <input
                  type="text"
                  name="codePostal"
                  placeholder="Votre code postal"
                  value={formData.codePostal}
                  onChange={handleChange}
                  required
                />
                {errors.codePostal && <span style={{ color: 'red', fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.codePostal}</span>}
              </div>
            </div>
          </div>

          {/* Row 5: Autre informations (full width textarea) */}
          <div className="input-row">
            <div className="input-group" style={{ flex: 1, minWidth: '100%' }}>
              <label className="input-label">Autres informations</label>
              <div className="input-field" style={{ height: 'auto', padding: 0 }}>
                <textarea
                  name="autresInformations"
                  placeholder="Précisions supplémentaires, instructions pour l'accès..."
                  value={formData.autresInformations}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    minHeight: '100px',
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    padding: '12px 16px',
                    fontSize: '15px',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>

      <div className="plan-step-footer" style={{ marginTop: 32 }}>
        <span style={{ fontSize: 16, color: 'var(--color-text-muted)' }}>Étape 4 sur 6</span>
        <div style={{ display: 'flex', gap: 24 }}>
          <button className="btn btn-secondary" onClick={onBack}>Retour</button>
          <button className="btn btn-primary" onClick={handleNext}>Continuer</button>
        </div>
      </div>
    </div>
  )
}

export default Step01
