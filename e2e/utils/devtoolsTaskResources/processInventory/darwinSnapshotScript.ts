// JXA 只使用 Foundation/libSystem；冷启动后复用最多三轮 PID 请求，不创建嵌套子进程。
export const darwinSnapshotScript = `
ObjC.import('Foundation');
ObjC.bindFunction('malloc', ['void *', ['unsigned long']]);
ObjC.bindFunction('free', ['void', ['void *']]);
ObjC.bindFunction('proc_pidpath', ['int', ['int', 'void *', 'uint32_t']]);
ObjC.bindFunction('strchr', ['char *', ['void *', 'int']]);
function run() {
  var input = $.NSFileHandle.fileHandleWithStandardInput;
  var output = $.NSFileHandle.fileHandleWithStandardOutput;
  function send(value) {
    output.writeData($(JSON.stringify(value) + '\\n').dataUsingEncoding($.NSUTF8StringEncoding));
  }
  send({ phase: 'ready' });
  var buffer = $.malloc(4096);
  if (!buffer) throw new Error('Cannot allocate process path buffer.');
  try {
    var requests = 0;
    while (true) {
      var request = '';
      while (request.indexOf('\\n') < 0) {
        var chunk = input.availableData;
        if (!Number(chunk.length)) {
          if (requests && !request) return;
          throw new Error('Missing process identity request.');
        }
        request += ObjC.unwrap($.NSString.alloc.initWithDataEncoding(chunk, $.NSUTF8StringEncoding));
        if (request.length > 1024 * 1024) throw new Error('Oversized process identity request.');
      }
      if (request.indexOf('\\n') !== request.length - 1) throw new Error('Multiple process identity requests.');
      if (++requests > 3) throw new Error('Too many process identity requests.');
      var parsed = JSON.parse(request);
      if (!parsed || Object.keys(parsed).length !== 1 || !Array.isArray(parsed.pids)) throw new Error('Invalid process identity request.');
      var seen = {};
      var pids = parsed.pids;
      pids.forEach(function(pid) {
        if (!Number.isSafeInteger(pid) || pid <= 0 || seen[pid]) throw new Error('Invalid process identity.');
        seen[pid] = true;
      });
      send({ phase: 'paths', paths: pids.map(function(pid) {
        var count = $.proc_pidpath(pid, buffer, 4096);
        return { pid: pid, executable: count > 0 ? $.strchr(buffer, 47) : null };
      }) });
      // Node 完成最终清单后才关闭 stdin，避免 helper 自身在采样轮次之间消失。
    }
  } finally { $.free(buffer); }
}
`
