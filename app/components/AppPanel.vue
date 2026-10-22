<script setup lang="ts">
defineProps<{ title: string; demo?: boolean }>()
const emit = defineEmits<{ close: [] }>()

// bottom sheet on phones, centred dialog on wide screens; Esc / tapping outside closes it
const open = ref(true)
const wide = useState('wideScreen', () => window.matchMedia('(min-width: 900px)').matches)
</script>

<template>
  <Dialog
    v-model:visible="open" modal dismissable-mask block-scroll :draggable="false"
    :position="wide ? 'center' : 'bottom'"
    class="max-h-[88vh] w-full max-w-[520px]"
    :class="wide ? '' : 'm-0! rounded-b-none!'"
    :pt="{ header: { class: 'pb-2' }, content: { class: 'pb-5' }, pcCloseButton: { root: { class: 'outline-none! shadow-none!' } } }"
    @after-hide="emit('close')"
  >
    <template #header>
      <h2 class="m-0 flex items-center gap-2 text-lg font-bold">
        {{ title }} <Tag v-if="demo" value="Demo" severity="warn" class="text-[11px]" />
      </h2>
    </template>
    <slot />
  </Dialog>
</template>
