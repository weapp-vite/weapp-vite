/* eslint-disable no-undef, prefer-arrow-callback, style/space-before-function-paren -- hap-toolkit E2E 使用 Mocha 全局和普通函数。 */
export default function(vm) {
  describe('native system api', function() {
    it('exposes the declared system API', function() {
      expect(vm.result).to.equal('idle')
      vm.readDevice()
      expect(vm.result).to.equal('supported')
    })
  })
}
