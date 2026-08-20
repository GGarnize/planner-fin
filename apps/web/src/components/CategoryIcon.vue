<script setup lang="ts">
import { computed } from 'vue';
import type { FinancialCategoryIcon } from '@planner-fin/shared';
import { materialCategoryIcon, validCategoryColor } from '../category-icon';

const props = defineProps<{
  icon: FinancialCategoryIcon | null | undefined;
  color?: string | null;
  label?: string;
}>();

const materialIcon = computed(() => materialCategoryIcon(props.icon));
const style = computed<Record<string, string> | undefined>(() =>
  validCategoryColor(props.color) ? { '--category-accent': props.color! } : undefined,
);
</script>

<template>
  <span
    class="category-icon"
    :class="{ 'category-icon--fallback': !icon }"
    :style="style"
    :title="label"
    aria-hidden="true"
  >
    <span class="material-icons">{{ materialIcon }}</span>
  </span>
</template>

<style scoped>
.category-icon {
  --category-accent: var(--color-border);
  display: inline-grid;
  width: 1.75rem;
  height: 1.75rem;
  flex: 0 0 auto;
  place-items: center;
  border-left: 3px solid var(--category-accent);
  border-radius: 0.5rem;
  background: var(--color-surface-muted);
  color: var(--color-text);
}

.category-icon--fallback {
  color: var(--color-text-muted);
}

.material-icons {
  font-size: 1.05rem;
  line-height: 1;
}
</style>
