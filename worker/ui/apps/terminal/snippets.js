import { defineStore } from 'pinia';
import { ref } from 'vue';

const STORAGE_KEY = 'terminal_snippets';
const SEED_VERSION_KEY = 'terminal_snippets_seed_version';
const CURRENT_SEED_VERSION = 2;
export const MAX_SNIPPETS = 50;

const DEFAULT_SNIPPETS = [
    { name: 'claude', command: 'claude', autoSend: true },
    { name: 'claude --dangerously-skip-permissions', command: 'claude --dangerously-skip-permissions', autoSend: true },
    { name: 'codex', command: 'codex', autoSend: true },
    { name: 'codex --yolo', command: 'codex --yolo', autoSend: true },
];

// 旧种子的标签，命令不变，只改标签为命令本身
const LEGACY_LABEL_MAP = {
    'claude 跳权限': 'claude --dangerously-skip-permissions',
    'claude yolo':   'claude --dangerously-skip-permissions',
    'codex yolo':    'codex --yolo',
};

function genId(i = 0) {
    return Date.now().toString(36) + i.toString(36) + Math.random().toString(36).slice(2, 5);
}

function migrate(list) {
    return list.map(s => {
        const target = LEGACY_LABEL_MAP[s.name];
        if (target && s.command === target) return { ...s, name: target };
        return s;
    });
}

function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === null) {
            const seeded = DEFAULT_SNIPPETS.map((s, i) => ({ id: genId(i), ...s }));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
            localStorage.setItem(SEED_VERSION_KEY, String(CURRENT_SEED_VERSION));
            return seeded;
        }
        const list = JSON.parse(raw);
        const v = parseInt(localStorage.getItem(SEED_VERSION_KEY) || '1', 10);
        if (v < CURRENT_SEED_VERSION) {
            const migrated = migrate(list);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
            localStorage.setItem(SEED_VERSION_KEY, String(CURRENT_SEED_VERSION));
            return migrated;
        }
        return list;
    } catch { return []; }
}

export const useSnippetsStore = defineStore('snippets', () => {
    const snippets = ref(load());

    function persist() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snippets.value));
    }

    function add({ name, command, autoSend }) {
        if (snippets.value.length >= MAX_SNIPPETS) return false;
        snippets.value.push({ id: genId(), name, command, autoSend });
        persist();
        return true;
    }

    function update(id, patch) {
        const idx = snippets.value.findIndex(x => x.id === id);
        if (idx !== -1) {
            snippets.value[idx] = { ...snippets.value[idx], ...patch };
            persist();
        }
    }

    function remove(id) {
        snippets.value = snippets.value.filter(x => x.id !== id);
        persist();
    }

    return { snippets, add, update, remove };
});
