import { acceptHMRUpdate, defineStore } from "pinia";
import { ref } from "vue";

const SESSION_STORAGE_KEY = "sp_permissions_descriptor";

export interface PermissionScope {
  allow: string[];
  deny: string[];
}

export interface PermissionEntry {
  permission: string;
  scope: PermissionScope | null;
}

export interface PermissionsDescriptor {
  version: string;
  user: string;
  permissions: PermissionEntry[];
}

export const usePermissionsStore = defineStore("permissions", () => {
  const permissions = ref<PermissionEntry[]>([]);
  const version = ref<string | null>(null);

  // Hydrate from sessionStorage on creation
  const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (stored) {
    try {
      const descriptor: PermissionsDescriptor = JSON.parse(stored);
      permissions.value = descriptor.permissions ?? [];
      version.value = descriptor.version ?? null;
    } catch {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  function setDescriptor(descriptor: PermissionsDescriptor) {
    permissions.value = descriptor.permissions ?? [];
    version.value = descriptor.version ?? null;
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(descriptor));
  }

  function clearDescriptor() {
    permissions.value = [];
    version.value = null;
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }

  return {
    permissions,
    version,
    setDescriptor,
    clearDescriptor,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(usePermissionsStore, import.meta.hot));
}

export type PermissionsStore = ReturnType<typeof usePermissionsStore>;
