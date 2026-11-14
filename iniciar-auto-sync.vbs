Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strPath = fso.GetParentFolderName(WScript.ScriptFullName)

' Verificar si ya existe PID
pidFile = strPath & "\.auto-sync.pid"
If fso.FileExists(pidFile) Then
    On Error Resume Next
    Set ts = fso.OpenTextFile(pidFile, 1)
    strPid = Trim(ts.ReadLine())
    ts.Close
    On Error GoTo 0
    If strPid <> "" Then
        ' Verificar si el proceso est? corriendo
        Set objWMIService = GetObject("winmgmts:\\.\root\cimv2")
        Set colProcesses = objWMIService.ExecQuery("Select * from Win32_Process Where ProcessId = " & strPid)
        If colProcesses.Count > 0 Then
            WScript.Quit
        End If
    End If
End If

cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & strPath & "\auto-sync-watcher.ps1"""
WshShell.Run cmd, 0, False
