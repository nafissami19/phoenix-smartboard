/** Tell the device backup that a lasting preference changed (it batches saves). Skip for short-lived state such as views. */
export function notifyPreferencesChanged(){try{window.dispatchEvent(new Event('phoenix-preferences-changed'));}catch{/* No window during tests. */}}
