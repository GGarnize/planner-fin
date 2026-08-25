<script setup lang="ts">
defineProps<{
  to: string | Record<string, unknown>;
  icon?: string;
  label: string;
  compact?: boolean;
}>();
</script>

<template>
  <router-link
    class="panel-action-link"
    :class="{ 'panel-action-link--compact': compact }"
    :to="to"
  >
    <span v-if="icon" class="material-icons" aria-hidden="true">{{ icon }}</span>
    <span>{{ label }}</span>
    <span class="material-icons panel-action-link__chevron" aria-hidden="true">chevron_right</span>
  </router-link>
</template>

<style scoped>
.panel-action-link {
  min-height: 2.75rem;
  display: grid;
  grid-template-columns: 1.5rem minmax(0, 1fr) 1.5rem;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.7rem;
  color: var(--color-on-accent-container);
  background: var(--color-accent-container);
  border: 1px solid var(--color-accent);
  border-radius: 0.5rem;
  text-decoration: none;
  font-weight: 700;
}
.panel-action-link--compact {
  min-height: 2.5rem;
  padding: 0.5rem 0.6rem;
  font-size: 0.92rem;
}
.panel-action-link .material-icons {
  font-size: 1.2rem;
}
.panel-action-link__chevron {
  justify-self: end;
}
.panel-action-link:focus-visible {
  outline: 3px solid var(--color-focus-ring);
  outline-offset: 2px;
}
</style>
