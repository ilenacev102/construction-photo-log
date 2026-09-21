"use client";

import { useEffect } from "react";
import { monitoring } from "@/lib/monitoring";

/**
 * Регистрација на Service Worker (PWA) — само во производство.
 * Во развој се прескокнува за да не пречи на HMR.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      monitoring.captureException(error, { url: "/sw.js" });
    });
  }, []);

  return null;
}