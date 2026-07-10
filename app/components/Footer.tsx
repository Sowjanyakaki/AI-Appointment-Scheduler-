import { ShieldCheckIcon } from "./icons";
import styles from "./Footer.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <p className={styles.tagline}>
        <ShieldCheckIcon className={styles.taglineIcon} />
        Real conversations. Real systems. Real impact.
      </p>
      <p className={styles.subtext}>
        This milestone tests practical voice UX, safe intent handling, and
        real-world AI system orchestration.
      </p>
    </footer>
  );
}
