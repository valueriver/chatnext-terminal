<script setup>
import { useToastStore } from '@/stores/toast';
const toast = useToastStore();
</script>

<template>
    <div v-if="toast.message"
        class="toast-enter fixed left-1/2 -translate-x-1/2 bottom-24 px-4 py-2 bg-zinc-800/95 border border-zinc-700 text-zinc-100 text-sm rounded-lg shadow-2xl z-50 pointer-events-none">
        {{ toast.message }}
    </div>
</template>
