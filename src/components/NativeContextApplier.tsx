"use client";

import { useEffect } from "react";
import { detectNativeContext } from "@/lib/native-context";

/** Marque <html> avec data-store="1" dans l'application des stores. Sans effet visible sur le web. */
export default function NativeContextApplier() {
  useEffect(() => {
    document.documentElement.dataset.store = detectNativeContext().isStoreApp ? "1" : "0";
  }, []);
  return null;
}
