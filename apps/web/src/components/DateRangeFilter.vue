<script setup lang="ts">
/* global Event, HTMLInputElement */
withDefaults(
  defineProps<{
    from: string;
    to: string;
    label?: string;
    fromLabel?: string;
    toLabel?: string;
    disabled?: boolean;
  }>(),
  {
    label: 'Período',
    fromLabel: 'De',
    toLabel: 'Até',
    disabled: false,
  },
);

const emit = defineEmits<{
  'update:from': [value: string];
  'update:to': [value: string];
}>();

function inputValue(event: Event): string {
  return (event.target as HTMLInputElement).value;
}
</script>

<template>
  <fieldset class="date-range-filter" :disabled="disabled">
    <legend>{{ label }}</legend>
    <label>
      <span>{{ fromLabel }}</span>
      <input
        type="date"
        :value="from"
        :disabled="disabled"
        @input="emit('update:from', inputValue($event))"
      />
    </label>
    <label>
      <span>{{ toLabel }}</span>
      <input
        type="date"
        :value="to"
        :disabled="disabled"
        @input="emit('update:to', inputValue($event))"
      />
    </label>
  </fieldset>
</template>

<style scoped>
.date-range-filter {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  border: 0;
}
legend {
  grid-column: 1 / -1;
  padding: 0;
  font-weight: 700;
}
label {
  min-width: 0;
  display: grid;
  gap: 0.25rem;
}
input {
  width: 100%;
  min-width: 0;
  min-height: 2.75rem;
}
</style>
