"use client";

import { useActionState } from "react";
import {
  requestConsoleCodeAction,
  verifyConsoleCodeAction,
  verifyConsoleTotpAction,
  type ConsoleStep,
} from "@/app/actions/console-auth";

const initial: ConsoleStep = {};

function ErrorBox({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>;
}

export default function ConsoleLoginForm() {
  const [emailState, emailAction, emailPending] = useActionState(requestConsoleCodeAction, initial);
  const [codeState, codeAction, codePending] = useActionState(verifyConsoleCodeAction, initial);
  const [totp, totpFormAction, totpBusy] = useActionState(verifyConsoleTotpAction, initial);

  // Étape courante : pilotée par la dernière réponse serveur.
  const stage = totp.step ?? codeState.step ?? emailState.step ?? "email";
  const email = codeState.email ?? emailState.email ?? totp.email ?? "";
  const enrollState = totp.step === "enroll" ? totp : codeState.step === "enroll" ? codeState : null;

  if (stage === "email") {
    return (
      <form action={emailAction} className="space-y-4">
        <ErrorBox message={emailState.error} />
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="vous@exemple.com"
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm"
        />
        <button disabled={emailPending} className="w-full rounded-xl bg-navy-900 py-3 text-sm font-semibold text-white disabled:opacity-60">
          Recevoir le code
        </button>
      </form>
    );
  }

  if (stage === "code") {
    return (
      <form action={codeAction} className="space-y-4">
        <ErrorBox message={codeState.error} />
        <p className="text-sm text-muted">Un code à 6 chiffres a été envoyé si cette adresse est autorisée.</p>
        <input type="hidden" name="email" value={email} />
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          className="w-full rounded-xl border border-border px-4 py-3 text-center text-lg tracking-[0.4em]"
        />
        <button disabled={codePending} className="w-full rounded-xl bg-navy-900 py-3 text-sm font-semibold text-white disabled:opacity-60">
          Continuer
        </button>
      </form>
    );
  }

  // Étape TOTP : enrôlement au premier accès, puis code de l&apos;application.
  return (
    <form action={totpFormAction} className="space-y-4">
      <ErrorBox message={totp.error ?? codeState.error} />
      {enrollState && (
        <div className="space-y-3 rounded-xl bg-navy-50 p-4 text-sm">
          <p>Scannez ce QR code avec votre application d&apos;authentification, puis saisissez le code affiché.</p>
          {enrollState.qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={enrollState.qr} alt="QR code à scanner" className="mx-auto h-40 w-40" />
          )}
          <p className="break-all font-mono text-xs">{enrollState.secret}</p>
        </div>
      )}
      <input
        name="totp"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        required
        placeholder="Code de l&apos;application"
        className="w-full rounded-xl border border-border px-4 py-3 text-center text-lg tracking-[0.4em]"
      />
      <button disabled={totpBusy} className="w-full rounded-xl bg-navy-900 py-3 text-sm font-semibold text-white disabled:opacity-60">
        Ouvrir la console
      </button>
    </form>
  );
}
