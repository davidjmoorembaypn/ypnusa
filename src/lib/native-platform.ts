/** Runtime switches: deploy first, reconcile data, then activate explicitly. */
export function nativePlatformEnabled(): boolean {
  return process.env.YPNUS_NATIVE_PLATFORM === "true";
}

export function nativeAuthOrigin(): string | null {
  try {
    const url = new URL(process.env.YPNUS_AUTH_ORIGIN || "");
    if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.hostname === "localhost")) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function safeAccountNext(value: unknown): string {
  if (typeof value !== "string" || /[\\\s]/.test(value)) return "/dashboard";
  return ["/dashboard", "/onboarding", "/account", "/billing"].includes(value) ? value : "/dashboard";
}
