import type { GetOutputFile } from './types'

// Shared defaults for rolldown-require consumers.
export const configDefaults = Object.freeze({
  resolve: {
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
  },
})

export const defaultGetOutputFile: GetOutputFile = (filepath, _format) => {
  return filepath
}
