import { useState, useEffect, useCallback } from 'react'
import { format, isSameDay, startOfDay } from 'date-fns'
import ProCalendar from './ProCalendar'
import { reservationApi } from '../services/api'

const TIME_SLOTS = [
  "9h00", "10h30", "12h00", "13h30",
  "15h00", "16h30", "18h00", "19h30",
  "21h00"
]

function slotToMinutes(slot: string): number {
  const m = /^(\d{1,2})h(\d{2})$/.exec(slot)
  if (!m) return -1
  const h = Number.parseInt(m[1], 10)
  const mn = Number.parseInt(m[2], 10)
  if (h >= 0 && h <= 23 && mn >= 0 && mn <= 59) {
    return h * 60 + mn
  }
  return -1
}

interface Step03DateHeureProps {
  readonly onNext: () => void
  readonly onBack: () => void
  readonly onDateTimeChange?: (date: Date | undefined, time: string | undefined) => void
  readonly initialSelectedDate?: Date
  readonly initialTimeSlot?: string
}

function Step03DateHeure({ onNext, onBack, onDateTimeChange, initialSelectedDate, initialTimeSlot }: Step03DateHeureProps) {
  const today = startOfDay(new Date())
  const [month, setMonth] = useState<Date>(() => new Date())
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => {
    const init = initialSelectedDate ?? new Date()
    return init < today ? today : init
  })
  const [time, setTime] = useState<string | undefined>(initialTimeSlot)
  const [bookedSlots, setBookedSlots] = useState<string[]>([])
  const [congeSlots, setCongeSlots] = useState<string[]>([])

  const fetchBookedSlots = useCallback(async (date: Date | undefined) => {
    if (!date) {
      setBookedSlots([])
      return
    }
    try {
      const dateStr = format(date, 'yyyy-MM-dd')
      const { booked_slots, conge_slots } = await reservationApi.getBookedSlots(dateStr)
      setBookedSlots(booked_slots)
      setCongeSlots(conge_slots || [])
    } catch {
      setBookedSlots([])
    }
  }, [])

  useEffect(() => {
    fetchBookedSlots(selectedDate)
  }, [selectedDate, fetchBookedSlots])

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date)
    setTime(undefined)
    onDateTimeChange?.(date, undefined)
  }

  const handleTimeSelect = (slot: string) => {
    setTime(slot)
    onDateTimeChange?.(selectedDate, slot)
  }

  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const isSelectedToday = selectedDate ? isSameDay(selectedDate, now) : false

  const getSlotStatus = (slot: string): 'available' | 'complet' | 'past' | 'conge' => {
    if (congeSlots.includes(slot)) return 'conge'
    if (bookedSlots.includes(slot)) return 'complet'
    if (isSelectedToday) {
      const slotMinutes = slotToMinutes(slot)
      if (slotMinutes >= 0 && slotMinutes <= currentMinutes) return 'past'
    }
    return 'available'
  }

  const getSlotButtonStyle = (
    status: 'available' | 'complet' | 'past' | 'conge',
    isSelected: boolean,
    isDisabled: boolean
  ) => {
    const base = {
      padding: '0',
      height: '100%',
      minHeight: '48px',
      fontSize: '16px',
      fontWeight: 500,
      borderRadius: '8px',
      transition: 'all 0.2s',
      width: '100%',
    } as const
    if (isDisabled) {
      const border = status === 'complet' ? '1px solid #fdba74' : status === 'conge' ? '1px solid #fca5a5' : '1px solid var(--color-border)'
      const bg = status === 'complet' ? '#fff7ed' : status === 'conge' ? '#fef2f2' : '#f5f5f5'
      const color = status === 'complet' ? '#ea580c' : status === 'conge' ? '#dc2626' : 'var(--color-text-light)'
      return { ...base, border, background: bg, color, cursor: 'not-allowed' as const }
    }
    return {
      ...base,
      border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-primary-border)',
      background: isSelected ? 'var(--gradient-primary)' : 'var(--color-bg-f9f8ff)',
      color: isSelected ? 'white' : 'var(--color-primary)',
      cursor: 'pointer' as const,
    }
  }

  return (
    <div className="form-step-card form-step-v2">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 15, paddingTop: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: 16 }}>
            <h2 className="form-step-title" style={{ marginBottom: 0 }}>Date et Heure</h2>
            <span style={{ fontSize: 16, color: 'var(--color-text-muted)' }}>Étape 3/6</span>
          </div>
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.5, marginTop: -8 }}>
            Sélectionnez le créneau qui vous convient.
          </p>

          <div className="date-heure-row" style={{ display: 'flex', gap: '24px', width: '100%', marginTop: '16px' }}>
            <div className="pro-calendar-wrapper" style={{ flex: 2, minWidth: 0 }}>
              <ProCalendar
                selected={selectedDate}
                onSelect={handleDateSelect}
                month={month}
                onMonthChange={setMonth}
                minDate={today}
              />
            </div>

            <div
              className="time-slots-wrapper"
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <p className="time-slots-header" style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                Sélectionnez un créneau horaire
              </p>
              <div className="time-slots-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', flex: 1 }}>
                {TIME_SLOTS.map((slot) => {
                  const status = getSlotStatus(slot)
                  const isSelected = time === slot
                  const isDisabled = status === 'complet' || status === 'past' || status === 'conge'
                  const label = (() => {
                    if (status === 'complet') return 'Complet'
                    if (status === 'conge') return 'Non disponible'
                    if (status === 'past') return 'Non disponible'
                    return slot
                  })()

                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={isDisabled}
                      className={`time-slot-btn ${isDisabled ? 'time-slot-reserved' : ''}`}
                      style={getSlotButtonStyle(status, isSelected, isDisabled)}
                      onClick={() => !isDisabled && handleTimeSelect(slot)}
                      onMouseEnter={(e) => {
                        if (!isDisabled && !isSelected) {
                          e.currentTarget.style.borderColor = 'var(--color-primary)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isDisabled && !isSelected) {
                          e.currentTarget.style.borderColor = 'var(--color-primary-border)'
                        }
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="plan-step-footer" style={{ marginTop: 24 }}>
        <span style={{ fontSize: 16, color: 'var(--color-text-muted)' }}>Étape 3 sur 6</span>
        <div style={{ display: 'flex', gap: 24 }}>
          <button className="btn btn-secondary" onClick={onBack}>Retour</button>
          <button
            className="btn btn-primary"
            onClick={onNext}
            disabled={!selectedDate || !time}
            style={{ backgroundColor: 'var(--color-primary)', backgroundImage: 'none', borderColor: 'var(--color-primary)' }}
          >
            Continuer
          </button>
        </div>
      </div>
    </div>
  )
}

export default Step03DateHeure
