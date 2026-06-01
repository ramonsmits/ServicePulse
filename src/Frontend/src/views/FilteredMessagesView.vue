<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useCustomIndexes, type CustomIndexEntry } from "@/composables/useCustomIndexes";
import { authFetch } from "@/composables/useAuthenticatedFetch";

interface FailedMessageRow {
  id: string;
  message_id: string;
  message_type: string;
  queue_address: string;
  time_of_failure: string;
  status: string;
  exception?: { message?: string; exception_type?: string };
}

const { indexes, version, refresh: refreshIndexes, error: indexesError } = useCustomIndexes();

// One reactive filter value per configured index, keyed by header name.
const filterValues = ref<Record<string, string>>({});

const loading = ref(false);
const results = ref<FailedMessageRow[]>([]);
const totalCount = ref<number | null>(null);
const lastError = ref<string | null>(null);

// Surfaces of the authz narrowing applied by the server, parsed from response headers.
const narrowedDimensions = ref<string[]>([]);
const emptyNarrowedDimension = ref<string | null>(null);
const serverIndexVersion = ref<string | null>(null);
const forbiddenReason = ref<string | null>(null);

const baseUrl = computed(() => {
  // SC client uses window.defaultConfig.service_control_url; build the absolute URL ourselves.
  const root = (window as unknown as { defaultConfig?: { service_control_url?: string } }).defaultConfig?.service_control_url ?? "/api/";
  return root.endsWith("/") ? root : `${root}/`;
});

function buildUrl(): string {
  const params = new URLSearchParams();
  params.set("per_page", "50");
  for (const idx of indexes.value) {
    const v = filterValues.value[idx.key];
    if (v && v.trim().length > 0) {
      // The operator hint on the index decides which query param shape to use:
      //   equals      → ?attr.<key>=<v>
      //   starts-with → ?attr.<key>.starts-with=<v>
      const paramName = idx.operator === "starts-with" ? `attr.${idx.key}.starts-with` : `attr.${idx.key}`;
      params.set(paramName, v.trim());
    }
  }
  return `${baseUrl.value}errors/by-attributes?${params.toString()}`;
}

async function runQuery() {
  if (indexes.value.length === 0) {
    return;
  }
  loading.value = true;
  lastError.value = null;
  forbiddenReason.value = null;
  narrowedDimensions.value = [];
  emptyNarrowedDimension.value = null;

  try {
    const url = buildUrl();
    const response = await authFetch(url);
    serverIndexVersion.value = response.headers.get("X-CustomIndex-Version");
    const narrowed = response.headers.get("X-AuthzNarrowed");
    if (narrowed) {
      // "NServiceBus.Tenant" — narrowed normally
      // "NServiceBus.Tenant=(empty)" — short-circuited because authorized set is empty
      if (narrowed.includes("=(empty)")) {
        emptyNarrowedDimension.value = narrowed.split("=(empty)")[0];
        narrowedDimensions.value = [];
      } else {
        narrowedDimensions.value = narrowed.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }

    if (response.status === 403) {
      forbiddenReason.value =
        "You requested a value outside your authorized set for one of the filtered dimensions. Clear the filter or pick a value you're authorized for.";
      results.value = [];
      totalCount.value = 0;
      return;
    }

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as FailedMessageRow[];
    results.value = data;
    const totalCountHeader = response.headers.get("Total-Count");
    totalCount.value = totalCountHeader ? Number(totalCountHeader) : data.length;
  } catch (e) {
    lastError.value = (e as Error)?.message ?? String(e);
    results.value = [];
    totalCount.value = null;
  } finally {
    loading.value = false;
  }
}

function clearFilter(key: string) {
  filterValues.value[key] = "";
  runQuery();
}

function clearAll() {
  for (const idx of indexes.value) {
    filterValues.value[idx.key] = "";
  }
  runQuery();
}

function authzLabel(entry: CustomIndexEntry): string {
  if (!entry.authz) {
    return "open";
  }
  if (entry.authz.source === "idp-claim") {
    return `IdP claim: ${entry.authz.claim}`;
  }
  return entry.authz.source;
}

onMounted(async () => {
  await refreshIndexes();
  // Initialize filter values for each configured index.
  for (const idx of indexes.value) {
    if (!(idx.key in filterValues.value)) {
      filterValues.value[idx.key] = "";
    }
  }
  await runQuery();
});

// Re-fetch on any filter change (debounced to avoid spamming as the user types).
let debounceHandle: ReturnType<typeof setTimeout> | null = null;
watch(
  filterValues,
  () => {
    if (debounceHandle) {
      clearTimeout(debounceHandle);
    }
    debounceHandle = setTimeout(() => {
      runQuery();
    }, 350);
  },
  { deep: true },
);
</script>

<template>
  <div class="container">
    <div class="row">
      <div class="col-12">
        <h1>Filtered Failed Messages</h1>
        <p class="text-muted">
          Filters resolved against the dynamic-field <code>FailedMessage/Attributes</code> RavenDB index. Values are
          intersected with your authorized set per the loaded
          <RouterLink to="/configuration/custom-indexes">custom-index config</RouterLink> (active version: <code>{{ version || "—" }}</code>).
        </p>
      </div>
    </div>

    <div v-if="indexesError" class="alert alert-warning">
      Couldn't load the custom-index config: {{ indexesError }}
    </div>

    <div v-if="indexes.length === 0 && !indexesError" class="alert alert-info">
      No custom indexes are configured. Edit <code>extract-headers.yaml</code> on the ServiceControl host and restart.
    </div>

    <div v-if="indexes.length > 0" class="row chip-row">
      <div class="col-12">
        <div class="chips">
          <div v-for="entry in indexes" :key="entry.key" class="chip">
            <label :for="`chip-${entry.key}`">
              <span class="chip-key">{{ entry.key }}</span>
              <span class="chip-authz">{{ authzLabel(entry) }}</span>
            </label>
            <input
              :id="`chip-${entry.key}`"
              v-model="filterValues[entry.key]"
              type="text"
              :placeholder="entry.operator === 'starts-with' ? 'starts with…' : 'any'"
              autocomplete="off"
            />
            <button
              v-if="filterValues[entry.key]"
              class="chip-clear"
              :aria-label="`Clear ${entry.key} filter`"
              @click="clearFilter(entry.key)"
            >
              ×
            </button>
          </div>
          <button class="btn btn-sm btn-link clear-all" @click="clearAll">Clear all</button>
        </div>
      </div>
    </div>

    <div v-if="narrowedDimensions.length > 0" class="alert alert-info narrow-banner">
      Server narrowed the results to your authorized values for:
      <strong>{{ narrowedDimensions.join(", ") }}</strong>
      (you may see fewer results than the deployment contains).
    </div>

    <div v-if="emptyNarrowedDimension" class="alert alert-warning narrow-banner">
      You have <strong>no authorized values</strong> for <code>{{ emptyNarrowedDimension }}</code> — the result list is
      empty by policy, not because no matching messages exist.
    </div>

    <div v-if="forbiddenReason" class="alert alert-danger">
      {{ forbiddenReason }}
    </div>

    <div v-if="lastError" class="alert alert-danger">
      Query failed: {{ lastError }}
    </div>

    <div class="result-summary">
      <span v-if="loading">Loading…</span>
      <span v-else>
        <strong>{{ totalCount ?? "?" }}</strong> message(s) match.
        <span v-if="serverIndexVersion" class="text-muted">
          (server index version: <code>{{ serverIndexVersion }}</code>)
        </span>
      </span>
    </div>

    <table v-if="results.length > 0" class="table table-striped result-table">
      <thead>
        <tr>
          <th>Message ID</th>
          <th>Type</th>
          <th>Queue</th>
          <th>Exception</th>
          <th>Failed at</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in results" :key="row.id">
          <td><code>{{ row.message_id }}</code></td>
          <td>{{ row.message_type }}</td>
          <td><code>{{ row.queue_address }}</code></td>
          <td>
            <span :title="row.exception?.exception_type">{{ row.exception?.message ?? "—" }}</span>
          </td>
          <td>{{ row.time_of_failure }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.chip-row {
  margin-top: 1rem;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: stretch;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: #f5f7fa;
  border: 1px solid #d0d7de;
  border-radius: 999px;
  padding: 0.3rem 0.6rem;
  font-size: 0.9rem;
}
.chip label {
  display: inline-flex;
  flex-direction: column;
  margin: 0;
  font-weight: 400;
}
.chip-key {
  font-family: monospace;
  font-size: 0.85rem;
  color: #1f2328;
}
.chip-authz {
  font-size: 0.7rem;
  color: #6e7781;
}
.chip input {
  width: 12em;
  padding: 0.2rem 0.4rem;
  border: 1px solid #d0d7de;
  border-radius: 4px;
  font-size: 0.9rem;
}
.chip-clear {
  background: none;
  border: none;
  color: #6e7781;
  cursor: pointer;
  font-size: 1.2rem;
  line-height: 1;
  padding: 0;
}
.chip-clear:hover {
  color: #cf222e;
}
.clear-all {
  align-self: center;
}
.narrow-banner {
  margin-top: 0.75rem;
  margin-bottom: 0.75rem;
}
.result-summary {
  margin: 1rem 0;
}
.result-table code {
  font-size: 0.85rem;
}
</style>
