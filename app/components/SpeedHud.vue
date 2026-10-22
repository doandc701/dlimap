<script setup lang="ts">
const { pos } = usePosition()
const { road } = useRoad()
const { limit, overspeed, safeDist } = useAlerts()
const { nav, route } = useNavigation()

const roadName = computed(() => {
  if (road.value?.name || road.value?.ref) return road.value.name || road.value.ref
  const step = nav.value.active && nav.value.progress ? route.value?.steps[nav.value.progress.stepIdx] : null
  return step?.name || (road.value ? 'Đường không tên' : 'Đang xác định đường…')
})

const CHIP = 'px-1.5! py-0.5! text-[11px]! font-semibold! whitespace-nowrap'
</script>

<template>
  <div class="pointer-events-auto flex items-center gap-2">
    <div
      class="card flex size-[72px] flex-col items-center justify-center rounded-full leading-none transition-[background] duration-200 in-[.car]:size-[104px]"
      :class="{ 'animate-blink bg-danger text-white': overspeed }"
    >
      <b class="text-[28px] in-[.car]:text-[42px]">{{ Math.round(pos.speed) }}</b>
      <span class="text-[11px]" :class="overspeed ? 'text-white' : 'text-muted'">km/h</span>
    </div>
    <div
      v-if="limit"
      class="grid size-14 place-items-center rounded-full border-[6px] border-[#e02424] bg-white text-black shadow-card in-[.car]:size-20"
      :title="road?.maxspeedSource === 'osm' ? 'Theo biển báo (OSM)' : 'Theo quy định TT 38/2024'"
    >
      <b class="text-xl in-[.car]:text-[30px]">{{ limit }}</b>
    </div>
    <div v-if="pos.lngLat" class="card max-w-[260px] min-w-0 px-3 py-2">
      <div class="truncate text-sm font-bold">{{ roadName }}</div>
      <div class="mt-1 flex flex-wrap items-center gap-1">
        <Tag v-if="road?.residential" severity="secondary" :icon="ICON.residential" value="Khu dân cư" :class="CHIP" />
        <Tag v-if="road?.noOvertaking" severity="danger" :icon="ICON.noOvertaking" value="Cấm vượt" :class="CHIP" />
        <Tag v-if="road?.tunnel" severity="secondary" :icon="ICON.tunnel" value="Hầm" :class="CHIP" />
        <Tag v-if="pos.speed > 20" severity="secondary" :value="`↔ Giữ ≥ ${safeDist} m`" :class="CHIP" />
        <Tag v-if="pos.source === 'sim'" severity="warn" value="Mô phỏng" :class="CHIP" />
      </div>
    </div>
  </div>
</template>
