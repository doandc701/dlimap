<script setup lang="ts">
const { alerts } = useAlerts()
</script>

<template>
  <TransitionGroup
    tag="div" class="pointer-events-auto flex flex-col gap-1.5"
    enter-active-class="transition-all duration-250" leave-active-class="transition-all duration-250"
    enter-from-class="opacity-0 -translate-y-2" leave-to-class="opacity-0 -translate-y-2"
  >
    <div
      v-for="a in alerts" :key="a.id"
      class="card flex items-center gap-2.5 border-l-[5px] px-3 py-2"
      :class="{
        'border-l-primary': a.level === 'info',
        'border-l-warn': a.level === 'warn',
        'border-l-danger bg-[#fff1f1] text-red-900 dark:bg-red-950 dark:text-red-200': a.level === 'danger',
      }"
    >
      <AppIcon :name="a.icon" :size="26" />
      <div class="min-w-0 flex-1">
        <div class="text-sm font-bold in-[.car]:text-lg">{{ a.title }}</div>
        <div v-if="a.detail" class="text-[13px]" :class="a.level === 'danger' ? 'opacity-85' : 'text-muted'">{{ a.detail }}</div>
      </div>
      <div v-if="a.distance != null" class="text-base font-extrabold whitespace-nowrap">{{ formatDistance(a.distance) }}</div>
    </div>
  </TransitionGroup>
</template>
