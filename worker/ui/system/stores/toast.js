import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useToastStore = defineStore('toast', () => {
    const message = ref('');
    let timer = null;

    function show(msg, duration = 1600) {
        message.value = msg;
        clearTimeout(timer);
        timer = setTimeout(() => { message.value = ''; }, duration);
    }

    return { message, show };
});
