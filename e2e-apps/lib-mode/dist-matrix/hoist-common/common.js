const SHARED_MARKER = '__LIB_SHARED_MARKER__'
function useShared() {
  return SHARED_MARKER
}
Object.defineProperty(exports, 'useShared', {
  enumerable: true,
  get() {
    return useShared
  },
})
