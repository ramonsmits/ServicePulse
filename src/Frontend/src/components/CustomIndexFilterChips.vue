<script setup lang="ts">
import { onMounted } from "vue";
import { useCustomIndexes, type CustomIndexEntry } from "@/composables/useCustomIndexes";

defineProps<{
  /** Reactive map of header-key → current filter value. v-model:filterValues. */
  filterValues: Record<string, string>;
}>();

const emit = defineEmits<{
  /** Fires when the user changes any chip value. Parent decides whether to re-query, navigate, etc. */
  (e: "change"): void;
  (e: "clear", key: string): void;
  (e: "clearAll"): void;
  (e: "update:filterValues", v: Record<string, string>): void;
}>();

const { indexes, valuesFor, fetchValues } = useCustomIndexes();

function getValues(key: string) {
  return valuesFor(key).value;
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

onMounted(() => {
  for (const idx of indexes.value) {
    if (idx.operator !== "starts-with") {
      fetchValues(idx.key);
    }
  }
});
</script>

<template>
  <div class="chips">
    <div v-for="entry in indexes" :key="entry.key" class="chip">
      <label :for="`chip-${entry.key}`">
        <span class="chip-key">{{ entry.key }}</span>
        <span class="chip-authz">{{ authzLabel(entry) }}</span>
      </label>
      <input
        v-if="entry.operator === 'starts-with'"
        :id="`chip-${entry.key}`"
        :value="filterValues[entry.key] ?? ''"
        type="text"
        placeholder="starts with…"
        autocomplete="off"
        @input="(e) => { filterValues[entry.key] = (e.target as HTMLInputElement).value; emit('change'); }"
      />
      <select
        v-else
        :id="`chip-${entry.key}`"
        :value="filterValues[entry.key] ?? ''"
        @change="(e) => { filterValues[entry.key] = (e.target as HTMLSelectElement).value; emit('change'); }"
      >
        <option value="">— any —</option>
        <option v-for="v in getValues(entry.key)" :key="v.value" :value="v.value">
          {{ v.value }} ({{ v.count }})
        </option>
      </select>
      <button
        v-if="filterValues[entry.key]"
        class="chip-clear"
        :aria-label="`Clear ${entry.key} filter`"
        @click="$emit('clear', entry.key)"
      >
        ×
      </button>
    </div>
    <button class="btn btn-sm btn-link clear-all" @click="$emit('clearAll')">Clear all</button>
  </div>
</template>

<style scoped>
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
.chip input,
.chip select {
  width: 14em;
  padding: 0.2rem 0.4rem;
  border: 1px solid #d0d7de;
  border-radius: 4px;
  font-size: 0.9rem;
  background: white;
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
</style>
