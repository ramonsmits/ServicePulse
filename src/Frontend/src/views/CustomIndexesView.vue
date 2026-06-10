<script setup lang="ts">
import { onMounted } from "vue";
import { useCustomIndexes } from "@/composables/useCustomIndexes";

const { descriptor, indexes, loading, error, refresh } = useCustomIndexes();

onMounted(() => {
  refresh();
});

function authzSummary(authz: { source: string; claim?: string; key?: string } | null | undefined): string {
  if (!authz) return "none — open filter (no narrowing)";
  if (authz.source === "idp-claim") return `IdP claim: ${authz.claim} (intersect)`;
  if (authz.source === "role") return `role binding: ${authz.key} (not implemented in spike)`;
  return `${authz.source} (unknown)`;
}
</script>

<template>
  <div class="container">
    <div class="row">
      <div class="col-12">
        <h1>Custom indexes</h1>
        <p class="text-muted">
          Configured dynamic-field RavenDB indexes over <code>FailedMessage</code> headers, surfaced for filter
          chips on the
          <RouterLink to="/filtered-messages">Filtered Failed Messages</RouterLink> view.
        </p>
      </div>
    </div>

    <div v-if="loading" class="alert alert-info">Loading…</div>
    <div v-if="error" class="alert alert-warning">{{ error }}</div>

    <div v-if="descriptor" class="meta">
      Active index version: <code>{{ descriptor.version || "(empty)" }}</code>.
      A config change produces a new version, and RavenDB builds the new index side-by-side in the background.
    </div>

    <table v-if="indexes.length > 0" class="table table-striped">
      <thead>
        <tr>
          <th>Header key</th>
          <th>Operator</th>
          <th>Authorization source</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="entry in indexes" :key="entry.key">
          <td><code>{{ entry.key }}</code></td>
          <td><code>{{ entry.operator }}</code></td>
          <td>{{ authzSummary(entry.authz) }}</td>
        </tr>
      </tbody>
    </table>

    <div v-if="indexes.length === 0 && !loading" class="alert alert-info">
      No custom indexes configured. Edit <code>extract-headers.yaml</code> on the ServiceControl host and restart.
    </div>

    <div class="text-muted future-note">
      <strong>Spike scope.</strong> This page is read-only. Creating, editing, or deleting indexes through the UI
      requires <code>POST/PUT/DELETE /api/custom-indexes</code> on ServiceControl, which is not implemented yet.
      For now, the config file is the source of truth.
    </div>
  </div>
</template>

<style scoped>
.meta {
  margin: 0.75rem 0 1.25rem;
}
.future-note {
  margin-top: 2rem;
  padding: 0.75rem;
  border-left: 3px solid #d0d7de;
  background: #f6f8fa;
  font-size: 0.9rem;
}
</style>
