import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { ResolvedTheme, ThemePreference } from '../types'
import { inject, provide } from 'vue'
import { useThemeMode } from './useThemeMode'

interface DashboardThemeContext {
  themePreference: Ref<ThemePreference>
  resolvedTheme: ComputedRef<ResolvedTheme>
  setThemePreference: (value: ThemePreference) => void
}

const dashboardThemeKey: InjectionKey<DashboardThemeContext> = Symbol('dashboard-theme')

export function provideDashboardTheme(context: DashboardThemeContext) {
  provide(dashboardThemeKey, context)
}

export function useDashboardTheme() {
  const context = inject(dashboardThemeKey, null)

  if (context) {
    return context
  }

  return useThemeMode()
}
