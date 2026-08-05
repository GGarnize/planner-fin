import '@quasar/extras/material-icons/material-icons.css';
import 'quasar/dist/quasar.css';
import { Quasar } from 'quasar';
import { createApp } from 'vue';
import App from './App.vue';

createApp(App).use(Quasar, {}).mount('#app');
