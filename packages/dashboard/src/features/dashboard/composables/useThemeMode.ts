import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'weapp-vite-dashboard-theme'

function readStoredTheme(): ThemePreference {
  if (typeof window === 'undefined') {
    return 'system'
  }
  const value = window.localStorage.getItem(STORAGE_KEY)
  return value === 'light' || value === 'dark' || value === 'system'
    ? value
    : 'system'
}

function resolveTheme(preference: ThemePreference, darkModeQuery: MediaQueryList | null): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') {
    return preference
  }
  return darkModeQuery?.matches ? 'dark' : 'light'
}

export function useThemeMode() {
  const themePreference = ref<ThemePreference>(readStoredTheme())
  const darkModeQuery = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null

  const resolvedTheme = computed<ResolvedTheme>(() => resolveTheme(themePreference.value, darkModeQuery))

  const applyTheme = (theme: ResolvedTheme) => {
    if (typeof document === 'undefined') {
      return
    }
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
  }

  const persistPreference = (value: ThemePreference) => {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(STORAGE_KEY, value)
  }

  const handleSystemThemeChange = () => {
    applyTheme(resolvedTheme.value)
  }

  watch(themePreference, (value) => {
    persistPreference(value)
    applyTheme(resolvedTheme.value)
  }, { immediate: true })

  onMounted(() => {
    darkModeQuery?.addEventListener('change', handleSystemThemeChange)
    applyTheme(resolvedTheme.value)
  })

  onBeforeUnmount(() => {
    darkModeQuery?.removeEventListener('change', handleSystemThemeChange)
  })

  return {
    themePreference,
    resolvedTheme,
    setThemePreference(value: ThemePreference) {
      themePreference.value = value
    },
  }
}
