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
    const res = await fetch("/api/portal/submit", {
      method: "POST",
      body: JSON.stringify({ token: params.token, phone, email }),
    });

    if (!res.ok) {
      setError("This link is invalid or has already been used.");
      return;
    }
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
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button type="submit">Submit</button>
      </form>
    </main>
  );
}
