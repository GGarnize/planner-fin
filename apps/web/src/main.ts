import '@quasar/extras/material-icons/material-icons.css';
import 'quasar/dist/quasar.css';
import { Quasar } from 'quasar';
import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import { installAndroidBackHandler } from './mobile';

createApp(App).use(Quasar, {}).use(router).mount('#app');
installAndroidBackHandler(router);
