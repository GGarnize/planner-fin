<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
  backTo?: string | Record<string, unknown>;
  eyebrow?: string;
}>();
</script>

<template>
  <header class="page-header">
    <router-link v-if="backTo" class="page-header__up" :to="backTo" aria-label="Voltar">
      <span class="material-icons" aria-hidden="true">arrow_back</span>
    </router-link>
    <div class="page-header__content">
      <p v-if="eyebrow" class="page-header__eyebrow">{{ eyebrow }}</p>
      <h1>{{ title }}</h1>
      <p v-if="description" class="page-header__description">{{ description }}</p>
    </div>
    <div v-if="$slots.action" class="page-header__action">
      <slot name="action" />
    </div>
  </header>
</template>

<style scoped>
.page-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 1rem;
}
.page-header__up {
  width: 2.75rem;
  min-width: 2.75rem;
  height: 2.75rem;
  display: inline-grid;
  place-items: center;
  color: var(--color-on-accent-container);
  background: var(--color-accent-container);
  border: 1px solid var(--color-accent);
  border-radius: 0.5rem;
  text-decoration: none;
}
.page-header__up .material-icons {
  font-size: 1.25rem;
}
.page-header__content {
  min-width: 0;
}
.page-header__content h1,
.page-header__description,
.page-header__eyebrow {
  margin: 0;
}
.page-header__content h1 {
  overflow-wrap: anywhere;
}
.page-header__description {
  margin-top: 0.25rem;
  color: var(--color-text-muted);
}
.page-header__eyebrow {
  margin-bottom: 0.2rem;
  color: var(--color-text-muted);
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
}
.page-header__action {
  display: flex;
  justify-content: flex-end;
  min-width: 0;
}
.page-header__up:focus-visible {
  outline: 3px solid var(--color-focus-ring);
  outline-offset: 2px;
}
@media (max-width: 600px) {
  .page-header {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .page-header__action {
    grid-column: 1 / -1;
    justify-content: stretch;
  }
  .page-header__action :deep(button),
  .page-header__action :deep(a) {
    width: 100%;
  }
}
</style>
