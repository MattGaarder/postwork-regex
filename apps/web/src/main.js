import { createApp } from 'vue';
import { Quasar } from 'quasar';
import App from './App.vue';
import { createPinia } from 'pinia';
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query';
import router from './router';

const app = createApp(App);
app.use(Quasar, {});
app.use(createPinia());
app.use(VueQueryPlugin, { queryClient: new QueryClient() });
app.use(router);
app.mount('#app');