import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isBefore,
  startOfDay,
} from 'date-fns'
import { fr } from 'date-fns/locale'

const WEEKDAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

interface ProCalendarProps {
  readonly selected?: Date | null
  readonly onSelect?: (date: Date) => void
  readonly month: Date
  readonly onMonthChange: (date: Date) => void
  readonly className?: string
  /** If set, dates before this date cannot be selected (e.g. today for no past dates) */
  readonly minDate?: Date
}

function ProCalendar({
  selected,
  onSelect,
  month,
  onMonthChange,
  className = '',
  minDate,
}: ProCalendarProps) {
  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

  const weeks: Date[][] = []
  let day = calendarStart

  while (day <= calendarEnd) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) {
      week.push(day)
      day = addDays(day, 1)
    }
    weeks.push(week)
  }

  const handlePrevMonth = () => {
    onMonthChange(subMonths(month, 1))
  }

  const handleNextMonth = () => {
    onMonthChange(addMonths(month, 1))
  }

  return (
    <div className={`pro-calendar ${className}`}>
      <div className="pro-calendar-header">
        <button
          type="button"
          className="pro-calendar-nav"
          onClick={handlePrevMonth}
          aria-label="Mois précédent"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="pro-calendar-title">
          {format(month, 'MMMM yyyy', { locale: fr })}
        </span>
        <button
          type="button"
          className="pro-calendar-nav"
          onClick={handleNextMonth}
          aria-label="Mois suivant"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      <div className="pro-calendar-weekdays">
        {WEEKDAYS.map((day) => (
          <div key={day} className="pro-calendar-weekday">
            {day}
          </div>
        ))}
      </div>

      <div className="pro-calendar-grid">
        {weeks.map((week) => (
          <div key={week[0].toISOString()} className="pro-calendar-week">
            {week.map((date) => {
              const isCurrentMonth = isSameMonth(date, month)
              const isSelected = selected ? isSameDay(date, selected) : false
              const isToday = isSameDay(date, new Date())
              const isPast = minDate ? isBefore(startOfDay(date), startOfDay(minDate)) : false
              // Only block truly past dates; allow selecting future overflow days
              // (e.g. next month's first days visible in current month grid).
              const isDisabled = isPast

              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  className={`pro-calendar-day ${isCurrentMonth ? '' : 'adjacent-month'} ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${isDisabled ? 'disabled' : ''}`}
                  onClick={() => {
                    if (isDisabled) return
                    onSelect?.(date)
                  }}
                  disabled={isDisabled}
                  aria-disabled={isDisabled}
                >
                  {format(date, 'd')}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export default ProCalendar
