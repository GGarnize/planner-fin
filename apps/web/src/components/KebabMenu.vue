<script setup lang="ts">
/* global HTMLElement, KeyboardEvent, MouseEvent, Node */
import { onBeforeUnmount, onMounted, ref } from 'vue';

export interface KebabMenuAction {
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

defineProps<{ label?: string; actions: KebabMenuAction[] }>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);

function toggle() {
  open.value = !open.value;
}
function close() {
  open.value = false;
}
function select(action: KebabMenuAction) {
  close();
  action.onSelect();
}
function onDocClick(event: MouseEvent) {
  if (open.value && root.value && !root.value.contains(event.target as Node)) close();
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    event.preventDefault();
    close();
  }
}
onMounted(() => {
  globalThis.document.addEventListener('click', onDocClick, true);
  globalThis.document.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  globalThis.document.removeEventListener('click', onDocClick, true);
  globalThis.document.removeEventListener('keydown', onKeydown);
});
</script>
<template>
  <div ref="root" class="kebab-menu">
    <button
      type="button"
      class="kebab-trigger"
      :aria-label="label ?? 'Mais ações'"
      aria-haspopup="true"
      :aria-expanded="open"
      @click.stop="toggle"
    >
      <span class="material-icons" aria-hidden="true">more_vert</span>
    </button>
    <div v-if="open" class="kebab-panel" role="menu">
      <button
        v-for="(action, index) in actions"
        :key="index"
        type="button"
        role="menuitem"
        :class="{ danger: action.danger }"
        @click.stop="select(action)"
      >
        {{ action.label }}
      </button>
    </div>
  </div>
</template>
<style scoped>
.kebab-menu {
  position: relative;
}
.kebab-trigger {
  width: 2.75rem;
  height: 2.75rem;
  min-height: 0;
  display: grid;
  place-items: center;
  padding: 0;
  background: transparent;
  color: var(--color-text-muted);
  border-radius: 50%;
}
.kebab-trigger:hover,
.kebab-trigger[aria-expanded='true'] {
  background: var(--color-surface-muted);
  color: var(--color-text);
}
.kebab-panel {
  position: absolute;
  z-index: 30;
  right: 0;
  top: calc(100% + 0.25rem);
  min-width: 11rem;
  display: grid;
  padding: 0.35rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  box-shadow: var(--shadow-overlay);
}
.kebab-panel button {
  min-height: 44px;
  padding: 0 0.75rem;
  text-align: left;
  background: transparent;
  color: var(--color-text);
  border-radius: 0.5rem;
}
.kebab-panel button:hover,
.kebab-panel button:focus-visible {
  background: var(--color-surface-muted);
}
.kebab-panel button.danger {
  color: var(--color-error);
}
</style>
