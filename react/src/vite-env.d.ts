/// <reference types="vite/client" />

interface PlaceResult {
  formatted_address?: string
  address_components?: Array<{ types: string[]; long_name: string }>
}

interface Window {
  google?: {
    maps: {
      places: {
        Autocomplete: new (
          input: HTMLInputElement,
          opts?: { types?: string[]; componentRestrictions?: { country: string | string[] } }
        ) => {
          addListener: (event: string, fn: () => void) => void
          getPlace: () => PlaceResult
        }
      }
    }
  }
}
