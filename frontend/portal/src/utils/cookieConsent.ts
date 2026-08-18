export const CONSENT_KEY = 'gdpr_cookie_consent';
export const CONSENT_EVENT = 'privacyready:consent-changed';
export const OPEN_SETTINGS_EVENT = 'privacyready:open-cookie-settings';

export function openCookieSettings(): void {
  window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT));
}

export function hasAnalyticsConsent(): boolean {
  return localStorage.getItem(CONSENT_KEY) === 'accepted';
}
