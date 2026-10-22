/**
 * Tài khoản thu phí không dừng (ePass / VETC). Hai nhà cung cấp không có API công khai
 * (chỉ tích hợp với ngân hàng/ví đối tác), nên DLiMap chỉ lưu thông tin người dùng tự nhập
 * để cảnh báo khi số dư không đủ cho chuyến đi, và dẫn link sang trang chính thức để nạp tiền.
 */
export interface Wallet {
  provider: 'ePass' | 'VETC' | null
  /** balance as last entered by the user */
  balance: number | null
  updatedAt: number | null
}

export const WALLET_PROVIDERS = {
  ePass: { name: 'ePass (VDTC – Viettel)', url: 'https://epass-vdtc.com.vn' },
  VETC: { name: 'VETC', url: 'https://vetc.com.vn' },
} as const

export function useWallet() {
  const wallet = usePersisted<Wallet>('wallet2', () => ({ provider: null, balance: null, updatedAt: null }))

  function setBalance(provider: 'ePass' | 'VETC', balance: number | null) {
    wallet.value = { provider, balance, updatedAt: balance == null ? null : Date.now() }
  }

  return { wallet, setBalance }
}
