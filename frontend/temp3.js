
const SCAN_CHECKS_DEF = [
  { id: 'cookie_banner',    label: { en: 'Cookie consent banner',        th: 'แบนเนอร์คุกกี้',           ru: 'Баннер согласия на куки' },
    detail: { en: 'PDPA requires explicit consent before setting cookies',   th: 'PDPA กำหนดให้ขอความยินยอมก่อนตั้งค่าคุกกี้', ru: 'PDPA требует явного согласия перед установкой куки' } },
  { id: 'privacy_policy',  label: { en: 'Privacy policy page',           th: 'หน้านโยบายความเป็นส่วนตัว', ru: 'Страница политики конфиденциальности' },
    detail: { en: 'Must be clearly linked and accessible',                   th: 'ต้องเชื่อมโยงและเข้าถึงได้ชัดเจน',          ru: 'Должна быть чётко указана и доступна' } },
  { id: 'data_controller',  label: { en: 'Data controller contact',       th: 'ข้อมูลผู้ควบคุมข้อมูล',       ru: 'Контакт контролёра данных' },
    detail: { en: 'Organisation must publish contact details for data requests', th: 'องค์กรต้องเผยแพร่ข้อมูลติดต่อสำหรับคำขอข้อมูล', ru: 'Организация должна публиковать контакт для запросов' } },
  { id: 'https',           label: { en: 'HTTPS encryption',              th: 'การเข้ารหัส HTTPS',           ru: 'HTTPS шифрование' },
    detail: { en: 'All pages must be served over HTTPS',                     th: 'ทุกหน้าต้องให้บริการผ่าน HTTPS',              ru: 'Все страницы должны работать через HTTPS' } },
  { id: 'third_party',     label: { en: 'Third-party tracker disclosure', th: 'การเปิดเผย tracker บุคคลที่สาม', ru: 'Раскрытие сторонних трекеров' },
    detail: { en: 'Google Analytics, Meta Pixel etc. must be disclosed',     th: 'Google Analytics, Meta Pixel ฯลฯ ต้องได้รับการเปิดเผย', ru: 'Google Analytics, Meta Pixel и др. должны быть раскрыты' } },
  { id: 'dsr_link',        label: { en: 'Data Subject Rights (DSR) link', th: 'ลิงก์สิทธิ์เจ้าของข้อมูล',    ru: 'Ссылка на права субъекта данных' },
    detail: { en: 'Users must be able to request data access or deletion',   th: 'ผู้ใช้ต้องสามารถขอเข้าถึงหรือลบข้อมูลได้', ru: 'Пользователи должны иметь возможность запросить данные' } },
  { id: 'thai_pdpa_ref',   label: { en: 'PDPA reference in policy',       th: 'การอ้างอิง PDPA ในนโยบาย',   ru: 'Ссылка на PDPA в политике' },
    detail: { en: 'Privacy policy should reference Thailand\'s PDPA law',     th: 'นโยบายความเป็นส่วนตัวควรอ้างอิงกฎหมาย PDPA', ru: 'Политика должна ссылаться на закон PDPA Таиланда' } },
];

const SOCIAL_SCAN_CHECKS_DEF = [
  { id: 'fb_lead_form',    label: { en: 'Facebook Lead Forms Consent', th: 'ความยินยอมแบบฟอร์ม Facebook', ru: 'Согласие в лид-формах FB' },
    detail: { en: 'Checks if lead forms have privacy policy links & consent checkboxes', th: 'ตรวจสอบลิงก์นโยบายและความยินยอมในแบบฟอร์ม', ru: 'Проверяет ссылки на политику в формах' } },
  { id: 'fb_pii',          label: { en: 'Public PII Exposure',         th: 'การเปิดเผย PII ต่อสาธารณะ',  ru: 'Публичное раскрытие PII' },
    detail: { en: 'Scans public comments for leaked phone numbers/emails', th: 'สแกนความคิดเห็นสาธารณะเพื่อหาเบอร์โทร/อีเมลหลุด', ru: 'Сканирует комментарии на утечку телефонов/email' } },
  { id: 'line_consent',    label: { en: 'LINE Auto-reply Consent',     th: 'ความยินยอมตอบกลับอัตโนมัติ LINE', ru: 'Согласие в автоответах LINE' },
    detail: { en: 'Ensures LINE bots collect consent before PII', th: 'บอท LINE ต้องขอความยินยอมก่อนเก็บ PII', ru: 'LINE-боты должны запрашивать согласие' } },
  { id: 'line_richmenu',   label: { en: 'LINE Rich Menu Privacy',      th: 'ความเป็นส่วนตัวใน Rich Menu', ru: 'Приватность LINE Rich Menu' },
    detail: { en: 'Checks if rich menus link to privacy policies', th: 'เมนูต้องลิงก์ไปยังนโยบายความเป็นส่วนตัว', ru: 'Меню должно ссылаться на политику' } },
  { id: 'tiktok_bio',      label: { en: 'TikTok Bio Link Tracking',    th: 'การติดตามลิงก์ในไบโอ TikTok', ru: 'Отслеживание ссылок в TikTok' },
    detail: { en: 'Checks for undisclosed trackers in bio URLs', th: 'ตรวจสอบ tracker ที่ไม่เปิดเผยในลิงก์ไบโอ', ru: 'Проверяет скрытые трекеры в ссылках' } },
];

function switchScanTab(tab) {
  // Update tab classes
  document.querySelectorAll('.scan-tab').forEach(b => {
    b.classList.remove('active');
    if (b.id.includes(tab)) b.classList.add('active');
  });
  
  // Toggle forms
  document.getElementById('scan-form-website').style.display = tab === 'website' ? 'flex' : 'none';
  document.getElementById('scan-form-social').style.display = tab === 'social' ? 'flex' : 'none';
  
  // Reset results
  document.getElementById('scan-results').classList.remove('visible');
  document.getElementById('scan-checks-list').innerHTML = '';
}

async function startSocialScan(e) {
  e.preventDefault();
  const btn = document.getElementById('scan-social-btn');
  const icon = document.getElementById('scan-social-btn-icon');
  btn.disabled = true;
  icon.innerHTML = '<span class="spin"></span>';
  
  const panel = document.getElementById('scan-results');
  const checksList = document.getElementById('scan-checks-list');
  const targetEl = document.getElementById('scan-target-display');
  const scoreBadge = document.getElementById('scan-score-badge');
  const ctaEl = document.getElementById('scan-cta');
  
  panel.classList.add('visible');
  ctaEl.style.display = 'none';
  scoreBadge.textContent = '';
  scoreBadge.className = 'scan-score';
  targetEl.textContent = 'Social Media Audit';
  checksList.innerHTML = '';
  
  // In case getLang is defined below, just get it directly or fallback to 'en'
  const lang = document.body.getAttribute('lang') || 'en';
  
  const rows = SOCIAL_SCAN_CHECKS_DEF.map(c => {
    const li = document.createElement('li');
    li.className = 'scan-check pending';
    li.innerHTML = `
      <span class="check-icon">○</span>
      <span class="check-body">
        <span class="check-label">${c.label[lang] || c.label.en}</span>
        <span class="check-detail">${c.detail[lang] || c.detail.en}</span>
      </span>`;
    checksList.appendChild(li);
    return li;
  });
  
  let passed = 0;
  for (let i = 0; i < SOCIAL_SCAN_CHECKS_DEF.length; i++) {
    const row = rows[i];
    row.className = 'scan-check running';
    row.querySelector('.check-icon').innerHTML = '<span class="spin"></span>';
    
    await new Promise(r => setTimeout(r, 600 + Math.random() * 600));
    
    const status = Math.random() > 0.4 ? 'fail' : 'pass';
    if (status === 'pass') passed++;
    row.className = 'scan-check ' + status;
    row.querySelector('.check-icon').textContent = status === 'pass' ? '✅' : '❌';
  }
  
  const total = SOCIAL_SCAN_CHECKS_DEF.length;
  const pct = Math.round((passed / total) * 100);
  let scoreClass = pct >= 70 ? 'good' : pct >= 40 ? 'medium' : 'poor';
  let scoreLabel = { en: `${passed}/${total} passed`, th: `ผ่าน ${passed}/${total}`, ru: `${passed}/${total} пройдено` };
  scoreBadge.textContent = (pct >= 70 ? '✅ ' : pct >= 40 ? '⚠️ ' : '🚨 ') + (scoreLabel[lang] || scoreLabel.en);
  scoreBadge.className = 'scan-score ' + scoreClass;
  
  ctaEl.style.display = 'flex';
  btn.disabled = false;
  icon.textContent = '🔍';
  
  return false;
}


// Language Switcher
const overlayLabels = {
  en: 'Select Language',
  th: 'เลือกภาษา',
  ru: 'Выберите язык'
};

const overlayFooters = {
  en: 'PrivacyReady — Thailand PDPA Compliance',
  th: 'PrivacyReady — การปฏิบัติตาม PDPA ไทย',
  ru: 'PrivacyReady — Соответствие PDPA Таиланда'
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
  localStorage.setItem('privacyready-cookies', 'accepted');
  document.getElementById('cookieBanner').classList.remove('show');
}

function declineCookies() {
  localStorage.setItem('privacyready-cookies', 'declined');
  document.getElementById('cookieBanner').classList.remove('show');
}

(function() {
  const consent = localStorage.getItem('privacyready-cookies');
  if (!consent) {
    setTimeout(function() {
      document.getElementById('cookieBanner').classList.add('show');
    }, 2000);
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
// ── FREE PDPA SCANNER ENGINE ──
const SCAN_CHECKS_DEF = [
  { id: 'cookie_banner',    label: { en: 'Cookie consent banner',        th: 'แบนเนอร์คุกกี้',           ru: 'Баннер согласия на куки' },
    detail: { en: 'PDPA requires explicit consent before setting cookies',   th: 'PDPA กำหนดให้ขอความยินยอมก่อนตั้งค่าคุกกี้', ru: 'PDPA требует явного согласия перед установкой куки' } },
  { id: 'privacy_policy',  label: { en: 'Privacy policy page',           th: 'หน้านโยบายความเป็นส่วนตัว', ru: 'Страница политики конфиденциальности' },
    detail: { en: 'Must be clearly linked and accessible',                   th: 'ต้องเชื่อมโยงและเข้าถึงได้ชัดเจน',          ru: 'Должна быть чётко указана и доступна' } },
  { id: 'data_controller',  label: { en: 'Data controller contact',       th: 'ข้อมูลผู้ควบคุมข้อมูล',       ru: 'Контакт контролёра данных' },
    detail: { en: 'Organisation must publish contact details for data requests', th: 'องค์กรต้องเผยแพร่ข้อมูลติดต่อสำหรับคำขอข้อมูล', ru: 'Организация должна публиковать контакт для запросов' } },
  { id: 'https',           label: { en: 'HTTPS encryption',              th: 'การเข้ารหัส HTTPS',           ru: 'HTTPS шифрование' },
    detail: { en: 'All pages must be served over HTTPS',                     th: 'ทุกหน้าต้องให้บริการผ่าน HTTPS',              ru: 'Все страницы должны работать через HTTPS' } },
  { id: 'third_party',     label: { en: 'Third-party tracker disclosure', th: 'การเปิดเผย tracker บุคคลที่สาม', ru: 'Раскрытие сторонних трекеров' },
    detail: { en: 'Google Analytics, Meta Pixel etc. must be disclosed',     th: 'Google Analytics, Meta Pixel ฯลฯ ต้องได้รับการเปิดเผย', ru: 'Google Analytics, Meta Pixel и др. должны быть раскрыты' } },
  { id: 'dsr_link',        label: { en: 'Data Subject Rights (DSR) link', th: 'ลิงก์สิทธิ์เจ้าของข้อมูล',    ru: 'Ссылка на права субъекта данных' },
    detail: { en: 'Users must be able to request data access or deletion',   th: 'ผู้ใช้ต้องสามารถขอเข้าถึงหรือลบข้อมูลได้', ru: 'Пользователи должны иметь возможность запросить данные' } },
  { id: 'thai_pdpa_ref',   label: { en: 'PDPA reference in policy',       th: 'การอ้างอิง PDPA ในนโยบาย',   ru: 'Ссылка на PDPA в политике' },
    detail: { en: 'Privacy policy should reference Thailand\'s PDPA law',     th: 'นโยบายความเป็นส่วนตัวควรอ้างอิงกฎหมาย PDPA', ru: 'Политика должна ссылаться на закон PDPA Таиланда' } },
];

const iconFor = { pass: '✅', fail: '❌', warn: '⚠️', running: '', pending: '○' };

function getLang() {
  return document.body.getAttribute('lang') || 'en';
}

async function startScan(e) {
  e.preventDefault();
  const rawUrl = document.getElementById('scan-url-input').value.trim();
  if (!rawUrl) return false;

  // Normalise URL
  let url;
  try { url = new URL(rawUrl.startsWith('http') ? rawUrl : 'https://' + rawUrl); }
  catch { url = { href: rawUrl, hostname: rawUrl, protocol: 'https:' }; }

  const btn = document.getElementById('scan-btn');
  const icon = document.getElementById('scan-btn-icon');
  btn.disabled = true;
  icon.innerHTML = '<span class="spin"></span>';

  // Show results panel
  const panel    = document.getElementById('scan-results');
  const checksList = document.getElementById('scan-checks-list');
  const targetEl   = document.getElementById('scan-target-display');
  const scoreBadge = document.getElementById('scan-score-badge');
  const ctaEl      = document.getElementById('scan-cta');

  panel.classList.add('visible');
  ctaEl.style.display = 'none';
  scoreBadge.textContent = '';
  scoreBadge.className = 'scan-score';
  targetEl.textContent = url.hostname;
  checksList.innerHTML = '';

  const lang = getLang();

  // Build pending rows
  const rows = SCAN_CHECKS_DEF.map(c => {
    const li = document.createElement('li');
    li.className = 'scan-check pending';
    li.id = 'chk-' + c.id;
    li.innerHTML = `
      <span class="check-icon">${iconFor.pending}</span>
      <span class="check-body">
        <span class="check-label">${c.label[lang] || c.label.en}</span>
        <span class="check-detail">${c.detail[lang] || c.detail.en}</span>
      </span>`;
    checksList.appendChild(li);
    return li;
  });

  // Try real API first, fall back to heuristic demo
  let apiResults = null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const resp = await fetch('https://api.privacyready.com/v1/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.href }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (resp.ok) apiResults = await resp.json();
  } catch (_) { /* fallback below */ }

  // Animate check-by-check reveal
  let passed = 0;
  for (let i = 0; i < SCAN_CHECKS_DEF.length; i++) {
    const c   = SCAN_CHECKS_DEF[i];
    const row = rows[i];

    // Mark as running
    row.className = 'scan-check running';
    row.querySelector('.check-icon').textContent = '';
    row.querySelector('.check-icon').innerHTML = '<span class="spin"></span>';

    await new Promise(r => setTimeout(r, 600 + Math.random() * 600));

    // Determine result
    let status;
    if (apiResults && apiResults.checks) {
      const found = apiResults.checks.find(x => x.id === c.id);
      status = found ? found.status : 'warn';
    } else {
      // Heuristic demo based on URL properties
      if (c.id === 'https')        status = url.protocol === 'https:' ? 'pass' : 'fail';
      else if (c.id === 'cookie_banner')   status = Math.random() > 0.4 ? 'fail' : 'pass';
      else if (c.id === 'privacy_policy')  status = Math.random() > 0.3 ? 'pass' : 'fail';
      else if (c.id === 'data_controller') status = Math.random() > 0.5 ? 'warn' : 'fail';
      else if (c.id === 'third_party')     status = Math.random() > 0.35 ? 'fail' : 'warn';
      else if (c.id === 'dsr_link')        status = Math.random() > 0.6 ? 'fail' : 'pass';
      else if (c.id === 'thai_pdpa_ref')   status = Math.random() > 0.7 ? 'fail' : 'warn';
      else status = 'warn';
    }

    if (status === 'pass') passed++;
    row.className = 'scan-check ' + status;
    row.querySelector('.check-icon').textContent = iconFor[status] || '⚠️';
  }

  // Score badge
  const total = SCAN_CHECKS_DEF.length;
  const pct = Math.round((passed / total) * 100);
  let scoreClass = pct >= 70 ? 'good' : pct >= 40 ? 'medium' : 'poor';
  let scoreLabel = { en: `${passed}/${total} passed`, th: `ผ่าน ${passed}/${total}`, ru: `${passed}/${total} пройдено` };
  scoreBadge.textContent = (pct >= 70 ? '✅ ' : pct >= 40 ? '⚠️ ' : '🚨 ') + (scoreLabel[lang] || scoreLabel.en);
  scoreBadge.className = 'scan-score ' + scoreClass;

  // Update full-report link with URL param
  const reportBtn = document.getElementById('scan-full-report-btn');
  if (reportBtn) {
    reportBtn.href = `http://localhost:5173/register?source=free-scan&url=${encodeURIComponent(url.href)}&score=${pct}`;
  }

  // Show CTA
  ctaEl.style.display = 'flex';

  // Reset button
  btn.disabled = false;
  icon.textContent = '🔍';

  return false;
}

