"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ConnexionEmployePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/connexion");
  }, [router]);

  return null;
}
