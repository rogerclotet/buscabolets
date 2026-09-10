"use client";

import { useEffect, useState } from "react";

type Update =
  | { kind: "unavailable" }
  | { kind: "available"; worker: ServiceWorker; error: string | null }
  | { kind: "updating"; worker: ServiceWorker };

export function PwaUpdate({ saveProgress }: { saveProgress: () => boolean }) {
  const [update, setUpdate] = useState<Update>({ kind: "unavailable" });

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    )
      return;

    const container = navigator.serviceWorker;
    let controller = container.controller;
    let reloading = false;
    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    const workers = new Map<ServiceWorker, () => void>();

    const controllerChanged = () => {
      const previous = controller;
      controller = container.controller;
      // First installation claims the page too, but does not need a reload.
      // Other open tabs reload on upgrades so their HTML matches the new cache.
      if (previous && controller !== previous && !reloading) {
        reloading = true;
        window.location.reload();
      }
    };
    const watch = (worker: ServiceWorker | null) => {
      if (!worker || workers.has(worker)) return;
      const changed = () => {
        if (worker.state === "installed" && container.controller) {
          setUpdate({ kind: "available", worker, error: null });
        } else if (worker.state === "redundant") {
          setUpdate((current) =>
            current.kind !== "unavailable" && current.worker === worker
              ? { kind: "unavailable" }
              : current,
          );
        }
      };
      workers.set(worker, changed);
      worker.addEventListener("statechange", changed);
      changed();
    };
    const updateFound = () => watch(registration?.installing ?? null);
    const checkForUpdate = () => {
      if (document.visibilityState === "visible") {
        void registration?.update().catch(() => {
          // A disconnected device keeps playing its cached release.
        });
      }
    };

    container.addEventListener("controllerchange", controllerChanged);
    window.addEventListener("online", checkForUpdate);
    document.addEventListener("visibilitychange", checkForUpdate);
    void container
      .register("/sw.js", { updateViaCache: "none" })
      .then((result) => {
        if (disposed) return;
        registration = result;
        registration.addEventListener("updatefound", updateFound);
        watch(registration.waiting);
        watch(registration.installing);
        checkForUpdate();
      })
      .catch(() => {
        // The online game works without a service worker.
      });

    return () => {
      disposed = true;
      container.removeEventListener("controllerchange", controllerChanged);
      window.removeEventListener("online", checkForUpdate);
      document.removeEventListener("visibilitychange", checkForUpdate);
      registration?.removeEventListener("updatefound", updateFound);
      for (const [worker, changed] of workers) {
        worker.removeEventListener("statechange", changed);
      }
    };
  }, []);

  if (update.kind === "unavailable") return null;

  const applyUpdate = () => {
    if (update.kind !== "available") return;
    if (!saveProgress()) {
      setUpdate({
        ...update,
        error:
          "No hem pogut desar la partida. Torna-ho a provar abans d'actualitzar.",
      });
      return;
    }
    try {
      update.worker.postMessage({ type: "SKIP_WAITING" });
      setUpdate({ kind: "updating", worker: update.worker });
    } catch {
      setUpdate({
        ...update,
        error: "No hem pogut aplicar l'actualització. Torna-ho a provar.",
      });
    }
  };

  return (
    <section className="update-notice" aria-label="Actualització disponible">
      <div role="status">
        <p className="update-title">Hi ha una nova versió del bosc.</p>
        <p>
          {update.kind === "updating"
            ? "Actualitzant el joc…"
            : (update.error ??
              "Desarem la partida i tornarem a obrir el joc amb la nova versió.")}
        </p>
      </div>
      <button
        type="button"
        className="primary-button"
        disabled={update.kind === "updating"}
        onClick={applyUpdate}
      >
        {update.kind === "updating" ? "Actualitzant…" : "Actualitza ara"}
      </button>
    </section>
  );
}
