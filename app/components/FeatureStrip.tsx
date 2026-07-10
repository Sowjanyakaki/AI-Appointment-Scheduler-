import { HeadsetIcon, LockIcon, ScaleIcon, ShieldCheckIcon } from "./icons";
import styles from "./FeatureStrip.module.css";

const FEATURES = [
  {
    icon: ShieldCheckIcon,
    tone: "brand",
    title: "Privacy First",
    description: "No personal data collected on the call. Your privacy is protected.",
  },
  {
    icon: ScaleIcon,
    tone: "green",
    title: "Compliant by Design",
    description: "Built with regulatory guardrails, clear disclaimers, and audit ready workflows.",
  },
  {
    icon: HeadsetIcon,
    tone: "purple",
    title: "Natural Voice Experience",
    description: "Human-like conversations that are fast, clear, and effortless.",
  },
  {
    icon: LockIcon,
    tone: "brand",
    title: "Secure & Reliable",
    description: "Enterprise-grade security with MCP-powered orchestration and approvals.",
  },
] as const;

export function FeatureStrip() {
  return (
    <section id="features" className={styles.section} aria-label="Product highlights">
      <div className={styles.grid}>
        {FEATURES.map((feature) => (
          <div key={feature.title} className={styles.card}>
            <span className={`${styles.iconWrap} ${styles[feature.tone]}`}>
              <feature.icon className={styles.icon} />
            </span>
            <p className={styles.title}>{feature.title}</p>
            <p className={styles.description}>{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
