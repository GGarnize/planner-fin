<template>
  <q-layout view="hHh lpR fFf"
    ><q-page-container
      ><q-page class="page column items-center justify-center q-pa-lg"
        ><router-view /></q-page></q-page-container
  ></q-layout>
</template>
<style>
.page {
  min-height: 100dvh;
  background: #f5f7fb;
  padding-top: max(24px, env(safe-area-inset-top));
  padding-right: max(24px, env(safe-area-inset-right));
  padding-bottom: max(24px, env(safe-area-inset-bottom));
  padding-left: max(24px, env(safe-area-inset-left));
}
.card {
  width: min(100%, 32rem);
  border-radius: 1rem;
  background: #fff;
  padding: 2rem;
  box-shadow: 0 1rem 3rem rgba(15, 23, 42, 0.12);
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
button {
  font: inherit;
  padding: 0.75rem;
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
h1 {
  color: #0f172a;
}
[role='alert'] {
  color: #b42318;
}
</style>
