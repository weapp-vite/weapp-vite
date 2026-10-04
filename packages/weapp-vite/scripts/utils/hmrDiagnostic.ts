import process from 'node:process'

export const AUTO_IMPORT_HMR_DIAGNOSTIC_ENV = 'AUTO_IMPORT_HMR_DIAGNOSTIC'
export const AUTO_IMPORT_HMR_DIAGNOSTIC_PROFILE_ENV = 'AUTO_IMPORT_HMR_DIAGNOSTIC_PROFILE'
export const AUTO_IMPORT_HMR_DIAGNOSTIC_PAIR_ENV = 'AUTO_IMPORT_HMR_DIAGNOSTIC_PAIR'
export const AUTO_IMPORT_HMR_DIAGNOSTIC_PHASE_ENV = 'AUTO_IMPORT_HMR_DIAGNOSTIC_PHASE'
export const AUTO_IMPORT_HMR_DIAGNOSTIC_ROOT_ENV = 'AUTO_IMPORT_HMR_DIAGNOSTIC_ROOT'
export const AUTO_IMPORT_HMR_DIAGNOSTIC_OWNER_ENV = 'AUTO_IMPORT_HMR_DIAGNOSTIC_OWNER'

export function isAutoImportHmrDiagnosticEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env[AUTO_IMPORT_HMR_DIAGNOSTIC_ENV] === '1'
}

export function isAutoImportHmrDiagnosticProfileEnabled(env: NodeJS.ProcessEnv = process.env) {
  return isAutoImportHmrDiagnosticEnabled(env) && env[AUTO_IMPORT_HMR_DIAGNOSTIC_PROFILE_ENV] === '1'
}

export function isAutoImportHmrDiagnosticPairEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env[AUTO_IMPORT_HMR_DIAGNOSTIC_PAIR_ENV] === '1'
}
