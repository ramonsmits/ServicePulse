import { useAuthStore } from "@/stores/AuthStore";
import { getPermissionsFetcher } from "./usePermissions";

const UNAUTHENTICATED_ENDPOINTS = ["/api/authentication/configuration"];

function isUnauthenticatedEndpoint(url: string): boolean {
  return UNAUTHENTICATED_ENDPOINTS.some((endpoint) => url.includes(endpoint));
}

/**
 * Authenticated fetch wrapper that automatically includes JWT token
 * in the Authorization header when authentication is enabled.
 *
 * Cache invalidation (3): on a 403 response the permissions descriptor is
 * refetched before returning — this self-heals a stale cache and helps SP
 * distinguish a genuine denial from a stale-cache false-negative.
 * The 403 is still surfaced to the caller unchanged.
 */
export async function authFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const authStore = useAuthStore();
  const url = typeof input === "string" ? input : input.url;

  let response: Response;

  // Allow unauthenticated requests to specific endpoints
  if (isUnauthenticatedEndpoint(url)) {
    response = await fetch(input, init);
  } else if (!authStore.authEnabled) {
    // If authentication is disabled, make request without token
    response = await fetch(input, init);
  } else {
    // If authentication is enabled, require a token
    // potentially handle token refresh here if expired, however it shouldnt be required due to silent renew
    const token = authStore.token;
    if (!token) {
      throw new Error("No authentication token available. Please authenticate first.");
    }

    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    response = await fetch(input, { ...init, headers });
  }

  if (response.status === 403) {
    // Refetch the descriptor so the cache self-heals (invalidation strategy 3)
    void getPermissionsFetcher()();
  }

  return response;
}
