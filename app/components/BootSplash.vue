<script setup lang="ts">
/**
 * Page-load splash (same as DLiMusic): the logo pulses while "DLiMap" comes in letter by letter.
 * How long loading takes isn't known, so the letters come in more and more slowly and the last one
 * is held back; once the map has drawn for the first time the rest land quickly and the splash fades.
 */
const LETTERS = [...'DLiMap']
const ready = useState('mapReady', () => false)

const shown = ref(0)
const gone = ref(false)
const removed = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
let finished = false

function creep() {
  if (shown.value >= LETTERS.length - 1) return
  shown.value++
  timer = setTimeout(creep, 140 * 1.3 ** shown.value)
}

function finish() {
  if (finished) return
  finished = true
  clearTimeout(timer)
  const rest = () => {
    if (shown.value < LETTERS.length) {
      shown.value++
      timer = setTimeout(rest, 70)
      return
    }
    setTimeout(() => {
      gone.value = true
      setTimeout(() => (removed.value = true), 400)
    }, 350)
  }
  rest()
}

onMounted(() => {
  // continue where the pre-JS splash (spa-loading-template.html) got to
  const boot = (window as { __dlimapBoot?: { shown: number; timer: number } }).__dlimapBoot
  if (boot) {
    clearTimeout(boot.timer)
    shown.value = boot.shown
  }
  if (ready.value) finish()
  else timer = setTimeout(creep, 140 * 1.3 ** shown.value)
  // still loading after that (very slow network / map server down): let the user in anyway
  setTimeout(finish, 20_000)
})
watch(ready, (r) => r && finish())
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div
    v-if="!removed" role="status" aria-label="Đang tải DLiMap"
    class="fixed inset-0 z-[2000] flex flex-col items-center justify-center gap-5 bg-bg transition-opacity duration-350"
    :class="{ 'pointer-events-none opacity-0': gone }"
  >
    <img src="/icon.svg" alt="" class="boot-logo size-24 rounded-[22%]">
    <div class="flex text-4xl font-extrabold tracking-[0.02em]" aria-hidden="true">
      <span
        v-for="(l, i) in LETTERS" :key="i"
        class="boot-letter transition-[opacity,transform] duration-250"
        :class="i < shown ? 'translate-y-0 opacity-100' : 'translate-y-[0.6em] opacity-0'"
      >{{ l }}</span>
    </div>
  </div>
</template>

<style scoped>
.boot-logo {
  box-shadow: 0 10px 30px -10px rgba(10, 63, 176, 0.6);
  animation: boot-pulse 1.6s ease-in-out infinite;
}
/* brand gradient of the logo, lighter on the dark theme */
.boot-letter {
  background-image: linear-gradient(135deg, #2f7bff, #0a3fb0);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
:global(.dark) .boot-letter { background-image: linear-gradient(135deg, #8ab4ff, #2f7bff); }
@keyframes boot-pulse { 50% { transform: scale(1.06); } }
@media (prefers-reduced-motion: reduce) { .boot-logo { animation: none; } }
</style>
