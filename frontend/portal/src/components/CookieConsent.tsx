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
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '24px',
      right: '24px',
      backgroundColor: '#1e293b',
      color: '#f8fafc',
      padding: '24px',
      borderRadius: '12px',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      border: '1px solid rgba(255,255,255,0.1)'
    }}>
      <div>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>Your Privacy Choices</h3>
        <p style={{ margin: 0, fontSize: '14px', color: '#cbd5e1', lineHeight: '1.5' }}>
          We use essential cookies to run this site, and optional analytics cookies to understand how it's used.
          Choose "Decline Optional" to use only essential cookies, or "Accept All" to also allow analytics.
        </p>
      </div>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <button 
          onClick={handleDecline}
          style={{
            padding: '8px 16px',
            backgroundColor: 'transparent',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'white',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          Decline Optional
        </button>
        <button 
          onClick={handleAccept}
          style={{
            padding: '8px 16px',
            backgroundColor: '#0ea5e9',
            border: 'none',
            color: 'white',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          Accept All
        </button>
      </div>
    </div>
  );
}
