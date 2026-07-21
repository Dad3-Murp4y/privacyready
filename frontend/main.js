// Language Switcher
const overlayLabels = {
  en: 'Select Language',
  th: 'เลือกภาษา',
  ru: 'Выберите язык'
};

const overlayFooters = {
  en: 'PrivacyReady — Thailand GDPR Compliance',
  th: 'PrivacyReady — การปฏิบัติตาม GDPR ไทย',
  ru: 'PrivacyReady — Соответствие GDPR Таиланда'
};

function setLang(lang) {
  document.body.setAttribute('lang', lang);
  localStorage.setItem('privacyready-lang', lang);

  // Update trigger label
  const label = document.getElementById('currentLangLabel');
  if (label) label.textContent = lang.toUpperCase();

  // Update overlay label and footer
  const overlayLabel = document.getElementById('overlayLabel');
  if (overlayLabel) overlayLabel.textContent = overlayLabels[lang] || overlayLabels.en;

  const overlayFooter = document.getElementById('overlayFooter');
  if (overlayFooter) overlayFooter.textContent = overlayFooters[lang] || overlayFooters.en;

  // Update active state in overlay
  document.querySelectorAll('.lang-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.langTarget === lang);
  });

  // Close overlay if open
  const overlay = document.getElementById('langOverlay');
  if (overlay && overlay.classList.contains('show')) {
    toggleLangOverlay();
  }
}

function toggleLangOverlay() {
  const overlay = document.getElementById('langOverlay');
  const trigger = document.getElementById('langTrigger');
  const isOpen = overlay.classList.toggle('show');

  trigger.classList.toggle('open', isOpen);
  trigger.setAttribute('aria-expanded', isOpen);

  if (isOpen) {
    // Focus first option for accessibility
    setTimeout(() => {
      const firstOption = overlay.querySelector('.lang-option');
      if (firstOption) firstOption.focus();
    }, 100);
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
    trigger.focus();
  }
}

// Close overlay on Escape key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const overlay = document.getElementById('langOverlay');
    if (overlay && overlay.classList.contains('show')) {
      toggleLangOverlay();
    }
  }
});

// Restore saved language
(function() {
  const saved = localStorage.getItem('privacyready-lang');
  if (saved && ['en', 'th', 'ru'].includes(saved)) {
    document.body.setAttribute('lang', saved);
    const label = document.getElementById('currentLangLabel');
    if (label) label.textContent = saved.toUpperCase();

    const overlayLabel = document.getElementById('overlayLabel');
    if (overlayLabel) overlayLabel.textContent = overlayLabels[saved] || overlayLabels.en;

    const overlayFooter = document.getElementById('overlayFooter');
    if (overlayFooter) overlayFooter.textContent = overlayFooters[saved] || overlayFooters.en;

    document.querySelectorAll('.lang-option').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.langTarget === saved);
    });
  }
})();

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
function acceptCookies() {
  document.cookie = "privacyready-cookies=accepted; domain=.privacyready.co.uk; path=/; max-age=31536000; SameSite=Lax";
  document.getElementById('cookieBanner').classList.remove('show');
  document.body.style.overflow = '';
}

function declineCookies() {
  alert('You must accept cookies to use this site.');
}

(function() {
  const consentMatch = document.cookie.match(/(?:^|;\s*)privacyready-cookies=([^;]*)/);
  const consent = consentMatch ? consentMatch[1] : null;
  if (!consent || consent === 'declined') {
    document.getElementById('cookieBanner').classList.add('show');
    document.body.style.overflow = 'hidden';
  }
})();

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
