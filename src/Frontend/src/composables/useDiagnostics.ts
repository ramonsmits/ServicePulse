import serviceControlClient from "@/components/serviceControlClient";

export interface DiagnosticsIdentity {
  subject: string;
  name: string;
  is_authenticated: boolean;
  authentication_type: string;
}

export interface DiagnosticsClaim {
  type: string;
  value: string;
  issuer: string;
}

export interface DiagnosticsPermissionScope {
  allow: string[];
  deny: string[];
}

export interface DiagnosticsPermission {
  permission: string;
  status: "allowed" | "scoped" | "notGranted";
  scope: DiagnosticsPermissionScope | null;
}

export interface DiagnosticsPolicy {
  loaded_at: string;
}

export interface Diagnostics {
  identity: DiagnosticsIdentity;
  claims: DiagnosticsClaim[];
  permissions: DiagnosticsPermission[];
  policy: DiagnosticsPolicy;
}

/**
 * Composable for fetching diagnostics from GET /api/me/diagnostics.
 *
 * Returns null when auth is disabled (404).
 * Throws on other errors so the caller can show an error state.
 */
export function useDiagnostics() {
  /**
   * Fetches the diagnostics from ServiceControl.
   *
   * @returns Parsed Diagnostics object, or null if auth is disabled (404).
   * @throws Error on server errors (5xx, etc.)
   */
  async function fetch(): Promise<Diagnostics | null> {
    const response = await serviceControlClient.fetchFromServiceControl("me/diagnostics");

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch diagnostics: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as Diagnostics;
  }

  return { fetch };
}
