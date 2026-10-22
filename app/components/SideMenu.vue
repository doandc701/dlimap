<script setup lang="ts">
const emit = defineEmits<{ close: []; open: [panel: string]; carmode: [] }>()
const { wallet } = useWallet()
const { self } = useGroup()
const online = useOnline()

const items = computed(() => [
  { id: 'toll', icon: 'payments' as IconName, label: 'Phí BOT & ePass/VETC', hint: wallet.value.balance != null ? `${wallet.value.provider} · ${formatVnd(wallet.value.balance)}` : '' },
  { id: 'violation', icon: 'violation' as IconName, label: 'Tra cứu phạt nguội' },
  { id: 'group', icon: 'group' as IconName, label: 'Đi theo nhóm', hint: self.value.code ? `Nhóm ${self.value.code}` : '' },
  { id: 'cams', icon: 'trafficCam' as IconName, label: 'Camera giao thông' },
  { id: 'tires', icon: 'tire' as IconName, label: 'Cảm biến áp suất lốp' },
  { id: 'offline', icon: 'offline' as IconName, label: 'Bản đồ ngoại tuyến (Hybrid)', hint: online.value ? 'Đang trực tuyến' : 'Mất kết nối' },
  { id: 'settings', icon: 'settings' as IconName, label: 'Cài đặt' },
])

// mounted while the menu is open; slides out before telling the page to unmount it
const open = ref(true)
const ITEM = 'w-full justify-start! gap-3! rounded-xl! px-2.5! py-3! text-left text-fg!'
</script>

<template>
  <Drawer
    v-model:visible="open" position="left" block-scroll
    class="w-[min(320px,86vw)]!"
    :pt="{ header: { class: 'px-4 pt-4 pb-2' }, content: { class: 'px-2.5 pb-4' } }"
    @after-hide="emit('close')"
  >
    <template #header>
      <div class="flex items-center gap-2.5">
        <img src="/icon.svg" alt="" width="36" height="36">
        <div>
          <b class="text-lg">DLiMap</b>
          <div class="text-[13px] text-muted">Trợ lý giao thông thông minh</div>
        </div>
      </div>
    </template>
    <nav class="flex flex-col">
      <Button v-for="it in items" :key="it.id" text severity="secondary" :class="ITEM" @click="emit('open', it.id)">
        <span class="grid w-7 flex-none place-items-center text-muted"><AppIcon :name="it.icon" :size="22" /></span>
        <span class="min-w-0 flex-1">
          <span class="block font-semibold">{{ it.label }}</span>
          <span v-if="it.hint" class="block text-[13px] font-normal text-muted">{{ it.hint }}</span>
        </span>
      </Button>
      <Button text severity="secondary" :class="ITEM" @click="emit('carmode')">
        <span class="grid w-7 flex-none place-items-center text-muted"><AppIcon name="carMode" :size="22" /></span>
        <span class="min-w-0 flex-1"><span class="block font-semibold">Chế độ lái xe</span><span class="block text-[13px] font-normal text-muted">Toàn màn hình, giữ màn hình sáng</span></span>
      </Button>
    </nav>
    <p class="px-2.5 pt-4 text-[13px] text-muted">
      Dữ liệu bản đồ © OpenStreetMap contributors · OpenFreeMap · OSRM
    </p>
  </Drawer>
</template>
