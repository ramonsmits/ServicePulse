<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useDiagnostics, type Diagnostics } from "@/composables/useDiagnostics";

const { fetch } = useDiagnostics();

const diagnostics = ref<Diagnostics | null>(null);
const authDisabled = ref(false);
const error = ref<string | null>(null);
const loading = ref(true);

async function loadDiagnostics() {
  loading.value = true;
  error.value = null;
  authDisabled.value = false;
  diagnostics.value = null;

  try {
    const result = await fetch();
    if (result === null) {
      authDisabled.value = true;
    } else {
      diagnostics.value = result;
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to load diagnostics";
  } finally {
    loading.value = false;
  }
}

onMounted(loadDiagnostics);

function statusBadgeClass(status: string): string {
  switch (status) {
    case "allowed":
      return "badge-status badge-allowed";
    case "scoped":
      return "badge-status badge-scoped";
    case "notGranted":
      return "badge-status badge-not-granted";
    default:
      return "badge-status";
  }
}
</script>

<template>
  <div class="container">
    <div class="row">
      <div class="col-sm-12">
        <h1>My Diagnostics</h1>
        <button type="button" class="btn btn-default refresh-btn" @click="loadDiagnostics">Refresh</button>
      </div>
    </div>

    <div v-if="loading" class="row">
      <div class="col-sm-12">
        <p>Loading diagnostics...</p>
      </div>
    </div>

    <div v-else-if="error" class="row">
      <div class="col-sm-12">
        <div class="alert alert-danger"><strong>Error:</strong> {{ error }}. Failed to load diagnostics — please try again.</div>
      </div>
    </div>

    <div v-else-if="authDisabled" class="row">
      <div class="col-sm-12">
        <div class="alert alert-info"><strong>Authorization is disabled.</strong> The diagnostics view is only meaningful when OIDC is enabled.</div>
      </div>
    </div>

    <template v-else-if="diagnostics">
      <!-- Identity Section -->
      <div class="row section-row">
        <div class="col-sm-12">
          <h3>Identity</h3>
          <table class="table table-bordered">
            <tbody>
              <tr>
                <th>Subject</th>
                <td>{{ diagnostics.identity.subject }}</td>
              </tr>
              <tr>
                <th>Name</th>
                <td>{{ diagnostics.identity.name }}</td>
              </tr>
              <tr>
                <th>Authenticated</th>
                <td>
                  <span :class="diagnostics.identity.is_authenticated ? 'badge badge-success' : 'badge badge-secondary'">
                    {{ diagnostics.identity.is_authenticated ? "Yes" : "No" }}
                  </span>
                </td>
              </tr>
              <tr>
                <th>Authentication Type</th>
                <td>{{ diagnostics.identity.authentication_type }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Claims Section -->
      <div class="row section-row">
        <div class="col-sm-12">
          <h3>Claims</h3>
          <div class="table-responsive">
            <table class="table table-bordered table-striped">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Value</th>
                  <th>Issuer</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(claim, index) in diagnostics.claims" :key="index">
                  <td class="claim-type">{{ claim.type }}</td>
                  <td class="claim-value">
                    <span :title="claim.value">{{ claim.value }}</span>
                  </td>
                  <td class="claim-issuer">{{ claim.issuer }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Permissions Section -->
      <div class="row section-row">
        <div class="col-sm-12">
          <h3>Permissions</h3>
          <table class="table table-bordered">
            <thead>
              <tr>
                <th>Permission</th>
                <th>Status</th>
                <th>Scope</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(perm, index) in diagnostics.permissions" :key="index">
                <td>{{ perm.permission }}</td>
                <td>
                  <span :class="statusBadgeClass(perm.status)">{{ perm.status }}</span>
                </td>
                <td>
                  <template v-if="perm.scope">
                    <div v-if="perm.scope.allow.length > 0"><strong>Allow:</strong> {{ perm.scope.allow.join(", ") }}</div>
                    <div v-if="perm.scope.deny.length > 0"><strong>Deny:</strong> {{ perm.scope.deny.join(", ") }}</div>
                  </template>
                  <span v-else class="text-muted">unrestricted</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Policy Section -->
      <div class="row section-row">
        <div class="col-sm-12">
          <p class="text-muted small">Policy loaded at: {{ diagnostics.policy.loaded_at }}</p>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.refresh-btn {
  margin-bottom: 1rem;
  float: right;
}

.section-row {
  margin-top: 1.5rem;
}

.claim-value span {
  display: block;
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: help;
}

.table-responsive {
  max-height: 400px;
  overflow-y: auto;
}

.badge-status {
  display: inline-block;
  padding: 0.25em 0.6em;
  font-size: 0.85em;
  font-weight: 600;
  border-radius: 0.25rem;
  text-transform: lowercase;
}

.badge-allowed {
  background-color: #28a745;
  color: #fff;
}

.badge-scoped {
  background-color: #fd7e14;
  color: #fff;
}

.badge-not-granted {
  background-color: #6c757d;
  color: #fff;
}
</style>
