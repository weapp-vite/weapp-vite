import dts from 'rollup-plugin-dts'

export default {
  input: './.cache/vue-types/entry.ts',
  output: {
    file: './dist/vue-types.d.mts',
    format: 'es',
  },
  plugins: [
    dts({
      respectExternal: false,
    }),
  ],
  external: [],
}
