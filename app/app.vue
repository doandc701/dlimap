<script setup lang="ts">
const isDark = useIsDark()
watchEffect(() => document.documentElement.classList.toggle('dark', isDark.value))
</script>

<template>
  <NuxtPage />
  <BootSplash />
</template>
