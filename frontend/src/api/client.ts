import axios from "axios";

function getViteApiBaseUrl(): string {
  try {
    // @ts-ignore
    if (typeof import.meta !== "undefined" && import.meta?.env?.VITE_API_BASE_URL) {
      // @ts-ignore
      return import.meta.env.VITE_API_BASE_URL;
    }
  } catch {
    // ignore
  }
  return "";
}

const apiBase = getViteApiBaseUrl();
const BASE_URL = apiBase ? `${apiBase}/api` : "/api";

const api = axios.create({
  baseURL: BASE_URL,

  headers: {
    "Content-Type": "application/json",
  },
});

let inFlightCount = 0;
let slowTimer: ReturnType<typeof setTimeout> | null = null;

function notifySyncStart() {
  inFlightCount += 1;
  if (inFlightCount === 1 && !slowTimer) {
    slowTimer = setTimeout(() => {
      if (inFlightCount > 0) {
        window.dispatchEvent(new CustomEvent("pumpledger:slow-server", { detail: true }));
      }
    }, 3000);
  }
}

function notifySyncEnd(ok: boolean) {
  inFlightCount = Math.max(0, inFlightCount - 1);
  if (inFlightCount === 0) {
    if (slowTimer) {
      clearTimeout(slowTimer);
      slowTimer = null;
    }
    window.dispatchEvent(new CustomEvent("pumpledger:slow-server", { detail: false }));
  }
  window.dispatchEvent(
    new CustomEvent("pumpledger:sync-status", { detail: { ok, at: Date.now() } })
  );
}

// Attach the bearer token (if present) and the active pump UUID to every request.
api.interceptors.request.use((config) => {
  notifySyncStart();
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const pumpUuid = localStorage.getItem("active_pump_uuid");
  if (pumpUuid && pumpUuid !== "undefined" && pumpUuid !== "null") {
    config.headers["X-Pump-UUID"] = pumpUuid;
  }

  return config;
});


let isRedirecting = false;

// On 401, drop the stale token and send the user back to login with return path preserved.
// On 403, redirect to the access-denied page.
api.interceptors.response.use(
  (response) => {
    notifySyncEnd(true);
    return response;
  },
  (error) => {
    notifySyncEnd(false);
    if (error.response?.status === 401) {
      localStorage.removeItem("token");

      if (window.location.pathname !== "/login" && !isRedirecting) {
        isRedirecting = true;
        sessionStorage.setItem(
          "redirect_after_login",
          window.location.pathname + window.location.search
        );
        window.location.href = "/login?expired=true";
      }
    }

    if (error.response?.status === 403) {
      if (!window.location.pathname.includes("access-denied")) {
        window.location.href = "/dashboard/access-denied";
      }
    }

    return Promise.reject(error);
  }
);


export default api;

/**
 * Extract a human-readable message from an axios/FastAPI error so the UI can
 * show what actually went wrong (duplicate invoice, duplicate mobile, OCR
 * failure, …) instead of a generic "something failed."
 */
export function extractApiError(
  err: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  const detail = (err as any)?.response?.data?.detail;

  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  // FastAPI validation errors arrive as a list of { msg, loc }.
  if (Array.isArray(detail) && detail.length > 0) {
    const msg = detail
      .map((d) => d?.msg)
      .filter(Boolean)
      .join("; ");

    if (msg) return msg;
  }

  if ((err as any)?.message) {
    return (err as any).message;
  }

  return fallback;
}
