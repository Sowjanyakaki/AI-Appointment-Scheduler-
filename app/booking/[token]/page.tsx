"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import styles from "./BookingPortal.module.css";

export default function BookingPortalPage() {
  const params = useParams<{ token: string }>();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (!phone.trim() && !email.trim()) {
      setError("Please provide a phone number or email address.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/portal/submit", {
        method: "POST",
        body: JSON.stringify({ token: params.token, phone, email }),
      });

      if (!res.ok) {
        if (res.status === 400) {
          const data = await res.json().catch(() => null);
          setError(data?.error ?? "Please provide a phone number or email.");
        } else {
          setError("This secure link is invalid, expired, or has already been used.");
        }
        return;
      }
      setSubmitted(true);
    } catch {
      setError("A connection error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.portalCard}>
        {submitted ? (
          <div className={styles.successState}>
            <svg className={styles.successIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <h1 className={styles.successTitle}>Details Submitted!</h1>
            <p className={styles.successText}>
              Thank you. Your contact details have been linked to your appointment securely. 
              An advisor will reach out to you using this information.
            </p>
          </div>
        ) : (
          <>
            <h1 className={styles.title}>Secure Contact Portal</h1>
            <p className={styles.subtitle}>
              Provide your phone number or email address to finalize your appointment hold. 
              This information is stored securely and is never shared or logged during the call.
            </p>

            {error && (
              <div className={styles.errorBox} role="alert">
                {error}
              </div>
            )}

            <form onSubmit={(e) => void handleSubmit(e)} className={styles.form}>
              <label className={styles.label}>
                Phone Number
                <input
                  type="tel"
                  placeholder="e.g. +1 (555) 019-2834"
                  className={styles.input}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading}
                />
              </label>

              <label className={styles.label}>
                Email Address
                <input
                  type="email"
                  placeholder="e.g. yourname@domain.com"
                  className={styles.input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </label>

              <button
                type="submit"
                className={styles.submitBtn}
                disabled={loading || (!phone.trim() && !email.trim())}
              >
                {loading ? "Submitting..." : "Submit Securely"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
