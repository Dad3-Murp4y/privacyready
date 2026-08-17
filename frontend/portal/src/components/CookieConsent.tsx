import { useState, useEffect } from 'react';

const CONSENT_KEY = 'gdpr_cookie_consent';
const CONSENT_EVENT = 'privacyready:consent-changed';

/**
 * Call this before initializing any non-essential script (analytics,
 * ads, embeds). Returns false until the user has explicitly accepted.
 * This is the single source of truth for consent state — any script
 * loader in the app should check this instead of reading localStorage
 * directly, so gating logic lives in one place.
 */
export function hasAnalyticsConsent(): boolean {
  return localStorage.getItem(CONSENT_KEY) === 'accepted';
}

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const setConsent = (value: 'accepted' | 'declined') => {
    localStorage.setItem(CONSENT_KEY, value);
    // Notify any already-mounted components (e.g. an analytics loader)
    // that consent state changed, since localStorage writes don't fire
    // a storage event in the same tab that wrote them.
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
    setIsVisible(false);
  };

  const handleAccept = () => setConsent('accepted');
  const handleDecline = () => setConsent('declined');

  if (!isVisible) return null;

  return (
    <section className="cookie-consent" aria-labelledby="cookie-consent-title">
      <div>
        <h2 id="cookie-consent-title">Your privacy choices</h2>
        <p>
          We use essential cookies to run this site, and optional analytics cookies to understand how it's used.
          Choose essential only or allow analytics too.
        </p>
      </div>
      <div className="cookie-consent__actions">
        <button type="button" onClick={handleDecline}>Essential only</button>
        <button type="button" className="is-primary" onClick={handleAccept}>Accept analytics</button>
      </div>
    </section>
  );
}
