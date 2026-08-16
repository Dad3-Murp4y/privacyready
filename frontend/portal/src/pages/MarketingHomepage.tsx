import { useEffect } from 'react';
import originalHomepage from '../../../index.html?raw';
import marketingStyles from '../../../styles.css?url';

type PublicFinding = {
  finding_type?: string;
  severity?: string;
  description?: string;
};

type PublicScanResponse = {
  id: string;
  targetIdentifier: string;
  score: number | null;
  findingsJson: PublicFinding[];
  claimToken: string;
};

type MarketingWindow = Window & {
  acceptCookies?: () => void;
  declineCookies?: () => void;
  resetCookieConsent?: () => void;
  updateFineCalc?: () => void;
  startScan?: (event: Event) => void;
  startSocialScan?: (event: Event) => void;
  switchScanTab?: (tab: 'website' | 'social') => void;
  toggleMobileMenu?: () => void;
};

// The original marketing page is the source of truth for the retained
// branding, copy, navigation, feature sections, pricing and footer. Scripts
// are intentionally excluded: the React bridge below replaces only the old
// browser-side scan behaviour with the protected API flow.
const marketingMarkup = originalHomepage
  .replace(/^[\s\S]*?<body[^>]*>/i, '')
  .replace(/<\/body>[\s\S]*$/i, '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

function severityCount(findings: PublicFinding[], severity: string) {
  return findings.filter((finding) => finding.severity?.toLowerCase() === severity).length;
}

export default function MarketingHomepage() {
  useEffect(() => {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = marketingStyles;
    stylesheet.dataset.privacyreadyMarketing = 'true';
    document.head.appendChild(stylesheet);

    const body = document.body;
    const previousLang = body.getAttribute('lang');
    body.setAttribute('lang', 'en');

    const form = document.getElementById('scan-form-website') as HTMLFormElement | null;
    const input = document.getElementById('scan-url-input') as HTMLInputElement | null;
    const button = document.getElementById('scan-btn') as HTMLButtonElement | null;
    const icon = document.getElementById('scan-btn-icon');
    const panel = document.getElementById('scan-results');
    const targetElement = document.getElementById('scan-target-display');
    const scoreElement = document.getElementById('scan-score-badge');
    const findingsElement = document.getElementById('scan-checks-list');
    const note = document.getElementById('scan-note-en');
    const socialForm = document.getElementById('scan-form-social') as HTMLFormElement | null;
    form?.removeAttribute('onsubmit');
    socialForm?.removeAttribute('onsubmit');
    note?.replaceChildren(document.createTextNode('Free instant website preview · Full findings and remediation guidance are available after sign-up'));

    const updateButton = (scanning: boolean) => {
      if (!button || !icon) return;
      button.disabled = scanning;
      icon.innerHTML = scanning ? '<span class="spin"></span>' : '🔍';
      const label = button.querySelector('.scan-btn-text');
      if (label) label.textContent = scanning ? 'Scanning…' : 'Check Free';
    };

    const showMessage = (message: string) => {
      if (!panel || !findingsElement || !scoreElement || !targetElement) return;
      panel.classList.add('visible');
      scoreElement.textContent = '';
      targetElement.textContent = 'Website scan';
      findingsElement.replaceChildren();
      const item = document.createElement('li');
      item.className = 'scan-check warn';
      item.textContent = message;
      findingsElement.appendChild(item);
    };

    const renderResult = (result: PublicScanResponse) => {
      if (!panel || !findingsElement || !scoreElement || !targetElement) return;
      const findings = Array.isArray(result.findingsJson) ? result.findingsJson : [];
      panel.classList.add('visible');
      targetElement.textContent = result.targetIdentifier;
      scoreElement.textContent = `${result.score ?? 0}/100 · ${findings.length} potential issue${findings.length === 1 ? '' : 's'}`;
      scoreElement.className = `scan-score ${(result.score ?? 0) >= 70 ? 'good' : (result.score ?? 0) >= 40 ? 'medium' : 'poor'}`;
      findingsElement.replaceChildren();

      const counts = document.createElement('li');
      counts.className = 'scan-check pending';
      counts.textContent = `${severityCount(findings, 'high')} High · ${severityCount(findings, 'medium')} Medium · ${severityCount(findings, 'low')} Low potential concerns`;
      findingsElement.appendChild(counts);

      findings.slice(0, 3).forEach((finding) => {
        const item = document.createElement('li');
        item.className = `scan-check ${finding.severity === 'high' ? 'fail' : 'warn'}`;
        const title = document.createElement('span');
        title.className = 'check-label';
        title.textContent = `Potential privacy issue: ${(finding.finding_type || 'Requires review').replaceAll('_', ' ')}`;
        const description = document.createElement('span');
        description.className = 'check-detail';
        description.textContent = finding.description || 'Requires review.';
        item.append('⚠️ ', title, description);
        findingsElement.appendChild(item);
      });

      const cta = document.createElement('li');
      cta.className = 'scan-check pending';
      const register = document.createElement('a');
      register.className = 'scan-blur-btn';
      register.href = '/register?source=free-scan';
      register.textContent = 'View full report · Create free account →';
      register.addEventListener('click', () => {
        // Keep the one-time claim token out of URLs and referrers. The API
        // verifies the stored hash and expiry before associating a scan.
        sessionStorage.setItem('freeScanId', result.id);
        sessionStorage.setItem('freeScanClaimToken', result.claimToken);
        sessionStorage.setItem('freeScanUrl', result.targetIdentifier);
        sessionStorage.setItem('freeScanScore', String(result.score ?? 0));
      });
      cta.appendChild(register);
      const login = document.createElement('a');
      login.className = 'scan-blur-btn';
      login.href = '/login';
      login.textContent = 'Already have an account? Log in';
      login.style.marginLeft = '10px';
      login.addEventListener('click', () => {
        sessionStorage.setItem('freeScanId', result.id);
        sessionStorage.setItem('freeScanClaimToken', result.claimToken);
      });
      cta.appendChild(login);
      findingsElement.appendChild(cta);
    };

    const startScan = async (event: Event) => {
      event.preventDefault();
      const targetIdentifier = input?.value.trim() || '';
      if (!targetIdentifier) return;
      updateButton(true);
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/public/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetIdentifier, scanType: 'website' }),
        });
        const data = await response.json();
        if (!response.ok) {
          if (response.status === 429) throw new Error('You have reached the free scan limit for this website. Please try again shortly.');
          throw new Error(data.error || 'The website scan could not be completed.');
        }
        renderResult(data as PublicScanResponse);
      } catch (error: any) {
        showMessage(error.message || 'The website scan could not be completed. Please try again.');
      } finally {
        updateButton(false);
      }
    };

    const startSocialScan = (event: Event) => {
      event.preventDefault();
      // Commit 8463c11 exposed this form publicly, but its implementation
      // called a retired public endpoint and inferred results in the browser.
      // The current API deliberately limits anonymous scanning to public
      // websites. Preserve the historical UI without inventing results or
      // sending social account identifiers down an unsupported public path.
      if (!panel || !findingsElement || !scoreElement || !targetElement) return;
      panel.classList.add('visible');
      scoreElement.textContent = '';
      targetElement.textContent = 'Social & Apps Audit';
      findingsElement.replaceChildren();
      const message = document.createElement('li');
      message.className = 'scan-check warn';
      message.textContent = 'Social & Apps Audit is available from the authenticated PrivacyReady dashboard.';
      const cta = document.createElement('li');
      cta.className = 'scan-check pending';
      const register = document.createElement('a');
      register.className = 'scan-blur-btn';
      register.href = '/register';
      register.textContent = 'Create free account →';
      cta.appendChild(register);
      findingsElement.append(message, cta);
    };

    const switchScanTab = (tab: 'website' | 'social') => {
      document.querySelectorAll<HTMLButtonElement>('.scan-tab').forEach((tabButton) => {
        tabButton.classList.toggle('active', tabButton.id === `tab-${tab}`);
      });
      if (form) form.style.display = tab === 'website' ? 'flex' : 'none';
      if (socialForm) socialForm.style.display = tab === 'social' ? 'flex' : 'none';
      panel?.classList.remove('visible');
      findingsElement?.replaceChildren();
      if (note) {
        note.textContent = tab === 'website'
          ? 'Free instant website preview · Full findings and remediation guidance are available after sign-up'
          : 'Social & Apps Audit is available from the authenticated dashboard';
      }
    };

    const handleScroll = () => document.getElementById('navbar')?.classList.toggle('scrolled', window.scrollY > 50);
    const toggleMobileMenu = () => {
      const links = document.querySelector<HTMLElement>('.nav-links');
      const mobileButton = document.querySelector<HTMLButtonElement>('.mobile-menu-btn');
      if (!links || !mobileButton) return;
      const open = links.dataset.open === 'true';
      links.dataset.open = String(!open);
      links.style.display = open ? '' : 'flex';
      mobileButton.setAttribute('aria-expanded', String(!open));
    };
    const setConsent = (value: 'accepted' | 'declined') => {
      localStorage.setItem('gdpr_cookie_consent', value);
      document.getElementById('cookieBanner')?.classList.remove('show');
    };
    const appWindow = window as MarketingWindow;
    appWindow.startScan = startScan;
    appWindow.startSocialScan = startSocialScan;
    appWindow.switchScanTab = switchScanTab;
    appWindow.toggleMobileMenu = toggleMobileMenu;
    appWindow.acceptCookies = () => setConsent('accepted');
    appWindow.declineCookies = () => setConsent('declined');
    appWindow.resetCookieConsent = () => {
      localStorage.removeItem('gdpr_cookie_consent');
      document.getElementById('cookieBanner')?.classList.add('show');
    };
    appWindow.updateFineCalc = () => {
      const total = [...document.querySelectorAll<HTMLInputElement>('.fine-risk-chk:checked')]
        .reduce((sum, checkbox) => sum + Number(checkbox.dataset.amount || 0), 0);
      const totalElement = document.getElementById('calc-total-display');
      if (totalElement) totalElement.textContent = total ? `£${total.toLocaleString()}` : 'Up to £17.5M';
    };

    if (localStorage.getItem('gdpr_cookie_consent')) document.getElementById('cookieBanner')?.classList.remove('show');
    else document.getElementById('cookieBanner')?.classList.add('show');
    form?.addEventListener('submit', startScan);
    socialForm?.addEventListener('submit', startSocialScan);
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    document.querySelectorAll<HTMLAnchorElement>('a[href*="portal.privacyready.co.uk"]').forEach((link) => {
      const parsed = new URL(link.href);
      const path = parsed.pathname === '/' && link.textContent?.trim().toLowerCase() === 'login' ? '/login' : parsed.pathname;
      link.href = `${window.location.origin}${path}${parsed.search}`;
      link.removeAttribute('target');
    });

    return () => {
      form?.removeEventListener('submit', startScan);
      socialForm?.removeEventListener('submit', startSocialScan);
      window.removeEventListener('scroll', handleScroll);
      stylesheet.remove();
      if (previousLang) body.setAttribute('lang', previousLang);
      else body.removeAttribute('lang');
      delete appWindow.startScan;
      delete appWindow.startSocialScan;
      delete appWindow.switchScanTab;
      delete appWindow.toggleMobileMenu;
      delete appWindow.acceptCookies;
      delete appWindow.declineCookies;
      delete appWindow.resetCookieConsent;
      delete appWindow.updateFineCalc;
    };
  }, []);

  return <div data-marketing-homepage dangerouslySetInnerHTML={{ __html: marketingMarkup }} />;
}
