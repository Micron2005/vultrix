"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { startSignup } from "./actions";
import { sanitizeFeatureKeys } from "@/lib/features";

type SignupWizardProps = {
  brand: string;
  ownerLine: string;
  autoPrice: number;
  generalPrice: number;
  personalBasicPrice: number;
  personalAiAddonPrice: number;
  trialDays: number;
  error?: string;
  canceled?: string;
};

type AccountPath = "business" | "personal";
type Industry = "auto" | "other" | "";
type InvoiceChoice = "yes" | "no" | "";

type PersistedSignupWizard = {
  step: number;
  path: AccountPath | "";
  industry: Industry;
  invoiceChoice: InvoiceChoice;
  aiHostedEnabled: boolean;
  firstName: string;
  lastName: string;
  businessName: string;
  email: string;
  phone: string;
  username: string;
  agreed: boolean;
};

const SIGNUP_STORAGE_KEY = "vultrix_signup_wizard_v1";
const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400";
const primaryButtonClass =
  "w-full rounded-md bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
  "rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50";

export function SignupWizard({
  brand,
  ownerLine,
  autoPrice,
  generalPrice,
  personalBasicPrice,
  personalAiAddonPrice,
  trialDays,
  error,
  canceled,
}: SignupWizardProps) {
  const [step, setStep] = useState(1);
  const [path, setPath] = useState<AccountPath | "">("");
  const [industry, setIndustry] = useState<Industry>("");
  const [invoiceChoice, setInvoiceChoice] = useState<"yes" | "no" | "">("");
  const [aiHostedEnabled, setAiHostedEnabled] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [stepError, setStepError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.sessionStorage.getItem(SIGNUP_STORAGE_KEY);
      if (!stored) return;
      const parsed: unknown = JSON.parse(stored);
      if (!parsed || typeof parsed !== "object") return;
      const saved = parsed as Partial<PersistedSignupWizard>;

      queueMicrotask(() => {
        if (
          typeof saved.step === "number" &&
          Number.isInteger(saved.step) &&
          saved.step >= 1 &&
          saved.step <= 5
        ) {
          // The password is intentionally NOT persisted (security). Steps 3+
          // gate "Continue to payment" on a valid password, so restoring past
          // the contact step (2) would leave that button permanently disabled
          // with no way forward. Cap the restored step at 2 — every other field
          // and choice is restored below, so the customer only re-enters their
          // password and breezes through the rest.
          setStep(Math.min(saved.step, 2));
        }
        if (saved.path === "business" || saved.path === "personal") {
          setPath(saved.path);
        }
        if (saved.industry === "auto" || saved.industry === "other") {
          setIndustry(saved.industry);
        }
        if (saved.invoiceChoice === "yes" || saved.invoiceChoice === "no") {
          setInvoiceChoice(saved.invoiceChoice);
        }
        if (typeof saved.aiHostedEnabled === "boolean") {
          setAiHostedEnabled(saved.aiHostedEnabled);
        }
        if (typeof saved.firstName === "string") setFirstName(saved.firstName);
        if (typeof saved.lastName === "string") setLastName(saved.lastName);
        if (typeof saved.businessName === "string") {
          setBusinessName(saved.businessName);
        }
        if (typeof saved.email === "string") setEmail(saved.email);
        if (typeof saved.phone === "string") setPhone(saved.phone);
        if (typeof saved.username === "string") setUsername(saved.username);
        if (typeof saved.agreed === "boolean") setAgreed(saved.agreed);
      });
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const persisted: PersistedSignupWizard = {
      step,
      path,
      industry,
      invoiceChoice,
      aiHostedEnabled,
      firstName,
      lastName,
      businessName,
      email,
      phone,
      username,
      agreed,
    };
    try {
      window.sessionStorage.setItem(
        SIGNUP_STORAGE_KEY,
        JSON.stringify(persisted),
      );
    } catch {
      return;
    }
  }, [
    step,
    path,
    industry,
    invoiceChoice,
    aiHostedEnabled,
    firstName,
    lastName,
    businessName,
    email,
    phone,
    username,
    agreed,
  ]);

  const accountType =
    path === "personal"
      ? "PERSONAL"
      : industry === "other"
        ? "BUSINESS"
        : "AUTO_SHOP";
  const finalFeatures = sanitizeFeatureKeys(
    accountType,
    invoiceChoice === "yes" ? ["invoices"] : [],
  );
  const monthlyPrice =
    accountType === "AUTO_SHOP"
      ? autoPrice
      : accountType === "BUSINESS"
        ? generalPrice
        : invoiceChoice === "yes"
          ? generalPrice + (aiHostedEnabled ? personalAiAddonPrice : 0)
          : invoiceChoice === "no"
            ? personalBasicPrice + (aiHostedEnabled ? personalAiAddonPrice : 0)
            : null;
  const displayName =
    path === "personal" ? `${firstName} ${lastName}`.trim() : businessName.trim();
  const contactIsValid = Boolean(
    firstName.trim() &&
      lastName.trim() &&
      /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) &&
      (path === "personal" || businessName.trim()) &&
      /^[a-z0-9._-]{3,}$/i.test(username.trim()) &&
      password.length >= 6 &&
      agreed,
  );

  function next() {
    setStepError("");
    if (step === 1) {
      if (!path) setStepError("Choose Business or Personal to continue.");
      else setStep(2);
      return;
    }
    if (step === 2) {
      if (!contactIsValid) {
        setStepError(
          "Complete the required fields, agree to the Terms, and check your username and password.",
        );
        return;
      }
      setStep(3);
      return;
    }
    if (step === 3) {
      if (!industry) setStepError("Choose the option that best describes you.");
      else if (path === "personal") setStep(4);
      return;
    }
    if (step === 4) {
      if (!invoiceChoice) setStepError("Choose yes or no to continue.");
      else if (path === "personal") setStep(5);
      return;
    }
  }

  function back() {
    setStepError("");
    if (step === 5) setStep(4);
    else if (step === 4) setStep(3);
    else if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
  }

  function setInvoices(value: "yes" | "no") {
    setInvoiceChoice(value);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-100 p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <div className="text-2xl font-bold tracking-tight text-zinc-900">
            {brand}
          </div>
          <div className="text-xs text-zinc-500">
            {monthlyPrice === null
              ? `$${personalBasicPrice}–$${generalPrice}/month base for personal accounts; hosted AI +$${personalAiAddonPrice}/month`
              : `$${monthlyPrice}/month`}
            {accountType === "AUTO_SHOP" && " for auto shops"}
            {accountType === "BUSINESS" && " for business accounts"}
            {accountType === "PERSONAL" &&
              invoiceChoice === "yes" &&
              " for personal accounts with invoices"}
            {accountType === "PERSONAL" &&
              invoiceChoice === "no" &&
              " for personal accounts without invoices"}
            {trialDays > 0 ? ` · ${trialDays}-day free trial` : ""}
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                Step {step}
              </div>
              <h1 className="mt-1 text-lg font-semibold text-zinc-900">
                {step === 1 && `What are you using ${brand} for?`}
                {step === 2 && "Tell us about yourself"}
                {step === 3 && "What kind of business is this?"}
                {step === 4 && "Do you need to create invoices?"}
                {step === 5 && "Add the built-in AI assistant?"}
              </h1>
            </div>
            <div className="text-xs text-zinc-400">
              1–{path === "personal" ? "5" : "4"}
            </div>
          </div>

          {step === 1 && (
            <div className="space-y-3">
              {(["business", "personal"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPath(value)}
                  className={`w-full rounded-lg border p-4 text-left ${
                    path === value
                      ? "border-zinc-900 bg-zinc-50"
                      : "border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  <div className="font-medium capitalize text-zinc-900">
                    {value}
                  </div>
                  <div className="mt-1 text-sm text-zinc-500">
                    {value === "business"
                      ? "Manage customers, invoices, and business operations."
                      : "Keep a simple workspace for your personal projects."}
                  </div>
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-medium text-zinc-700">
                    First name
                  </span>
                  <input
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    autoFocus
                    autoComplete="given-name"
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-zinc-700">
                    Last name
                  </span>
                  <input
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    autoComplete="family-name"
                    className={inputClass}
                  />
                </label>
              </div>
              {path === "business" && (
                <label className="block">
                  <span className="text-sm font-medium text-zinc-700">
                    Business name
                  </span>
                  <input
                    value={businessName}
                    onChange={(event) => setBusinessName(event.target.value)}
                    autoComplete="organization"
                    placeholder="e.g. Drive Nation Auto"
                    className={inputClass}
                  />
                </label>
              )}
              <label className="block">
                <span className="text-sm font-medium text-zinc-700">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoCapitalize="none"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-zinc-700">
                  Phone <span className="font-normal text-zinc-400">(optional)</span>
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  autoComplete="tel"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-zinc-700">
                  Choose a username
                </span>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoCapitalize="none"
                  autoComplete="username"
                  placeholder="e.g. drivenation"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-zinc-700">
                  Choose a password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  className={inputClass}
                />
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(event) => setAgreed(event.target.checked)}
                  className="mt-0.5 rounded border-zinc-300"
                />
                <span className="text-xs text-zinc-600">
                  I agree to the{" "}
                  <Link
                    href="/terms"
                    target="_blank"
                    className="font-medium text-zinc-700 underline"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/privacy"
                    target="_blank"
                    className="font-medium text-zinc-700 underline"
                  >
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-600">
                {path === "personal"
                  ? "Do you work in automotive repair?"
                  : "This helps us set up the right dashboard for your work."}
              </p>
              {(["auto", "other"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setIndustry(value)}
                  className={`w-full rounded-lg border p-4 text-left ${
                    industry === value
                      ? "border-zinc-900 bg-zinc-50"
                      : "border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  <div className="font-medium text-zinc-900">
                    {value === "auto"
                      ? "Yes — automotive repair"
                      : path === "personal"
                        ? "No — something else"
                        : "Something else"}
                  </div>
                  <div className="mt-1 text-sm text-zinc-500">
                    {value === "auto"
                      ? "Repair orders, vehicles, technicians, parts, and more."
                      : path === "personal"
                        ? "Use the general workspace for your own work and projects."
                        : "Choose the business tools that fit your workflow."}
                  </div>
                </button>
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-600">
                You can change this choice later from Billing.
              </p>
              {(["yes", "no"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setInvoices(value)}
                  className={`w-full rounded-lg border p-4 text-left ${
                    invoiceChoice === value
                      ? "border-zinc-900 bg-zinc-50"
                      : "border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  <div className="font-medium text-zinc-900">
                    {value === "yes" ? "Yes" : "No"}
                  </div>
                  <div className="mt-1 text-sm text-zinc-500">
                    {value === "yes"
                      ? "I need to create and manage invoices."
                      : "I do not need invoicing right now."}
                  </div>
                </button>
              ))}
            </div>
          )}

          {step === 4 && (
            <div>
              <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                This account is billed at $
                {invoiceChoice === "yes" ? generalPrice : personalBasicPrice}
                /month.
              </p>
            </div>
          )}

          {step === 5 && path === "personal" && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-600">
                Add the hosted assistant for an additional $
                {personalAiAddonPrice}/month. You can add your own OpenAI or
                Anthropic key later for free.
              </p>
              {([false, true] as const).map((value) => (
                <button
                  key={value ? "yes" : "no"}
                  type="button"
                  onClick={() => setAiHostedEnabled(value)}
                  className={`w-full rounded-lg border p-4 text-left ${
                    aiHostedEnabled === value
                      ? "border-zinc-900 bg-zinc-50"
                      : "border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  <div className="font-medium text-zinc-900">
                    {value
                      ? `Yes — add hosted AI (+$${personalAiAddonPrice}/month)`
                      : "No — I’ll use my own key later or skip AI"}
                  </div>
                  <div className="mt-1 text-sm text-zinc-500">
                    {value
                      ? "Built-in AI runs on Vultrix hosting."
                      : "Bring your own OpenAI or Anthropic key in Settings for free."}
                  </div>
                </button>
              ))}
              <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                This account is billed at ${monthlyPrice}/month.
              </p>
            </div>
          )}

          {(canceled || error) && (
            <div className="mt-4 space-y-2">
              {canceled && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Checkout canceled. Your account isn&apos;t active yet — finish
                  payment to start.
                </div>
              )}
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}
            </div>
          )}
          {stepError && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {stepError}
            </div>
          )}

          <form action={startSignup} className="mt-5">
            <input type="hidden" name="name" value={displayName} />
            <input type="hidden" name="firstName" value={firstName} />
            <input type="hidden" name="lastName" value={lastName} />
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="phone" value={phone} />
            <input type="hidden" name="username" value={username} />
            <input type="hidden" name="password" value={password} />
            <input type="hidden" name="agree" value={agreed ? "1" : ""} />
            <input type="hidden" name="accountType" value={accountType} />
            <input
              type="hidden"
              name="aiHosted"
              value={aiHostedEnabled ? "yes" : "no"}
            />
            <input
              type="hidden"
              name="features"
              value={finalFeatures.join(",")}
            />
            <div className="flex gap-3">
              {step > 1 && (
                <button
                  type="button"
                  onClick={back}
                  className={secondaryButtonClass}
                >
                  Back
                </button>
              )}
              {step === 3 &&
              path === "business" &&
              (industry === "auto" || industry === "other") ? (
                <button
                  key="pay"
                  type="submit"
                  disabled={!contactIsValid || !industry}
                  className={primaryButtonClass}
                >
                  Continue to payment
                </button>
              ) : step === 5 && path === "personal" ? (
                <button
                  key="pay"
                  type="submit"
                  disabled={!contactIsValid || !invoiceChoice}
                  className={primaryButtonClass}
                >
                  Continue to payment
                </button>
              ) : (
                <button
                  key="continue"
                  type="button"
                  onClick={next}
                  disabled={step === 1 && !path}
                  className={primaryButtonClass}
                >
                  Continue
                </button>
              )}
            </div>
            <p className="mt-3 text-center text-[11px] text-zinc-500">
              {trialDays > 0
                ? `You won't be charged until your ${trialDays}-day trial ends. Cancel anytime.`
                : "Cancel anytime."}
            </p>
          </form>
        </div>
        <div className="text-center text-xs text-zinc-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-zinc-700 underline">
            Sign in
          </Link>
        </div>
        <div className="text-center text-[11px] text-zinc-400">{ownerLine}</div>
      </div>
    </div>
  );
}
