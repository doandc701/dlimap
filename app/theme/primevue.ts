import Aura from '@primeuix/themes/aura'
import { definePreset, palette } from '@primeuix/themes'

/**
 * DLiMap look on top of PrimeVue Aura: brand blue #0b5fff, slate surfaces by day,
 * the UI's #111827 gray at night. Tailwind reads the same tokens through tailwindcss-primeui
 * (bg-primary, bg-surface-*), and main.css maps them to the app's own tokens (bg-bg, text-muted…).
 */
const DLiMap = definePreset(Aura, {
  semantic: {
    primary: palette('#0b5fff'),
    colorScheme: {
      light: {
        surface: {
          0: '#ffffff', 50: '#f8fafc', 100: '#f3f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8',
          500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a', 950: '#020617',
        },
        primary: { color: '#0b5fff', contrastColor: '#ffffff', hoverColor: '{primary.600}', activeColor: '{primary.700}' },
        formField: { background: '{surface.100}', borderColor: '{surface.200}', hoverBorderColor: '{surface.300}' },
      },
      dark: {
        surface: {
          0: '#ffffff', 50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db', 400: '#9ca3af',
          500: '#6b7280', 600: '#4b5563', 700: '#374151', 800: '#1f2937', 900: '#111827', 950: '#030712',
        },
        // keep the brand blue with white text at night (Aura would switch to a pale blue with dark text)
        primary: { color: '#0b5fff', contrastColor: '#ffffff', hoverColor: '{primary.400}', activeColor: '{primary.300}' },
        formField: { background: '{surface.800}', borderColor: '{surface.700}', hoverBorderColor: '{surface.600}' },
      },
    },
  },
})

export default {
  preset: DLiMap,
  options: {
    // same switch as the rest of the UI: app.vue toggles .dark on <html>
    darkModeSelector: '.dark',
    // utilities must be able to override component styles: theme, base, primevue, components, utilities
    cssLayer: { name: 'primevue', order: 'theme, base, primevue, components, utilities' },
  },
}
