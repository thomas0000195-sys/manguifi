"use client";

import { useActionState, useState } from "react";
import {
  requestEmployeeOtpAction,
  verifyEmployeeOtpAction,
  type OtpRequestState,
  type OtpVerifyState,
} from "@/app/actions/whatsapp-auth";
import {
  requestEmployeeEmailOtpAction,
  verifyEmployeeEmailOtpAction,
  type EmailOtpRequestState,
  type EmailOtpVerifyState,
} from "@/app/actions/email-auth";
import { AlertCircle, Loader2, Mail, MessageCircle } from "lucide-react";

const initialRequestState: OtpRequestState = {};
const initialVerifyState: OtpVerifyState = {};
const initialEmailRequestState: EmailOtpRequestState = {};
const initialEmailVerifyState: EmailOtpVerifyState = {};

/**
 * A single field accepts either a WhatsApp number or an email address —
 * whichever the employee's organization uses (Organization.authChannel).
 * Detected client-side by the presence of "@", since the login page has
 * no other way to know which channel a given employee's org picked before
 * they've identified themselves.
 */
export default function WhatsAppLoginForm() {
  const [value, setValue] = useState("");
  const isEmail = value.includes("@");

  const [requestState, requestAction, requestPending] = useActionState(
    requestEmployeeOtpAction,
    initialRequestState
  );
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyEmployeeOtpAction,
    initialVerifyState
  );
  const [emailRequestState, emailRequestAction, emailRequestPending] = useActionState(
    requestEmployeeEmailOtpAction,
    initialEmailRequestState
  );
  const [emailVerifyState, emailVerifyAction, emailVerifyPending] = useActionState(
    verifyEmployeeEmailOtpAction,
    initialEmailVerifyState
  );

  const [identifier, setIdentifier] = useState<string | null>(
    requestState.phone ?? emailRequestState.email ?? null
  );
  const [channel, setChannel] = useState<"phone" | "email">("phone");

  if (requestState.submitted && requestState.phone && identifier !== requestState.phone) {
    setIdentifier(requestState.phone);
  }
  if (emailRequestState.submitted && emailRequestState.email && identifier !== emailRequestState.email) {
    setIdentifier(emailRequestState.email);
  }

  if (!identifier) {
    return (
      <form
        action={isEmail ? emailRequestAction : requestAction}
        onSubmit={() => setChannel(isEmail ? "email" : "phone")}
        className="space-y-4"
      >
        {(requestState.error || emailRequestState.error) && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-600 ring-1 ring-red-100 animate-fade-in-up">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{requestState.error || emailRequestState.error}</span>
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-navy-900">
            Numéro WhatsApp ou email
          </label>
          <input
            name={isEmail ? "email" : "phone"}
            type="text"
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ex. 77 123 45 67 ou vous@entreprise.com"
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none transition focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
          />
        </div>
        <button
          type="submit"
          disabled={requestPending || emailRequestPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-800 active:scale-[0.99] disabled:opacity-70"
        >
          {requestPending || emailRequestPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isEmail ? (
            <Mail className="h-4 w-4" />
          ) : (
            <MessageCircle className="h-4 w-4" />
          )}
          Recevoir mon code
        </button>
      </form>
    );
  }

  const error = channel === "email" ? emailVerifyState.error : verifyState.error;
  const pending = channel === "email" ? emailVerifyPending : verifyPending;

  return (
    <form action={channel === "email" ? emailVerifyAction : verifyAction} className="space-y-4">
      <input type="hidden" name={channel} value={identifier} />
      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-600 ring-1 ring-red-100 animate-fade-in-up">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <div className="rounded-xl bg-navy-50 px-3.5 py-2.5 text-sm text-navy-900">
        Code envoyé {channel === "email" ? "par email à" : "sur WhatsApp au"}{" "}
        <span className="font-semibold">{identifier}</span>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-navy-900">
          Code reçu
        </label>
        <input
          name="code"
          type="text"
          inputMode="numeric"
          autoFocus
          required
          placeholder="123456"
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-center text-lg tracking-[0.4em] outline-none transition focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-800 active:scale-[0.99] disabled:opacity-70"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Vérifier
      </button>
      <button
        type="button"
        onClick={() => {
          setIdentifier(null);
          setValue("");
        }}
        className="w-full text-center text-xs font-medium text-muted hover:text-navy-900"
      >
        Changer de numéro ou d&apos;email
      </button>
    </form>
  );
}
