<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AuthenticatedShell from './components/AuthenticatedShell.vue';

const route = useRoute();
const isPublic = computed(() => Boolean(route.meta.public));
</script>

<template>
  <div v-if="isPublic" class="public-page"><router-view /></div>
  <AuthenticatedShell v-else><router-view /></AuthenticatedShell>
</template>

<style>
:root {
  --content-max-width: 75rem;
  --mobile-gutter: 1rem;
  --card-padding: 1rem;
  --shell-nav-height: 4.25rem;
  --color-background: #f5f7fb;
  --color-surface: #ffffff;
  --color-surface-muted: #eef4ff;
  --color-text: #0f172a;
  --color-text-muted: #475569;
  --color-border: #cbd5e1;
  --color-overlay: #0f172a99;
  --color-accent: #155eef;
  --color-on-accent: #ffffff;
  --color-accent-hover: #124ed0;
  --color-accent-pressed: #0f3fa8;
  --color-accent-container: #eaf1ff;
  --color-on-accent-container: #123c96;
  --color-focus-ring: #f59e0b;
  --color-success: #15803d;
  --color-success-container: #dcfce7;
  --color-warning: #b45309;
  --color-warning-container: #fef3c7;
  --color-error: #b42318;
  --color-error-container: #fff1f2;
  --color-error-border: #fecaca;
  --color-info: #0369a1;
  --color-info-container: #e0f2fe;
  --shadow-surface: 0 0.5rem 2rem #0f172a18;
  --shadow-overlay: 0 1rem 3rem #0f172a40;
  color: var(--color-text);
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
}
[data-theme='dark'] {
  --color-background: #0b1120;
  --color-surface: #111827;
  --color-surface-muted: #1f2937;
  --color-text: #f8fafc;
  --color-text-muted: #cbd5e1;
  --color-border: #334155;
  --color-overlay: #020617b3;
  --shadow-surface: 0 0.5rem 2rem #00000052;
  --shadow-overlay: 0 1rem 3rem #00000080;
}
[data-accent='TEAL'] {
  --color-accent: #0f766e;
  --color-accent-hover: #0f665f;
  --color-accent-pressed: #115e59;
  --color-accent-container: #ccfbf1;
  --color-on-accent-container: #134e4a;
}
[data-accent='PURPLE'] {
  --color-accent: #7c3aed;
  --color-accent-hover: #6d28d9;
  --color-accent-pressed: #5b21b6;
  --color-accent-container: #ede9fe;
  --color-on-accent-container: #4c1d95;
}
[data-accent='ORANGE'] {
  --color-accent: #c2410c;
  --color-accent-hover: #9a3412;
  --color-accent-pressed: #7c2d12;
  --color-accent-container: #ffedd5;
  --color-on-accent-container: #7c2d12;
}
[data-theme='dark'][data-accent='BLUE'] {
  --color-accent: #60a5fa;
  --color-on-accent: #082f68;
  --color-accent-hover: #93c5fd;
  --color-accent-pressed: #bfdbfe;
  --color-accent-container: #1e3a8a;
  --color-on-accent-container: #dbeafe;
  --color-focus-ring: #fbbf24;
}
[data-theme='dark'][data-accent='TEAL'] {
  --color-accent: #5eead4;
  --color-on-accent: #134e4a;
  --color-accent-hover: #99f6e4;
  --color-accent-pressed: #ccfbf1;
  --color-accent-container: #134e4a;
  --color-on-accent-container: #ccfbf1;
  --color-focus-ring: #fbbf24;
}
[data-theme='dark'][data-accent='PURPLE'] {
  --color-accent: #c4b5fd;
  --color-on-accent: #3b0764;
  --color-accent-hover: #ddd6fe;
  --color-accent-pressed: #ede9fe;
  --color-accent-container: #581c87;
  --color-on-accent-container: #f3e8ff;
  --color-focus-ring: #fbbf24;
}
[data-theme='dark'][data-accent='ORANGE'] {
  --color-accent: #fdba74;
  --color-on-accent: #7c2d12;
  --color-accent-hover: #fed7aa;
  --color-accent-pressed: #ffedd5;
  --color-accent-container: #7c2d12;
  --color-on-accent-container: #ffedd5;
  --color-focus-ring: #fbbf24;
}
* {
  box-sizing: border-box;
}
html,
body,
#app {
  min-height: 100%;
  margin: 0;
}
body {
  overflow-x: hidden;
  color: var(--color-text);
  background: var(--color-background);
}
.public-page {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: max(1.5rem, env(safe-area-inset-top)) max(1.5rem, env(safe-area-inset-right))
    max(1.5rem, env(safe-area-inset-bottom)) max(1.5rem, env(safe-area-inset-left));
}
.card {
  width: min(100%, 32rem);
  border-radius: 1rem;
  background: var(--color-surface);
  padding: 2rem;
  box-shadow: var(--shadow-surface);
}
.page-title,
h1 {
  margin: 0 0 1rem;
  font-size: clamp(1.375rem, 3vw, 1.75rem);
  line-height: 1.25;
}
.section-title,
h2 {
  font-size: clamp(1rem, 2vw, 1.25rem);
  line-height: 1.35;
}
form {
  display: grid;
  gap: 1rem;
  margin-bottom: 1rem;
}
label {
  display: grid;
  gap: 0.35rem;
}
input,
button,
select,
textarea {
  font: inherit;
}
input,
button,
select,
textarea {
  min-height: 2.75rem;
  padding: 0.7rem;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
}
button {
  background: var(--color-accent);
  color: var(--color-on-accent);
  border: 0;
  cursor: pointer;
}
button:hover {
  background: var(--color-accent-hover);
}
button:active {
  background: var(--color-accent-pressed);
}
button:disabled {
  opacity: 0.65;
}
[role='alert'] {
  color: var(--color-error);
}
a {
  color: var(--color-accent);
}
::selection {
  color: var(--color-on-accent);
  background: var(--color-accent);
}
:focus-visible {
  outline: 3px solid var(--color-focus-ring);
  outline-offset: 2px;
}
@media (max-width: 767px) {
  .card {
    padding: var(--card-padding);
  }
}
</style>
