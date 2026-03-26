import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

type ThemeMode = 'auto' | 'light' | 'dark'

const THEME_STORAGE_KEY = 'mpcore-web-demo-theme'

export function useWorkbenchTheme() {
  const themeMode = ref<ThemeMode>('auto')
  const systemPrefersDark = ref(false)
  let colorSchemeQuery: MediaQueryList | null = null
  let handleColorSchemeChange: ((event: MediaQueryListEvent) => void) | null = null

  const effectiveTheme = computed<'light' | 'dark'>(() => {
    if (themeMode.value === 'auto') {
      return systemPrefersDark.value ? 'dark' : 'light'
    }
    return themeMode.value
  })

  function applyTheme(theme: 'light' | 'dark') {
    document.documentElement.dataset.simTheme = theme
  }

  function setThemeMode(mode: ThemeMode) {
    themeMode.value = mode
    if (mode === 'auto') {
      localStorage.removeItem(THEME_STORAGE_KEY)
      return
    }
    localStorage.setItem(THEME_STORAGE_KEY, mode)
  }

  onMounted(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const updateSystemTheme = (event?: MediaQueryList | MediaQueryListEvent) => {
      systemPrefersDark.value = event?.matches ?? mediaQuery.matches
    }

    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    themeMode.value = storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : 'auto'

    updateSystemTheme(mediaQuery)
    handleColorSchemeChange = event => updateSystemTheme(event)
    mediaQuery.addEventListener('change', handleColorSchemeChange)
    colorSchemeQuery = mediaQuery
  })

  onBeforeUnmount(() => {
    if (colorSchemeQuery && handleColorSchemeChange) {
      colorSchemeQuery.removeEventListener('change', handleColorSchemeChange)
    }
  })

  watch(effectiveTheme, (theme) => {
    applyTheme(theme)
  }, {
    immediate: true,
  })

  return {
    effectiveTheme,
    themeMode,
    setThemeMode,
  }
}
