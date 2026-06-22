import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import './style.css';

// 预挂主题，避免首屏闪烁；晴空为默认（无属性），谧夜挂 data-theme="night"
try {
    if (localStorage.getItem('one-theme') !== 'sky') {
        document.documentElement.dataset.theme = 'night';
    }
} catch {}

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
