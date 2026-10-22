<script setup lang="ts">
import type { VehicleClass } from '#shared/types'

defineEmits<{ close: [] }>()
const settings = useSettings()
const { nav, route, tollTotal, tollUnknown } = useNavigation()
const { wallet, setBalance } = useWallet()
const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return u } }

const provider = ref<'ePass' | 'VETC'>(wallet.value.provider ?? 'ePass')
const balanceInput = ref<number | null>(wallet.value.balance ?? null)
const vehicleClassOptions = ([1, 2, 3, 4, 5] as VehicleClass[]).map((value) => ({ value, label: VEHICLE_CLASS_LABEL[value] }))

function saveBalance() {
  setBalance(provider.value, balanceInput.value != null && Number.isFinite(balanceInput.value) ? Math.round(balanceInput.value) : null)
}
</script>

<template>
  <AppPanel title="Phí BOT & Ví điện tử" @close="$emit('close')">
    <div class="field">
      <span id="toll-vehicle-class">Loại phương tiện (tính phí)</span>
      <Select v-model="settings.vehicleClass" :options="vehicleClassOptions" option-label="label" option-value="value" fluid aria-labelledby="toll-vehicle-class" class="[&.p-focus]:border-(--p-form-field-border-color)!" />
    </div>

    <h3>Trạm thu phí trên tuyến</h3>
    <p v-if="!route" class="my-3 text-[13px] text-muted">Chọn điểm đến để xem các trạm thu phí và tổng chi phí.</p>
    <p v-else-if="nav.poisLoading" class="my-3 text-[13px] text-muted">Đang tìm trạm thu phí…</p>
    <template v-else>
      <ul class="list">
        <li v-for="t in nav.tolls" :key="t.id" class="flex items-center gap-2">
          <div class="min-w-0 flex-1">
            <div><b>{{ t.name }}</b></div>
            <div class="text-[13px] text-muted">
              Km {{ (t.along / 1000).toFixed(1) }} trên tuyến
              <template v-if="t.kind === 'closed'"> · đi {{ t.km!.toFixed(1) }} km<template v-if="t.perKm?.[settings.vehicleClass]"> × {{ t.perKm[settings.vehicleClass]!.toLocaleString('vi-VN') }} đ/km</template></template>
            </div>
            <div v-if="t.source" class="text-[13px] text-muted">
              Nguồn: <a v-if="t.source.url" :href="t.source.url" target="_blank" rel="noopener" class="text-accent underline">{{ hostOf(t.source.url) }}</a><span v-else>{{ t.source.note }}</span>
              ({{ t.source.date }})
              <Tag v-if="!t.source.verified" value="cần xác minh" severity="warn" class="text-[11px]" />
              <div v-if="t.source.note && t.source.url">{{ t.source.note }}</div>
            </div>
          </div>
          <div class="text-right font-bold whitespace-nowrap">
            <template v-if="t.price != null">{{ t.kind === 'closed' ? '~' : '' }}{{ formatVnd(t.price) }}</template>
            <Tag v-else value="chưa có giá" severity="secondary" class="text-[11px]" />
          </div>
        </li>
        <li v-if="!nav.tolls.length" class="text-[13px] text-muted">Không có trạm thu phí trên tuyến này.</li>
      </ul>
      <div class="flex items-center gap-2 border-t-2 border-line py-3 text-base">
        <span class="min-w-0 flex-1">Tổng phí dự kiến<span v-if="tollUnknown" class="text-[13px] text-muted"> (chưa gồm {{ tollUnknown }} mục chưa có giá)</span></span>
        <b>{{ formatVnd(tollTotal) }}</b>
      </div>
      <p class="my-3 text-[13px] text-muted">
        Vị trí trạm và tên cao tốc lấy từ OpenStreetMap. Giá vé lượt và đơn giá cao tốc tra cứu từ các nguồn ghi bên trên
        (cập nhật 22/10/2026, dữ liệu trong <code>server/data/tolls.ts</code>). Cao tốc thu phí kín tính theo số km thực đi;
        số tiền thực tế có thể chênh do làm tròn và cách tính theo cặp trạm của nhà đầu tư.
      </p>
    </template>

    <h3>Tài khoản thu phí không dừng</h3>
    <SelectButton v-model="provider" :options="['ePass', 'VETC']" :allow-empty="false" fluid aria-label="Nhà cung cấp" />
    <form class="my-2 flex items-center gap-2" @submit.prevent="saveBalance">
      <InputNumber
        v-model="balanceInput" locale="vi-VN" suffix=" đ" :min="0" :max-fraction-digits="0" placeholder="Số dư hiện tại của bạn (đ)"
        class="min-w-0 flex-1" fluid :input-class="'focus:border-(--p-form-field-border-color)!'" aria-label="Số dư"
      />
      <Button type="submit" label="Lưu" severity="secondary" />
    </form>
    <p v-if="wallet.balance != null" class="my-3 text-[13px]">
      Số dư {{ wallet.provider }} bạn nhập: <b>{{ formatVnd(wallet.balance) }}</b>
      <span class="text-muted">({{ new Date(wallet.updatedAt!).toLocaleString('vi-VN') }})</span>
      <span v-if="route && tollTotal > wallet.balance" class="font-semibold text-danger"> – không đủ cho chuyến đi (cần ~{{ formatVnd(tollTotal) }})</span>
    </p>
    <Button
      as="a" :href="WALLET_PROVIDERS[provider].url" target="_blank" rel="noopener" fluid class="my-2 no-underline"
      :label="`Nạp tiền / xem số dư trên ${WALLET_PROVIDERS[provider].name}`" :icon="ICON.external" icon-pos="right"
    />
    <p class="my-3 text-[13px] text-muted">
      ePass và VETC không cung cấp API công khai, nên DLiMap không thể đọc số dư tự động. Bạn có thể nạp tiền qua ứng dụng
      ePass/VETC hoặc ngân hàng, ví điện tử liên kết (Viettel Money, MoMo, Vietcombank, VPBank…).
    </p>
  </AppPanel>
</template>
