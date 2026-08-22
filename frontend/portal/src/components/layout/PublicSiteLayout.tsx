import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

type PublicSiteLayoutProps = {
  children: ReactNode;
  title: string;
  description: string;
  canonicalPath: string;
  mainClassName?: string;
};

function PublicMetadata({ title, description, canonicalPath }: Omit<PublicSiteLayoutProps, 'children' | 'mainClassName'>) {
  useEffect(() => {
    document.title = title;

    let descriptionTag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!descriptionTag) {
      descriptionTag = document.createElement('meta');
      descriptionTag.name = 'description';
      document.head.appendChild(descriptionTag);
    }
    descriptionTag.content = description;

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = `https://privacyready.co.uk${canonicalPath}`;
  }, [canonicalPath, description, title]);

  return null;
}

export default function PublicSiteLayout({ children, title, description, canonicalPath, mainClassName }: PublicSiteLayoutProps) {
  return (
    <div className="marketing-page">
      <PublicMetadata title={title} description={description} canonicalPath={canonicalPath} />
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header>
        <nav className="marketing-nav" aria-label="Main navigation">
          <Link className="marketing-brand" to="/" aria-label="PrivacyReady home"><ShieldCheck size={25} /> PrivacyReady</Link>
          <div className="marketing-nav__links">
            <a href="/#checks">What we check</a>
            <a href="/#pricing">Pricing</a>
            <Link to="/login">Sign in</Link>
            <a className="ui-button ui-button--primary" href="/#scanner">Run free GDPR scan</a>
          </div>
        </nav>
      </header>
      <main id="main-content" className={mainClassName}>{children}</main>
      <footer className="marketing-footer" aria-label="Site footer">
        <div className="marketing-footer__grid">
          <div className="marketing-footer__brand">
            <Link className="marketing-brand" to="/"><ShieldCheck size={23} /> PrivacyReady</Link>
            <p>Practical UK GDPR readiness and compliance operations for growing organisations.</p>
          </div>
          <div>
            <h2>Product</h2>
            <ul>
              <li><a href="/#how-it-works">How it works</a></li>
              <li><a href="/#pricing">Pricing</a></li>
              <li><Link to="/coming-soon/api-access">API access <span className="footer-status">Coming soon</span></Link></li>
              <li><Link to="/coming-soon/compliance-monitoring">Compliance monitoring <span className="footer-status">Coming soon</span></Link></li>
            </ul>
          </div>
          <div>
            <h2>Resources</h2>
            <ul>
              <li><Link to="/gdpr-guide">GDPR guide</Link></li>
              <li><Link to="/faq">FAQ</Link></li>
              <li><Link to="/blog">Blog</Link></li>
              <li><Link to="/coming-soon/webinars">Webinars <span className="footer-status">Coming soon</span></Link></li>
            </ul>
          </div>
          <div>
            <h2>Company</h2>
            <ul>
              <li><Link to="/about">About us</Link></li>
              <li><Link to="/contact">Contact</Link></li>
              <li><Link to="/privacy">Privacy policy</Link></li>
              <li><Link to="/terms">Terms of service</Link></li>
              <li><Link to="/cookies">Cookie policy</Link></li>
              <li><Link to="/cookies">Browser storage</Link></li>
            </ul>
          </div>
        </div>
        <div className="marketing-footer__bottom">© 2026 PrivacyReady Ltd (Reg No. 14592031). Registered in England &amp; Wales.</div>
      </footer>
    </div>
  );
}
