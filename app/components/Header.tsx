import { MicIcon } from "./icons";
import styles from "./Header.module.css";

const NAV_LINKS = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Compliance", href: "#compliance" },
  { label: "For Organizations", href: "#organizations" },
  { label: "FAQs", href: "#faqs" },
];

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.logoMark}>
          <MicIcon className={styles.logoIcon} />
        </span>
        <span className={styles.brandText}>
          <span className={styles.brandName}>
            AdvisorConnect <span className={styles.brandAccent}>Voice</span>
          </span>
          <span className={styles.brandTagline}>Smart. Secure. Human.</span>
        </span>
      </div>

      <nav className={styles.nav} aria-label="Primary">
        {NAV_LINKS.map((link) => (
          <a key={link.href} href={link.href}>
            {link.label}
          </a>
        ))}
      </nav>

      <div className={styles.actions}>
        <button type="button" className={styles.signIn}>
          Sign In
        </button>
        <button type="button" className={styles.getStarted}>
          Get Started
        </button>
      </div>
    </header>
  );
}
