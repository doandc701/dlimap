<script setup lang="ts">
defineEmits<{ close: [] }>()
const { self, members, others, error, join, create, leave } = useGroup()
const { pos } = usePosition()
const settings = useSettings()
const { map } = useMap()
const code = ref('')
const copied = ref(false)

async function share() {
  const text = `Tham gia nhóm DLiMap của mình, mã: ${self.value.code}`
  if (navigator.share) await navigator.share({ title: 'Đi theo nhóm', text }).catch(() => {})
  else {
    await navigator.clipboard.writeText(self.value.code)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  }
}

function distTo(m: { lat: number; lon: number }) {
  return pos.value.lngLat ? formatDistance(haversine(pos.value.lngLat, [m.lon, m.lat])) : '—'
}

function locate(m: { lat: number; lon: number }) {
  map.value?.flyTo({ center: [m.lon, m.lat], zoom: 15 })
}
</script>

<template>
  <AppPanel title="Đi theo nhóm" @close="$emit('close')">
    <div class="flex items-center gap-2">
      <div class="field min-w-0 flex-1"><span><label for="grp-name">Tên hiển thị</label></span><InputText id="grp-name" v-model="settings.nickname" fluid maxlength="30" class="focus:border-(--p-form-field-border-color)!" /></div>
      <label class="field"><span>Màu</span><input v-model="settings.color" type="color" class="h-10 w-12 cursor-pointer border-0 bg-transparent p-0"></label>
    </div>

    <template v-if="!self.code">
      <Button label="Tạo nhóm mới" :icon="ICON.add" fluid @click="create" />
      <h3>Hoặc tham gia bằng mã</h3>
      <form class="flex items-center gap-2" @submit.prevent="join(code)">
        <InputText v-model="code" class="min-w-0 flex-1 font-bold tracking-[0.15em] uppercase focus:border-(--p-form-field-border-color)!" placeholder="VD: K7P3QX" maxlength="8" aria-label="Mã nhóm" />
        <Button type="submit" label="Tham gia" :disabled="code.length < 4" />
      </form>
      <p class="my-3 text-[13px] text-muted">Vị trí của bạn chỉ được chia sẻ với người có mã nhóm, và tự xoá sau 2 phút ngừng cập nhật.</p>
    </template>

    <template v-else>
      <div class="card bg-bg-2 p-3.5 text-center shadow-none">
        <div class="text-[13px] text-muted">Mã nhóm</div>
        <div class="mt-1 mb-2.5 text-[34px] font-extrabold tracking-[0.2em]">{{ self.code }}</div>
        <div class="flex items-center gap-2">
          <Button :label="copied ? 'Đã sao chép' : 'Chia sẻ mã'" :icon="copied ? ICON.check : ICON.share" severity="secondary" class="min-w-0 flex-1" @click="share" />
          <Button label="Rời nhóm" :icon="ICON.leave" severity="danger" @click="leave" />
        </div>
      </div>
      <Message v-if="error" severity="error" size="small" variant="simple" class="my-3">{{ error }}</Message>
      <h3>Thành viên ({{ members.length }})</h3>
      <ul class="list">
        <li v-for="m in members" :key="m.id" class="flex items-center gap-2">
          <span class="size-3.5 flex-none rounded-full" :style="{ background: m.color }" />
          <span class="min-w-0 flex-1">
            <b>{{ m.name }}</b> <Tag v-if="m.id === self.id" value="Bạn" severity="secondary" class="text-[11px]" />
            <div class="text-[13px] text-muted">{{ m.speed }} km/h · cập nhật {{ Math.max(0, Math.round((Date.now() - m.updatedAt) / 1000)) }}s trước</div>
          </span>
          <Button v-if="m.id !== self.id" :label="distTo(m)" :icon="ICON.goTo" icon-pos="right" severity="secondary" size="small" @click="locate(m)" />
        </li>
        <li v-if="!others.length" class="text-[13px] text-muted">Chưa có ai khác trong nhóm – gửi mã cho bạn đồng hành nhé.</li>
      </ul>
    </template>
  </AppPanel>
</template>
