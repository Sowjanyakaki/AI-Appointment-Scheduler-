import { ChatDemo } from "./components/ChatDemo";
import { FeatureStrip } from "./components/FeatureStrip";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { HowItWorks } from "./components/HowItWorks";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <Header />

      <main>
        <section className={styles.hero}>
          <Hero />
          <ChatDemo />
          <HowItWorks />
        </section>

        <FeatureStrip />
      </main>

      <Footer />
    </div>
  );
}
