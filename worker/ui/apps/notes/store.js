import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/system/api';

export const useNotesStore = defineStore('notes', () => {
    const items = ref([]);
    const loading = ref(false);
    const hasMore = ref(false);
    const loadingMore = ref(false);

    async function load() {
        loading.value = true;
        try {
            const res = await api.get('/apps/notes?limit=60');
            items.value = res.notes || [];
            hasMore.value = items.value.length >= 60;
        } finally { loading.value = false; }
    }

    async function loadMore() {
        if (loadingMore.value) return;
        loadingMore.value = true;
        try {
            const res = await api.get(`/apps/notes?limit=60&offset=${items.value.length}`);
            const more = res.notes || [];
            items.value.push(...more);
            hasMore.value = more.length >= 60;
        } finally { loadingMore.value = false; }
    }

    async function save(note) {
        if (note.id) {
            await api.put(`/apps/notes/${note.id}`, note);
        } else {
            await api.post('/apps/notes', note);
        }
        await load();
    }

    async function remove(id) {
        await api.del(`/apps/notes/${id}`);
        items.value = items.value.filter(n => n.id !== id);
    }

    return { items, loading, hasMore, loadingMore, load, loadMore, save, remove };
});
