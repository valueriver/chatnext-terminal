import { defineStore } from 'pinia';
import { ref } from 'vue';

const KEY = 'roam-theme';
const THEMES = ['sky', 'night'];   // 晴空 / 谧夜
const DEFAULT = 'night';           // 默认谧夜，延续 roam 的暗色调性

export const THEME_LABELS = { sky: '晴空', night: '谧夜' };

function load() {
    try {
        const v = localStorage.getItem(KEY);
        return THEMES.includes(v) ? v : DEFAULT;
    } catch {
        return DEFAULT;
    }
}

// 晴空为默认（不挂属性）；谧夜挂 data-theme="night"
function apply(theme) {
    const el = document.documentElement;
    if (theme === 'night') el.dataset.theme = 'night';
    else delete el.dataset.theme;
    // 通知非 CSS 的消费者（如 xterm 终端）跟随换肤
    try { window.dispatchEvent(new CustomEvent('roam-theme', { detail: { theme } })); } catch {}
}

export const useThemeStore = defineStore('theme', () => {
    const theme = ref(load());
    apply(theme.value);

    function setTheme(t) {
        if (!THEMES.includes(t)) return;
        theme.value = t;
        try { localStorage.setItem(KEY, t); } catch {}
        apply(t);
    }

    function toggle() {
        setTheme(theme.value === 'night' ? 'sky' : 'night');
    }

    return { theme, themes: THEMES, labels: THEME_LABELS, setTheme, toggle };
});
