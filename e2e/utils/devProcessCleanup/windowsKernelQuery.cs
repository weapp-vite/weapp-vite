using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;

internal static class WeappDevProcessSnapshot {
  private const string Header = "WEAPP_DEV_PROCESS_ROWS_V1";
  private static readonly CultureInfo Invariant = CultureInfo.InvariantCulture;

  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  private struct ProcessEntry {
    public uint Size, Usage, ProcessId;
    public UIntPtr DefaultHeap;
    public uint ModuleId, Threads, ParentProcessId;
    public int Priority;
    public uint Flags;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string Name;
  }
  private sealed class Row {
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

  private static void Inspect(Row row, long capturedBefore, StringBuilder path) {
    IntPtr handle = OpenProcess(0x1000, false, row.ProcessId);
    // 缺少权限或查询中退出仍保留父关系；不能把身份不明当成退出。
    if (handle == IntPtr.Zero) return;
    try {
      long created, exited, kernel, user;
      if (!Times(handle, out created, out exited, out kernel, out user)
          || created <= 0 || created > capturedBefore) return;
      row.Started = DateTime.FromFileTimeUtc(created).ToString("o", Invariant);
      if (exited != 0) return;
      path.Clear();
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

  private static List<Row> Capture(HashSet<uint> selected) {
    long capturedBefore;
    GetSystemTimePreciseAsFileTime(out capturedBefore);
    IntPtr snapshot = CreateToolhelp32Snapshot(2, 0);
    if (snapshot == new IntPtr(-1)) throw new Win32Exception(Marshal.GetLastWin32Error());
    List<Row> rows = new List<Row>();
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
    if (rows.Count == 0) return rows;
    StringBuilder path = new StringBuilder(32768);
    foreach (Row row in rows) Inspect(row, capturedBefore, path);
    return rows;
  }

  private static void Mark(Stopwatch clock, string stage, string action) {
    if (clock != null) Console.Error.WriteLine("WEAPP_DEV_QUERY_V2|" + stage + "|" + action + "|" + clock.Elapsed.TotalMilliseconds.ToString("F3", Invariant) + "|");
  }

  private static void WriteRows(List<Row> rows) {
    Console.Out.WriteLine(Header);
    foreach (Row row in rows) {
      string encodedPath = "";
      if (row.ExecutablePath != null) {
        string path = row.ExecutablePath;
        // 保留原始 UTF-16 code units，包括非配对 surrogate；不经有损编码器。
        byte[] bytes = new byte[path.Length * 2];
        for (int i = 0; i < path.Length; i++) {
          bytes[i * 2] = (byte)(path[i] & 0xFF);
          bytes[i * 2 + 1] = (byte)(path[i] >> 8);
        }
        encodedPath = Convert.ToBase64String(bytes);
      }
      Console.Out.WriteLine(row.ProcessId.ToString(Invariant) + "\t" + row.ParentProcessId.ToString(Invariant)
        + "\t" + encodedPath + "\t" + row.Started);
    }
    Console.Out.WriteLine(Header + "|" + rows.Count.ToString(Invariant));
  }

  private static int Main(string[] args) {
    try {
      int index = 0;
      Stopwatch clock = args.Length > 0 && args[0] == "--trace" ? Stopwatch.StartNew() : null;
      if (clock != null) index++;
      Mark(clock, "script", "begin");
      Mark(clock, "utf8", "begin");
      Console.OutputEncoding = new UTF8Encoding(false);
      Mark(clock, "utf8", "end");
      HashSet<uint> selected = null;
      if (index >= args.Length) throw new ArgumentException("Expected --all or --pids.");
      string mode = args[index++];
      if (mode == "--pids") {
        selected = new HashSet<uint>();
        while (index < args.Length) {
          uint pid;
          if (!UInt32.TryParse(args[index++], NumberStyles.None, Invariant, out pid) || pid == 0)
            throw new ArgumentException("Expected positive 32-bit PIDs.");
          selected.Add(pid);
        }
      }
      else if (mode != "--all" || index != args.Length) throw new ArgumentException("Invalid query arguments.");
      Mark(clock, "query", "begin");
      List<Row> rows = Capture(selected);
      Mark(clock, "query", "end");
      Mark(clock, "serialize", "begin");
      WriteRows(rows);
      Mark(clock, "serialize", "end");
      Mark(clock, "script", "end");
      return 0;
    }
    catch (Exception error) {
      Console.Error.WriteLine(error);
      return 1;
    }
  }
}
