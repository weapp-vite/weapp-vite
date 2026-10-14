/** 一次内核快照保留父关系；句柄内核验路径和出生时间，不依赖 WMI 服务。 */
export function windowsKernelProcessQuery(pids?: readonly number[]) {
  if (pids?.some(pid => !Number.isSafeInteger(pid) || pid <= 0 || pid > 0xFFFFFFFF)) {
    throw new TypeError('Windows process queries require positive 32-bit PIDs.')
  }
  const selection = pids ? `[uint32[]]@(${[...new Set(pids)].join(',')})` : '$null'
  return `
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;

public static class WeappDevProcessSnapshot {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  private struct ProcessEntry {
    public uint Size, Usage, ProcessId;
    public UIntPtr DefaultHeap;
    public uint ModuleId, Threads, ParentProcessId;
    public int Priority;
    public uint Flags;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string Name;
  }
  public sealed class Row {
    public uint ProcessId, ParentProcessId;
    public string ExecutablePath, Started;
  }
  [DllImport("kernel32.dll", SetLastError = true)]
  private static extern IntPtr CreateToolhelp32Snapshot(uint flags, uint pid);
  [DllImport("kernel32.dll", EntryPoint = "Process32FirstW", SetLastError = true)]
  [return: MarshalAs(UnmanagedType.Bool)] private static extern bool First(IntPtr snapshot, ref ProcessEntry entry);
  [DllImport("kernel32.dll", EntryPoint = "Process32NextW", SetLastError = true)]
  [return: MarshalAs(UnmanagedType.Bool)] private static extern bool Next(IntPtr snapshot, ref ProcessEntry entry);
  [DllImport("kernel32.dll", SetLastError = true)]
  private static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
  [DllImport("kernel32.dll", EntryPoint = "QueryFullProcessImageNameW", CharSet = CharSet.Unicode, SetLastError = true)]
  [return: MarshalAs(UnmanagedType.Bool)] private static extern bool Image(IntPtr process, uint flags, StringBuilder path, ref uint length);
  [DllImport("kernel32.dll", EntryPoint = "GetProcessTimes", SetLastError = true)]
  [return: MarshalAs(UnmanagedType.Bool)] private static extern bool Times(IntPtr process, out long created, out long exited, out long kernel, out long user);
  [DllImport("kernel32.dll")]
  private static extern void GetSystemTimePreciseAsFileTime(out long time);
  [DllImport("kernel32.dll", SetLastError = true)]
  [return: MarshalAs(UnmanagedType.Bool)] private static extern bool CloseHandle(IntPtr handle);

  private static void Inspect(Row row, long capturedBefore) {
    IntPtr handle = OpenProcess(0x1000, false, row.ProcessId);
    // 缺失权限或查询中退出保留父关系，后续 reachable 门禁不能把它当作消失。
    if (handle == IntPtr.Zero) return;
    try {
      long created, exited, kernel, user;
      if (!Times(handle, out created, out exited, out kernel, out user)
          || created <= 0 || created > capturedBefore) return;
      // 已核验的出生元数据仍供退出父进程的后代检查；只有完整活动身份才授予清理权限。
      row.Started = DateTime.FromFileTimeUtc(created).ToString("o", CultureInfo.InvariantCulture);
      if (exited != 0) return;
      StringBuilder path = new StringBuilder(32768);
      uint length = (uint)path.Capacity;
      if (!Image(handle, 0, path, ref length) || length == 0 || length >= path.Capacity) return;
      long checkedCreated, checkedExited;
      if (!Times(handle, out checkedCreated, out checkedExited, out kernel, out user)
          || checkedCreated != created || checkedExited != 0) return;
      row.ExecutablePath = path.ToString();
    }
    finally {
      if (!CloseHandle(handle)) throw new Win32Exception(Marshal.GetLastWin32Error());
    }
  }

  public static Row[] Capture(uint[] pids) {
    long capturedBefore;
    GetSystemTimePreciseAsFileTime(out capturedBefore);
    IntPtr snapshot = CreateToolhelp32Snapshot(2, 0);
    if (snapshot == new IntPtr(-1)) throw new Win32Exception(Marshal.GetLastWin32Error());
    List<Row> rows = new List<Row>();
    HashSet<uint> selected = pids == null ? null : new HashSet<uint>(pids);
    HashSet<uint> seen = new HashSet<uint>();
    try {
      ProcessEntry entry = new ProcessEntry();
      entry.Size = (uint)Marshal.SizeOf(typeof(ProcessEntry));
      bool found = First(snapshot, ref entry);
      while (found) {
        if (entry.ProcessId > 0 && (selected == null || selected.Contains(entry.ProcessId))) {
          if (!seen.Add(entry.ProcessId)) throw new InvalidOperationException("Duplicate process identity");
          rows.Add(new Row { ProcessId = entry.ProcessId, ParentProcessId = entry.ParentProcessId });
        }
        found = Next(snapshot, ref entry);
      }
      if (Marshal.GetLastWin32Error() != 18) throw new Win32Exception(Marshal.GetLastWin32Error());
    }
    finally {
      if (!CloseHandle(snapshot)) throw new Win32Exception(Marshal.GetLastWin32Error());
    }
    foreach (Row row in rows) Inspect(row, capturedBefore);
    return rows.ToArray();
  }
}

'@
$weappQueryRows=@([WeappDevProcessSnapshot]::Capture(${selection}))
`
}

/** 旧 CIM 身份只有微秒精度；原始内核时间继续单独参与父子代次核验。 */
export function windowsLegacyProcessStarted(started: string): string | undefined {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\.(\d{7})Z$/.exec(started)
  if (!match) {
    return
  }
  const milliseconds = Date.parse(`${match[1]}.000Z`)
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== `${match[1]}.000Z`) {
    return
  }
  return `${match[1]}.${match[2]!.slice(0, 6)}0Z`
}
