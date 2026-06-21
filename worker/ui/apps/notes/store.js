import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/system/api';

// 笔记:云端 D1 的 notes 表(经 /apps/notes REST)。分页:首屏 60,「加载更多」往后翻。
const PAGE = 60;

export const useNotesStore = defineStore('notes', () => {
    const items = ref([]);
    const hasMore = ref(false);
    const loading = ref(false);
    const loadingMore = ref(false);

    async function load() {
        loading.value = true;
        try {
            const d = await api.get(`/apps/notes?limit=${PAGE}`);
            items.value = d.notes || [];
            hasMore.value = Boolean(d.hasMore);
        } catch { /* api 已弹 toast */ }
        loading.value = false;
    }

    async function loadMore() {
        if (!hasMore.value || loadingMore.value) return;
        loadingMore.value = true;
        try {
            const d = await api.get(`/apps/notes?limit=${PAGE}&offset=${items.value.length}`);
            items.value = [...items.value, ...(d.notes || [])];
            hasMore.value = Boolean(d.hasMore);
        } catch { /* api 已弹 toast */ }
        loadingMore.value = false;
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

    return { items, hasMore, loading, loadingMore, load, loadMore, save, remove };
});
