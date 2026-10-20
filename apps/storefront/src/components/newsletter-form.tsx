"use client";
/** Newsletter capture — honest implementation.
 *  There is NO newsletter/subscription API in the backend yet, so this form validates
 *  the address and then states plainly that subscriptions aren't connected yet instead
 *  of faking success. When a subscribe endpoint exists, wire it inside onSubmit(). */
import { useState } from "react";
import Link from "next/link";
import { IconPenLine } from "./icons";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function NewsletterForm({ variant = "hero" }: { variant?: "hero" | "footer" }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "error" | "honest">("idle");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setState("error");
      return;
    }
    // No subscription service exists yet — do NOT pretend success.
    setState("honest");
  }

  if (state === "honest") {
    return (
      <div
        role="status"
        className={
          variant === "hero"
            ? "mx-auto max-w-lg rounded-sm border border-gold/40 bg-soft-cream p-space-md text-center"
            : "rounded-sm border border-gold/40 bg-soft-cream p-space-md"
        }
      >
        <p className="flex items-center justify-center gap-space-xs text-label-lg text-primary">
          <IconPenLine size={16} className="text-on-tertiary-container" />
          Our newsletter is almost ready
        </p>
        <p className="mt-space-xs text-body-sm text-on-surface-variant">
          Subscriptions aren&apos;t connected yet — we&apos;d rather be honest than pretend. Meanwhile,{" "}
          <Link href="/contact" className="font-semibold text-primary-container underline underline-offset-2">
            write to us
          </Link>{" "}
          and we&apos;ll keep you posted.
        </p>
      </div>
    );
  }

  return (
    <div className={variant === "hero" ? "mx-auto max-w-lg" : ""}>
      <form
        onSubmit={onSubmit}
        noValidate
        className={
          variant === "hero"
            ? "flex flex-col items-center gap-space-xs sm:flex-row sm:justify-center"
            : "flex items-center rounded-sm border border-outline-variant/30 bg-surface-container-lowest p-1 shadow-sm"
        }
      >
        <label className="sr-only" htmlFor={`newsletter-${variant}`}>
          Email address
        </label>
        <input
          id={`newsletter-${variant}`}
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state === "error") setState("idle");
          }}
          aria-invalid={state === "error"}
          placeholder={variant === "hero" ? "Enter your email address" : "Enter your email"}
          className={
            variant === "hero"
              ? "w-full rounded-sm bg-surface-container-lowest px-space-md py-3.5 text-body-md text-on-surface shadow-sm transition-shadow placeholder:text-on-surface-variant focus:outline-none sm:flex-grow"
              : "w-full bg-transparent px-3 py-2 text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none"
          }
        />
        <button
          type="submit"
          className={
            variant === "hero"
              ? "btn-primary w-full shrink-0 px-8 py-3.5 text-label-md uppercase tracking-wider sm:w-auto"
              : "shrink-0 rounded-sm bg-primary-container px-4 py-2 text-[0.6875rem] font-bold uppercase tracking-wider text-on-primary transition-colors hover:bg-primary"
          }
        >
          Subscribe
        </button>
      </form>
      {state === "error" && (
        <p role="alert" className="mt-space-xs text-label-sm text-error">
          Please enter a valid email address.
        </p>
      )}
    </div>
  );
}
