import type { ExternalOption, InputOptions, RolldownOutput, RollupError } from 'rolldown'

export type RequireFunction = (
  outfile: string,
  ctx: { format: 'cjs' | 'esm' },
) => any

export type GetOutputFile = (filepath: string, format: 'esm' | 'cjs') => string

export type RebuildCallback = (
  error: RollupError | null,
  result: RolldownOutput | null,
) => void

export type ReadFile = (filepath: string) => string

export interface Options {
  cwd?: string
  /**
   * The filepath to bundle and require
   */
  filepath: string
  /**
   * The `require` function that is used to load the output file
   * Default to the global `require` function
   * This function can be asynchronous, i.e. returns a Promise
   */
  require?: RequireFunction
  /**
   * esbuild options
   *
   */
  rolldownOptions?: InputOptions
  /**
   * Get the path to the output file
   * By default we simply replace the extension with `.bundled_{randomId}.js`
   */
  getOutputFile?: GetOutputFile
  /**
   * Enable watching and call the callback after each rebuild
   */
  // onRebuild?: (ctx: {
  //   err?: RollupError
  //   mod?: any
  //   dependencies?: string[]
  // }) => void

  /** External packages */
  external?: ExternalOption

  /** Not external packages */
  // notExternal?: (string | RegExp)[]

  /**
   * Automatically mark node_modules as external
   * @default true - `false` when `filepath` is in node_modules
   */
  // externalNodeModules?: boolean

  /**
   * A custom tsconfig path to read `paths` option
   *
   * Set to `false` to disable tsconfig
   */
  tsconfig?: string | false

  /**
   * Preserve compiled temporary file for debugging
   * Default to `process.env.BUNDLE_REQUIRE_PRESERVE`
   */
  preserveTemporaryFile?: boolean

  /**
   * Provide bundle format explicitly
   * to skip the default format inference
   */
  format?: 'cjs' | 'esm'

  // readFile?: ReadFile
}

export interface InternalOptions extends Omit<Options, 'cwd' | 'filepath'> {
  isESM: boolean
  format: 'cjs' | 'esm'
  tsconfig?: string
}
