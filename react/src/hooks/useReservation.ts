import { useState, useCallback, useMemo } from 'react';
import { reservationApi, Reservation, SupplementaryService } from '../services/api';

// Types for form data collected at each step
export interface Step1Data {
  prestationType: string;
  selectedPlan: {
    id: string;
    title: string;
    price: number;
    duration: string;
  };
}

export interface Step2Data {
  wantsSupplementary: boolean;
  quantities: Record<string, number>; // service_id -> quantity
}

export interface Step3Data {
  selectedDate: Date | undefined;
  timeSlot: string | undefined;
}

export interface Step4Data {
  nom: string;
  prenom: string;
  telephone: string;
  email: string;
  adresse: string;
  ville: string;
  codePostal: string;
  codePromo: string;
  autresInformations: string;
}

// Complete reservation form data
export interface ReservationFormData {
  step1: Step1Data | null;
  step2: Step2Data | null;
  step3: Step3Data | null;
  step4: Step4Data | null;
}

// Hook return type
interface UseReservationReturn {
  formData: ReservationFormData;
  latestReservation: Reservation | null;
  currentReservationId: number | null;
  computedTotal: number;
  isSubmitting: boolean;
  error: string | null;
  setError: (msg: string | null) => void;
  success: boolean;
  updateStep1: (data: Step1Data) => void;
  updateStep2: (data: Step2Data) => void;
  updateStep3: (data: Step3Data) => void;
  updateStep4: (data: Step4Data) => void;
  submitReservation: (promoCodeOverride?: string) => Promise<number | null>;
  confirmReservation: () => Promise<void>;
  confirmReservationById: (id: number) => Promise<void>;
  resetForm: () => void;
}

const initialFormData: ReservationFormData = {
  step1: null,
  step2: null,
  step3: null,
  step4: null,
};

// Supplementary services definition (matches Step02Prestation.tsx) - exported for Step04
export const SUPPLEMENTARY_SERVICES = [
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
];

export function useReservation(): UseReservationReturn {
  const [formData, setFormData] = useState<ReservationFormData>(initialFormData);
  const [currentReservationId, setCurrentReservationId] = useState<number | null>(null);
  const [latestReservation, setLatestReservation] = useState<Reservation | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const updateStep1 = useCallback((data: Step1Data) => {
    setFormData((prev) => ({ ...prev, step1: data }));
  }, []);

  const updateStep2 = useCallback((data: Step2Data) => {
    setFormData((prev) => ({ ...prev, step2: data }));
  }, []);

  const updateStep3 = useCallback((data: Step3Data) => {
    setFormData((prev) => ({ ...prev, step3: data }));
  }, []);

  const updateStep4 = useCallback((data: Step4Data) => {
    setFormData((prev) => ({ ...prev, step4: data }));
  }, []);

  const buildReservationPayload = useCallback((promoCodeOverride?: string): Reservation => {
    const { step1, step2, step3, step4 } = formData;
    
    if (!step1 || !step3 || !step4) {
      throw new Error('Missing required form data');
    }

    // IMPORTANT: keep date consistent with the UI.
    // `toISOString()` converts to UTC and can shift the date (off by 1 day),
    // which makes the backend validate the wrong `reservation_date`.
    const reservationDateStr = step3.selectedDate
      ? `${step3.selectedDate.getFullYear()}-${String(step3.selectedDate.getMonth() + 1).padStart(2, '0')}-${String(step3.selectedDate.getDate()).padStart(2, '0')}`
      : '';

    // Build supplementary services from quantities
    const supplementaryServices: SupplementaryService[] = [];
    if (step2?.wantsSupplementary && step2.quantities) {
      Object.entries(step2.quantities).forEach(([serviceId, quantity]) => {
        if (quantity > 0) {
          const serviceDef = SUPPLEMENTARY_SERVICES.find((s) => s.id === serviceId);
          if (serviceDef) {
            supplementaryServices.push({
              service_id: serviceId,
              title: serviceDef.title,
              duration: serviceDef.duration,
              price_discounted: serviceDef.priceDiscounted,
              price_original: serviceDef.priceOriginal,
              quantity: quantity,
            });
          }
        }
      });
    }

    return {
      prestation_type: step1.prestationType,
      selected_plan_id: step1.selectedPlan.id,
      selected_plan_title: step1.selectedPlan.title,
      selected_plan_price: step1.selectedPlan.price,
      selected_plan_duration: step1.selectedPlan.duration,
      reservation_date: reservationDateStr,
      time_slot: step3.timeSlot || '',
      nom: step4.nom,
      prenom: step4.prenom,
      telephone: step4.telephone,
      email: step4.email,
      adresse: step4.adresse,
      ville: step4.ville,
      code_postal: step4.codePostal,
      code_promo: promoCodeOverride?.trim() || step4.codePromo || undefined,
      autres_informations: step4.autresInformations || undefined,
      supplementary_services: supplementaryServices,
    };
  }, [formData]);

  const submitReservation = useCallback(async (promoCodeOverride?: string): Promise<number | null> => {
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const payload = buildReservationPayload(promoCodeOverride);
      const response = await reservationApi.create(payload);
      const id = response.id ?? null;
      setCurrentReservationId(id);
      setLatestReservation(response);
      setSuccess(true);
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit reservation');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [buildReservationPayload]);

  const computedTotal = useMemo(() => {
    const { step1, step2 } = formData;
    if (!step1) return 0;
    let total = step1.selectedPlan.price;
    if (step2?.wantsSupplementary && step2.quantities) {
      Object.entries(step2.quantities).forEach(([serviceId, quantity]) => {
        if (quantity > 0) {
          const def = SUPPLEMENTARY_SERVICES.find((s) => s.id === serviceId);
          if (def) total += def.priceDiscounted * quantity;
        }
      });
    }
    return total;
  }, [formData]);

  const confirmReservationById = useCallback(async (id: number) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await reservationApi.confirm(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm reservation');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const confirmReservation = useCallback(async () => {
    if (!currentReservationId) return;
    await confirmReservationById(currentReservationId);
  }, [currentReservationId, confirmReservationById]);

  const resetForm = useCallback(() => {
    setFormData(initialFormData);
    setCurrentReservationId(null);
    setLatestReservation(null);
    setError(null);
    setSuccess(false);
  }, []);

  return {
    formData,
    latestReservation,
    currentReservationId,
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
  };
}
