// API Service for connecting to Django backend
// Use a relative path so teammates can access your LAN-hosted frontend.
// `vite.config.ts` proxies `/api` -> Django.
const API_BASE_URL = '/api';

export interface SupplementaryService {
  id?: number;
  service_id: string;
  title: string;
  duration: string;
  price_discounted: number;
  price_original: number;
  quantity: number;
}

export interface Reservation {
  id?: number;
  prestation_type: string;
  selected_plan_id: string;
  selected_plan_title: string;
  selected_plan_price: number;
  selected_plan_duration: string;
  reservation_date: string; // ISO date string YYYY-MM-DD
  time_slot: string;
  nom: string;
  prenom: string;
  telephone: string;
  email: string;
  adresse: string;
  ville: string;
  code_postal: string;
  code_promo?: string;
  autres_informations?: string;
  supplementary_services?: SupplementaryService[];
  original_price?: number | string;
  discount_amount?: number | string;
  promo_code_applied?: number | null;
  promo_code?: string | null;
  promo_discount_type?: 'percentage' | 'fixed' | null;
  promo_discount_value?: number | string | null;
  effective_discount_percentage?: number | string | null;
  total_price?: number;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

// Generic fetch helper
async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Reservation API
export const reservationApi = {
  // Create a new reservation
  create: async (reservation: Reservation): Promise<Reservation> => {
    return apiFetch('/reservations/', {
      method: 'POST',
      body: JSON.stringify(reservation),
    });
  },

  // Get all reservations
  getAll: async (params?: { status?: string; email?: string; date_from?: string; date_to?: string }): Promise<Reservation[]> => {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.email) queryParams.append('email', params.email);
    if (params?.date_from) queryParams.append('date_from', params.date_from);
    if (params?.date_to) queryParams.append('date_to', params.date_to);
    
    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return apiFetch(`/reservations/${query}`);
  },

  // Get a single reservation
  getById: async (id: number): Promise<Reservation> => {
    return apiFetch(`/reservations/${id}/`);
  },

  // Update a reservation
  update: async (id: number, reservation: Partial<Reservation>): Promise<Reservation> => {
    return apiFetch(`/reservations/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(reservation),
    });
  },

  // Delete a reservation
  delete: async (id: number): Promise<void> => {
    return apiFetch(`/reservations/${id}/`, {
      method: 'DELETE',
    });
  },

  // Confirm a reservation
  confirm: async (id: number): Promise<{ status: string }> => {
    return apiFetch(`/reservations/${id}/confirm/`, {
      method: 'POST',
    });
  },

  // Cancel a reservation
  cancel: async (id: number): Promise<{ status: string }> => {
    return apiFetch(`/reservations/${id}/cancel/`, {
      method: 'POST',
    });
  },

  // Get booked slots for a given date (YYYY-MM-DD)
  getBookedSlots: async (dateStr: string): Promise<{ date: string; booked_slots: string[]; conge_slots?: string[]; conge_full_day?: boolean }> => {
    return apiFetch(`/reservations/available-slots/?date=${encodeURIComponent(dateStr)}`);
  },
};

// Places API (address autocomplete - API key kept server-side)
export const placesApi = {
  autocomplete: async (input: string, sessionToken?: string): Promise<{ predictions: Array<{ place_id: string; description: string }> }> => {
    const params = new URLSearchParams({ input: input.trim() });
    if (sessionToken) params.append('session_token', sessionToken);
    return apiFetch(`/places/autocomplete/?${params.toString()}`);
  },

  details: async (placeId: string, sessionToken?: string): Promise<{ formatted_address: string; ville: string; code_postal: string }> => {
    const params = new URLSearchParams({ place_id: placeId });
    if (sessionToken) params.append('session_token', sessionToken);
    return apiFetch(`/places/details/?${params.toString()}`);
  },
};

// Stripe payments API
export const paymentsApi = {
  getConfig: async (): Promise<{ publishable_key: string }> => {
    return apiFetch('/payments/config/');
  },

  createIntent: async (reservationId: number): Promise<{ client_secret: string; publishable_key?: string }> => {
    return apiFetch('/payments/create-intent/', {
      method: 'POST',
      body: JSON.stringify({ reservation_id: reservationId }),
    });
  },
};

// Promo code API
export const promoCodeApi = {
  validate: async (code: string, cartTotal: number): Promise<{
    valid: boolean;
    message: string;
    discount_amount: number | string;
    discount_type?: 'percentage' | 'fixed' | null;
    discount_value?: number | string | null;
    promo_id?: number;
  }> => {
    return apiFetch('/promo-codes/validate/', {
      method: 'POST',
      body: JSON.stringify({ code, cart_total: cartTotal }),
    });
  },
};

export default reservationApi;
