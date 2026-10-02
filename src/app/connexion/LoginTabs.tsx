"use client";

import { useState } from "react";
import { Mail, MessageCircle, Fingerprint } from "lucide-react";
import LoginForm from "./LoginForm";
import MatriculeLoginForm from "./MatriculeLoginForm";
import WhatsAppLoginTab from "./WhatsAppLoginTab";

const SMS_OTP_ENABLED = process.env.NEXT_PUBLIC_SMS_OTP_ENABLED === "true";

type Tab = "email" | "matricule" | "whatsapp";

export default function LoginTabs() {
  const [tab, setTab] = useState<Tab>("email");

  return (
    <div>
      <div className="mb-5 flex rounded-xl bg-navy-50 p-1">
        <button
          type="button"
          onClick={() => setTab("email")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
            tab === "email" ? "bg-white text-navy-950 shadow-sm" : "text-muted"
          }`}
        >
          <Mail className="h-3.5 w-3.5" /> Email
        </button>
        <button
          type="button"
          onClick={() => setTab("matricule")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
            tab === "matricule" ? "bg-white text-navy-950 shadow-sm" : "text-muted"
          }`}
        >
          <Fingerprint className="h-3.5 w-3.5" /> Matricule
        </button>
        {SMS_OTP_ENABLED && (
          <button
            type="button"
            onClick={() => setTab("whatsapp")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
              tab === "whatsapp" ? "bg-white text-navy-950 shadow-sm" : "text-muted"
            }`}
          >
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </button>
        )}
      </div>
      {tab === "email" && <LoginForm />}
      {tab === "matricule" && <MatriculeLoginForm />}
      {tab === "whatsapp" && SMS_OTP_ENABLED && <WhatsAppLoginTab />}
    </div>
  );
}
