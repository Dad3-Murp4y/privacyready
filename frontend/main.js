// Scroll to top on refresh
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);

// Navbar scroll effect
window.addEventListener('scroll', function() {
  const nav = document.getElementById('navbar');
  if (window.scrollY > 50) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
});

// Mobile menu toggle
function toggleMobileMenu() {
  const navLinks = document.querySelector('.nav-links');
  const btn = document.querySelector('.mobile-menu-btn');
  const isOpen = navLinks.style.display === 'flex';
  navLinks.style.display = isOpen ? 'none' : 'flex';
  navLinks.style.position = 'absolute';
  navLinks.style.top = '68px';
  navLinks.style.left = '0';
  navLinks.style.right = '0';
  navLinks.style.flexDirection = 'column';
  navLinks.style.background = 'rgba(255,255,255,0.98)';
  navLinks.style.padding = '24px';
  navLinks.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)';
  navLinks.style.gap = '16px';
  navLinks.style.zIndex = '199';
  btn.setAttribute('aria-expanded', !isOpen);
}

// Cookie Consent
const GA_MEASUREMENT_ID = 'G-1J0Z7Q1PCV';

function getCookieDomain() {
  const host = window.location.hostname;
  return host.endsWith('privacyready.co.uk') ? '; domain=.privacyready.co.uk' : '';
}

function loadAnalytics() {
  if (window.__gaLoaded) return;
  window.__gaLoaded = true;

  // Insert GTM script dynamically
  (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','GTM-599K9SKZ');
  
  // Insert gtag script dynamically
  const script = document.createElement('script');
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
  script.async = true;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  
  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID);
  
  gtag('consent', 'update', {
    'analytics_storage': 'granted',
    'ad_storage': 'denied',
    'ad_user_data': 'denied',
    'ad_personalization': 'denied'
  });
}

function closeCookieBanner() {
  const banner = document.getElementById('cookieBanner');
  if (banner) banner.classList.remove('show');
  document.body.style.overflow = '';
}

function acceptCookies() {
  const domainAttr = getCookieDomain();
  document.cookie = `privacyready-cookies=accepted${domainAttr}; path=/; max-age=31536000; SameSite=Lax`;
  closeCookieBanner();
  loadAnalytics();
}

function declineCookies() {
  const domainAttr = getCookieDomain();
  document.cookie = `privacyready-cookies=declined${domainAttr}; path=/; max-age=31536000; SameSite=Lax`;
  closeCookieBanner();
}

function resetCookieConsent() {
  const domainAttr = getCookieDomain();
  document.cookie = `privacyready-cookies=${domainAttr}; path=/; max-age=0`;
  document.cookie = `privacyready-cookies=; path=/; max-age=0`;
  location.reload();
}

function initCookieBanner() {
  const banner = document.getElementById('cookieBanner');
  if (!banner) return;

  // Support force reset via query string (e.g. ?reset_cookies=1 or ?cookie_banner=1)
  if (window.location.search.includes('reset_cookies') || window.location.search.includes('cookie_banner')) {
    const domainAttr = getCookieDomain();
    document.cookie = `privacyready-cookies=${domainAttr}; path=/; max-age=0`;
    document.cookie = `privacyready-cookies=; path=/; max-age=0`;
  }

  const consentMatch = document.cookie.match(/(?:^|;\s*)privacyready-cookies=([^;]*)/);
  const consent = consentMatch ? consentMatch[1] : null;

  if (consent === 'accepted') {
    loadAnalytics();
    return;
  }
  if (consent === 'declined') {
    return; // respect the earlier choice
  }

  // Show cookie banner if no choice has been saved
  banner.classList.add('show');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCookieBanner);
} else {
  initCookieBanner();
}

// Form Handling
function handleFormSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const data = new FormData(form);

  // Simulate submission
  console.log('Form submitted:', Object.fromEntries(data));

  // Show success state
  document.getElementById('contactFormWrap').style.display = 'none';
  document.getElementById('formSuccess').classList.add('show');

  // In production, you would send this to your backend:
  // fetch('/api/audit-request', { method: 'POST', body: data })
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// Intersection Observer for scroll animations
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.who-card, .service-card, .testi-card, .price-card, .timeline-item').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
  });
}

// Dynamic Environment Routing for Static Links
if (window.location.hostname.includes('test.')) {
  document.querySelectorAll('a[href*="portal.privacyready.co.uk"]').forEach(a => {
    if (!a.href.includes('test-portal.')) {
      a.href = a.href.replace('portal.privacyready.co.uk', 'test-portal.privacyready.co.uk');
    }
  });
}

// Maintenance Mode Detection
async function checkMaintenanceMode() {
  const apiUrl = window.location.hostname.includes('test.') 
    ? 'https://test-api.privacyready.co.uk/health' 
    : 'https://api.privacyready.co.uk/health';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000); // 4 second timeout
    
    const resp = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (!resp.ok) {
      throw new Error('API returned ' + resp.status);
    }
    // If successful, do nothing (maintenance mode is OFF)
  } catch (err) {
    console.warn("API is unreachable. Enabling maintenance mode UI.", err);
    // Show banner
    const banner = document.getElementById('maintenance-banner');
    if (banner) banner.style.display = 'flex';
    
    // Hide marketing strip so it doesn't clutter
    const marketingStrip = document.getElementById('marketing-alert-strip');
    if (marketingStrip) marketingStrip.style.display = 'none';

    // Disable scan buttons
    const btn1 = document.getElementById('scan-btn');
    const btn2 = document.getElementById('scan-social-btn');
    if (btn1) {
      btn1.disabled = true;
      btn1.innerHTML = '<span class="scan-btn-text">Scanner Offline</span>';
      btn1.style.backgroundColor = '#64748b';
    }
    if (btn2) {
      btn2.disabled = true;
      btn2.innerHTML = '<span class="scan-btn-text">Scanner Offline</span>';
      btn2.style.backgroundColor = '#64748b';
    }
  }
}

// Run the check when the script loads
checkMaintenanceMode();
