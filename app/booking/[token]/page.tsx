"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

export default function BookingPortalPage() {
  const params = useParams<{ token: string }>();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!phone.trim() && !email.trim()) {
      setError("Please provide a phone number or email.");
      return;
    }

    const res = await fetch("/api/portal/submit", {
      method: "POST",
      body: JSON.stringify({ token: params.token, phone, email }),
    });

    if (!res.ok) {
      if (res.status === 400) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Please provide a phone number or email.");
        return;
      }
      setError("This link is invalid or has already been used.");
      return;
    }
    setError(null);
    setSubmitted(true);
  }

  if (submitted) return <p>Thanks — your details were submitted securely.</p>;

  return (
    <main>
      <h1>Confirm Your Contact Details</h1>
      {error && <p role="alert">{error}</p>}
      <form onSubmit={handleSubmit}>
        <label>
          Phone
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button type="submit">Submit</button>
      </form>
    </main>
  );
}
