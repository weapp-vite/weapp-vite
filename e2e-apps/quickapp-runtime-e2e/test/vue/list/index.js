/* eslint-disable no-undef, prefer-arrow-callback, style/space-before-function-paren -- hap-toolkit E2E 使用 Mocha 全局和普通函数。 */
export default function(vm) {
  describe('vue list', function() {
    it('keeps parity with the native list', function() {
      expect(vm.items.map(item => item.name)).to.deep.equal(['alpha', 'beta'])
    })
  })
}
