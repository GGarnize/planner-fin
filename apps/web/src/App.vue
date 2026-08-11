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
  color: #0f172a;
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
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
  background: #f5f7fb;
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
  background: #fff;
  padding: 2rem;
  box-shadow: 0 1rem 3rem #0f172a1f;
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
  border: 1px solid #94a3b8;
  border-radius: 0.5rem;
}
button {
  background: #155eef;
  color: #fff;
  border: 0;
  cursor: pointer;
}
button:disabled {
  opacity: 0.65;
}
[role='alert'] {
  color: #b42318;
}
@media (max-width: 767px) {
  .card {
    padding: var(--card-padding);
  }
}
</style>
