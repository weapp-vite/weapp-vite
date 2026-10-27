import path from 'pathe'

export const CLI_PATH = path.resolve(import.meta.dirname, '../../../../packages/weapp-vite/bin/weapp-vite.js')
export const APP_ROOT = path.resolve(import.meta.dirname, '../../../../e2e-apps/github-issues')
export const DIST_ROOT = path.join(APP_ROOT, 'dist')
export const ISSUE_393_DIST_ROOT = path.join(APP_ROOT, 'dist-issue-393')
export const ISSUE_510_DIST_ROOT = path.join(APP_ROOT, 'dist-issue-510')
export const ISSUE_595_DIST_ROOT = path.join(APP_ROOT, 'dist-issue-595')
export const ISSUE_642_DIST_ROOT = path.join(APP_ROOT, 'dist-issue-642')
export const ISSUE_724_DIST_ROOT = path.join(APP_ROOT, 'dist-issue-724')
export const ISSUE_793_DIST_ROOT = path.join(APP_ROOT, 'dist-issue-793')
export const ISSUE_845_DIST_ROOT = path.join(APP_ROOT, 'dist-issue-845')
export const ISSUE_850_DIST_ROOT = path.join(APP_ROOT, 'dist-issue-850')
export const issue826DistRoot = (jsFormat: 'cjs' | 'esm') => path.join(APP_ROOT, `dist-issue-826-${jsFormat}`)
export const SLOT_FALLBACK_COMPILER_OFF_DIST_ROOT = path.join(APP_ROOT, 'dist-slot-fallback-compiler-off')
export const SLOT_OWNER_ATTR = `__wvSlotOwnerId="{{__wvSlotOwnerId || __wvOwnerId || ''}}"`
