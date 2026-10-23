"use server";

import { clearConsoleSession } from "@/lib/console/session";
import { redirect } from "next/navigation";

export async function logoutConsoleAction() {
  await clearConsoleSession();
  redirect("/console/connexion");
}
