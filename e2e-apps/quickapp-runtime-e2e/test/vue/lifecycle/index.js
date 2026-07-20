/* eslint-disable no-undef, prefer-arrow-callback, style/space-before-function-paren -- hap-toolkit E2E 使用 Mocha 全局和普通函数。 */
export default function(vm) {
  describe('vue lifecycle', function() {
    it('maps onMounted to QuickApp onReady', function() {
      expect(vm.lifecycle).to.equal('mounted')
    })
  })
}
