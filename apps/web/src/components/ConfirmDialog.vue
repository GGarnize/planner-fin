<script setup lang="ts">
defineProps<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
}>();
const emit = defineEmits<{ confirm: []; cancel: [] }>();
</script>
<template>
  <div v-if="open" class="confirm-backdrop" role="presentation" @click.self="emit('cancel')">
    <section
      class="confirm-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <h2 id="confirm-dialog-title">{{ title }}</h2>
      <p>{{ message }}</p>
      <div class="confirm-actions">
        <button type="button" class="secondary" :disabled="busy" @click="emit('cancel')">
          Cancelar
        </button>
        <button type="button" class="danger" :disabled="busy" @click="emit('confirm')">
          {{ confirmLabel ?? 'Confirmar' }}
        </button>
      </div>
    </section>
  </div>
</template>
<style scoped>
.confirm-backdrop {
  position: fixed;
  z-index: 90;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: var(--color-overlay);
}
.confirm-dialog {
  width: min(100%, 26rem);
  padding: 1.25rem;
  border-radius: 1rem;
  background: var(--color-surface);
  box-shadow: var(--shadow-overlay);
  color: var(--color-text);
}
.confirm-dialog h2 {
  margin-top: 0;
}
.confirm-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
}
.confirm-actions button {
  flex: 1;
  min-height: 44px;
}
.secondary {
  background: var(--color-surface-muted);
  color: var(--color-text);
}
.danger {
  background: var(--color-error);
  color: var(--color-on-accent);
}
</style>
