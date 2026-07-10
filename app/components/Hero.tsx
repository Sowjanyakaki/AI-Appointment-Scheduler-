import { CheckIcon, MicIcon, PhoneIcon, PlayIcon } from "./icons";
import styles from "./Hero.module.css";

const CHECKLIST = [
  "Share your topic and preferred time",
  "Get available slots and confirm in voice",
  "Receive a unique booking code",
  "We handle the rest—calendar hold, notes & approval-gated email",
  "No personal data taken on the call",
];

export function Hero() {
  return (
    <div className={styles.copy}>
      <span className={styles.eyebrow}>
        <MicIcon className={styles.eyebrowIcon} />
        AI Voice Agent
      </span>

      <h1 className={styles.heading}>
        Voice Agent:
        <br />
        <span className={styles.headingAccent}>Advisor Appointment Scheduler</span>
      </h1>

      <p className={styles.lead}>
        A compliant, pre-booking voice assistant that helps you quickly secure a
        tentative slot with a human advisor.
      </p>

      <ul className={styles.checklist}>
        {CHECKLIST.map((item) => (
          <li key={item}>
            <CheckIcon className={styles.checkIcon} />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <div className={styles.ctas}>
        <button type="button" className={styles.primaryCta}>
          <PhoneIcon className={styles.ctaIcon} />
          Talk to Voice Agent
        </button>
        <a href="#how-it-works" className={styles.secondaryCta}>
          <PlayIcon className={styles.ctaIcon} />
          See How It Works
        </a>
      </div>
    </div>
  );
}
