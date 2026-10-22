import { redirect } from "next/navigation";

// Ancienne page de connexion employé par WhatsApp. Les liens existants
// (e-mails d'invitation, page d'accueil) pointent encore ici.
export default function ConnexionEmployePage() {
  redirect("/connexion");
}
