import { CalendarIcon, EnvelopeIcon, NoteIcon, ShieldCheckIcon } from "./icons";
import styles from "./HowItWorks.module.css";

const STEPS = [
  {
    icon: CalendarIcon,
    title: "Calendar Hold",
    description: "Tentative slot held in advisor's calendar",
  },
  {
    icon: NoteIcon,
    title: "Internal Notes",
    description: "Consultation topic & preferences captured",
  },
  {
    icon: EnvelopeIcon,
    title: "Approval-Gated Email",
    description: "Secure email drafted via MCP for approval",
  },
  {
    icon: ShieldCheckIcon,
    title: "Secure Link",
    description: "User receives link to complete details later",
  },
];

export function HowItWorks() {
  return (
    <ol id="how-it-works" className={styles.timeline} aria-label="How it works">
      {STEPS.map((step) => (
        <li key={step.title} className={styles.step}>
          <span className={styles.stepIcon}>
            <step.icon className={styles.stepIconGlyph} />
          </span>
          <div>
            <p className={styles.stepTitle}>{step.title}</p>
            <p className={styles.stepDescription}>{step.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
