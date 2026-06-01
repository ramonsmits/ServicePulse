import { ref, computed } from "vue";
import serviceControlClient from "@/components/serviceControlClient";
import logger from "@/logger";

/**
 * One configured custom-attribute index returned by GET /api/custom-indexes.
 * Mirrors `CustomIndexEntry` on the SC side.
 */
export interface CustomIndexEntry {
  key: string;
  operator: string; // "equals" | "starts-with"
  authz?: {
    source: string; // "idp-claim" today; "role" reserved
    claim?: string;
    key?: string;
  } | null;
}

export interface CustomIndexesDescriptor {
  version: string;
  indexes: CustomIndexEntry[];
}

/** One distinct value observed for an attribute, with its document count. */
export interface AttributeValueCount {
  value: string;
  count: number;
}

/** Response from GET /api/custom-indexes/{key}/values. */
export interface AttributeValuesDescriptor {
  key: string;
  indexVersion: string;
  values: AttributeValueCount[];
}

// Module-singleton cache — matches the pattern in useAuth / usePermissions.
const descriptor = ref<CustomIndexesDescriptor | null>(null);
const loading = ref(false);
const lastError = ref<string | null>(null);

// Distinct-values cache, keyed by index header key. Populated lazily by fetchValues().
const valuesByKey = ref<Record<string, AttributeValueCount[]>>({});
const valuesLoading = ref<Record<string, boolean>>({});
const valuesError = ref<Record<string, string | null>>({});

let inflight: Promise<void> | null = null;

async function fetchOnce(): Promise<void> {
  if (descriptor.value !== null || inflight !== null) {
    return inflight ?? Promise.resolve();
  }
  loading.value = true;
  inflight = (async () => {
    try {
      const [, data] = await serviceControlClient.fetchTypedFromServiceControl<CustomIndexesDescriptor>("custom-indexes");
      descriptor.value = data;
      lastError.value = null;
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      lastError.value = msg;
      logger.warn("Failed to fetch /api/custom-indexes:", msg);
      // Fail-open: leave descriptor as null; consumers render empty chip set.
      descriptor.value = { version: "", indexes: [] };
    } finally {
      loading.value = false;
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * Fetches the distinct values observed for one configured custom index.
 * Caches per-key; safe to call repeatedly.
 *
 * Skipped silently for `starts-with` operator chips — the values would all be the
 * full header value, not prefixes the user wants to type.
 */
async function fetchValues(key: string): Promise<void> {
  if (valuesByKey.value[key] !== undefined) {
    return;
  }
  valuesLoading.value = { ...valuesLoading.value, [key]: true };
  try {
    const [, data] = await serviceControlClient.fetchTypedFromServiceControl<AttributeValuesDescriptor>(
      `custom-indexes/${encodeURIComponent(key)}/values`,
    );
    valuesByKey.value = { ...valuesByKey.value, [key]: data.values };
    valuesError.value = { ...valuesError.value, [key]: null };
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e);
    valuesError.value = { ...valuesError.value, [key]: msg };
    valuesByKey.value = { ...valuesByKey.value, [key]: [] };
    logger.warn(`Failed to fetch values for custom index '${key}':`, msg);
  } finally {
    valuesLoading.value = { ...valuesLoading.value, [key]: false };
  }
}

/**
 * Read-only access to the configured custom indexes and their observed values.
 * First call triggers a single descriptor fetch; subsequent calls share the cache.
 * Per-key value lists are fetched lazily via {@link fetchValues}.
 *
 * The descriptor is what backs both the failed-message filter-chip UI and
 * the admin "Custom indexes" page. See
 * `research/platform-authorization/xacml-vocabulary.md` for the PEP/PDP/PAP/PIP
 * mapping — the chips themselves are SPA-side PEPs (UX-only), the SC server
 * is the authoritative gate.
 */
export function useCustomIndexes() {
  return {
    descriptor: computed(() => descriptor.value),
    indexes: computed<CustomIndexEntry[]>(() => descriptor.value?.indexes ?? []),
    version: computed(() => descriptor.value?.version ?? ""),
    loading: computed(() => loading.value),
    error: computed(() => lastError.value),
    refresh: fetchOnce,
    valuesFor: (key: string) => computed<AttributeValueCount[]>(() => valuesByKey.value[key] ?? []),
    fetchValues,
    valuesLoading: computed(() => valuesLoading.value),
  };
}
