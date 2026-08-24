"use client";

import { useActionState, useState } from "react";
import {
  requestLinkPhoneOtpAction,
  verifyLinkPhoneOtpAction,
  type OtpRequestState,
  type OtpVerifyState,
} from "@/app/actions/whatsapp-auth";
import { formatPhoneForDisplay } from "@/lib/phone";
import { AlertCircle, CheckCircle2, Loader2, MessageCircle, Pencil } from "lucide-react";

const initialRequestState: OtpRequestState = {};
const initialVerifyState: OtpVerifyState = {};

export default function WhatsAppLinkCard({ phone }: { phone: string | null }) {
  const [linkedPhone, setLinkedPhone] = useState(phone);
  const [editing, setEditing] = useState(false);
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);

  const [requestState, requestAction, requestPending] = useActionState(
    requestLinkPhoneOtpAction,
    initialRequestState
  );
  const [verifyState, verifyAction, verifyPending] = useActionState(
    async (_prev: OtpVerifyState, formData: FormData) => {
      const result = await verifyLinkPhoneOtpAction(_prev, formData);
      if (!result.error) {
        setLinkedPhone(String(formData.get("phone")));
        setEditing(false);
        setPendingPhone(null);
      }
      return result;
    },
    initialVerifyState
  );

  if (requestState.submitted && requestState.phone && pendingPhone !== requestState.phone) {
    setPendingPhone(requestState.phone);
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            linkedPhone ? "bg-green-50 text-green-600" : "bg-navy-50 text-navy-800"
          }`}
        >
          {linkedPhone ? <CheckCircle2 className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-navy-950">Connexion WhatsApp</h2>
          <p className="text-xs text-muted">
            Optionnel — connectez-vous aussi par WhatsApp, en plus de votre email.
          </p>
        </div>
      </div>

      {!editing && (
        <div className="mt-3 flex items-center justify-between gap-3">
          {linkedPhone ? (
            <div className="flex items-center gap-2 rounded-xl bg-navy-50 px-3.5 py-2.5 text-sm">
              <MessageCircle className="h-4 w-4 text-navy-800" />
              <span className="font-medium text-navy-900">{formatPhoneForDisplay(linkedPhone)}</span>
            </div>
          ) : (
            <p className="text-sm text-muted">Aucun numéro lié pour le moment.</p>
          )}
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-xs font-medium text-navy-800 hover:underline"
          >
            <Pencil className="h-3 w-3" /> {linkedPhone ? "Changer" : "Lier un numéro"}
          </button>
        </div>
      )}

      {editing && !pendingPhone && (
        <form action={requestAction} className="mt-3 space-y-2.5">
          {requestState.error && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-600 ring-1 ring-red-100">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{requestState.error}</span>
            </div>
          )}
          <input
            name="phone"
            type="tel"
            required
            placeholder="Ex. 77 123 45 67"
            className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
          />
          <div className="flex items-center gap-2">
            <button
              disabled={requestPending}
              className="flex items-center gap-2 rounded-lg bg-navy-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-navy-800 disabled:opacity-70"
            >
              {requestPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Recevoir un code
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs font-medium text-muted hover:text-navy-900"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {editing && pendingPhone && (
        <form action={verifyAction} className="mt-3 space-y-2.5">
          <input type="hidden" name="phone" value={pendingPhone} />
          {verifyState.error && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-600 ring-1 ring-red-100">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{verifyState.error}</span>
            </div>
          )}
          <p className="text-xs text-muted">
            Code envoyé sur WhatsApp au <span className="font-medium">{pendingPhone}</span>
          </p>
          <input
            name="code"
            type="text"
            inputMode="numeric"
            required
            placeholder="123456"
            className="w-full rounded-xl border border-border px-3.5 py-2.5 text-center text-base tracking-[0.3em] outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
          />
          <div className="flex items-center gap-2">
            <button
              disabled={verifyPending}
              className="flex items-center gap-2 rounded-lg bg-navy-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-navy-800 disabled:opacity-70"
            >
              {verifyPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Confirmer
            </button>
            <button
              type="button"
              onClick={() => {
                setPendingPhone(null);
                setEditing(false);
              }}
              className="text-xs font-medium text-muted hover:text-navy-900"
            >
              Annuler
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
