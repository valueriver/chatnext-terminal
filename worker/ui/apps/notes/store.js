import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/system/api';

// 笔记:云端 D1 的 notes 表(经 /apps/notes REST)。
export const useNotesStore = defineStore('notes', () => {
    const items = ref([]);
    const page = ref(1);
    const pages = ref(1);
    const total = ref(0);
    const loading = ref(false);

    async function load() {
        loading.value = true;
        try {
            const d = await api.get('/apps/notes');
            items.value = d.notes || [];
            total.value = items.value.length;
            page.value = 1;
            pages.value = 1;
        } catch { /* ignore */ }
        loading.value = false;
    }
    async function save(payload) {
        if (payload.id) await api.put(`/apps/notes/${payload.id}`, payload);
        else await api.post('/apps/notes', payload);
        await load();
        return { ok: true };
    }
    async function remove(id) {
        await api.del(`/apps/notes/${id}`);
        await load();
        return { ok: true };
    }

    return { items, page, pages, total, loading, load, save, remove };
});
