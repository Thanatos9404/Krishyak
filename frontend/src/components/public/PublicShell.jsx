import { ArrowUpRight, Menu } from "lucide-react";
import { Brand } from "./Brand";

const primary = [
  ["How it works", "/how-it-works"],
  ["For farmers", "/for-farmers"],
  ["For partners", "/for-partners"],
  ["Our story", "/about"],
];
const footer = [
  ["Technology", "/technology"],
  ["Questions & answers", "/faq"],
  ["Demonstration farm", "/demo"],
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
  ["Image credits", "/credits"],
];

export function PublicShell({ children }) {
  return (
    <div className="public-site">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="public-header">
        <Brand />
        <nav aria-label="Main navigation" className="public-nav">
          {primary.map(([label, href]) => (
            <a href={href} key={href}>
              {label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <a className="header-signin" href="/app/today">
            Sign in
          </a>
          <a className="button primary" href="/demo">
            Explore demo <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        </div>
        <details className="mobile-menu">
          <summary role="button" aria-label="Open navigation menu">
            <Menu size={23} aria-hidden="true" />
          </summary>
          <nav aria-label="Mobile navigation">
            {primary.concat(footer.slice(0, 3)).map(([label, href]) => (
              <a href={href} key={href}>
                {label}
                <ArrowUpRight size={17} aria-hidden="true" />
              </a>
            ))}
            <a className="button primary" href="/app/today">
              Open my farm
            </a>
          </nav>
        </details>
      </header>
      {children}
      <footer className="public-footer">
        <div className="container footer-top">
          <div>
            <Brand />
            <p>
              A clearer view of your farm.
              <br />A little more confidence in your next step.
            </p>
            <span className="eyebrow">BUILT FOR THE WAY FARMING HAPPENS</span>
          </div>
          <nav aria-label="Product links">
            <span className="footer-label">Explore</span>
            {primary.map(([label, href]) => (
              <a key={href} href={href}>
                {label}
              </a>
            ))}
          </nav>
          <nav aria-label="Resources and policies">
            <span className="footer-label">Good to know</span>
            {footer.map(([label, href]) => (
              <a key={href} href={href}>
                {label}
              </a>
            ))}
          </nav>
        </div>
        <div className="container footer-bottom">
          <span>© 2026 Krishyak</span>
          <span>Field intelligence. Human judgement.</span>
          <a
            href="https://github.com/Thanatos9404/Krishyak"
            target="_blank"
            rel="noopener noreferrer"
          >
            Built in the open <ArrowUpRight size={13} aria-hidden="true" />
          </a>
        </div>
      </footer>
    </div>
  );
}
