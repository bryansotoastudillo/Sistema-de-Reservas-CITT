#requires -Version 5.1
[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$Paquete = $PSScriptRoot,
    [string]$PythonZip
)

$ErrorActionPreference = 'Stop'
$urlPython = 'https://www.python.org/ftp/python/3.15.2/python-3.15.2-embed-amd64.zip'
$hashPython = 'D012F3AA29CF07436DAE8AEA1FEC0FD195C2612A0B059B1F915AE0AFB9AD1F62'
$nombreTarea = 'Administracion Notebooks - agente'
$descripcion = 'Agente institucional de inventario. Administrado por instalar_notebook.ps1.'
$sidAdmins = [Security.Principal.SecurityIdentifier]::new('S-1-5-32-544')
$sidSystem = [Security.Principal.SecurityIdentifier]::new('S-1-5-18')

if ($env:PROCESSOR_ARCHITECTURE -ne 'AMD64') {
    throw 'Esta version del instalador requiere Windows x64 y PowerShell de 64 bits.'
}

$origen = (Resolve-Path -LiteralPath $Paquete).Path
$archivos = @('agente.py', 'vigilancia.py', 'uso_programas.py', 'configuracion.json')
foreach ($archivo in $archivos) {
    if (-not (Test-Path -LiteralPath (Join-Path $origen $archivo) -PathType Leaf)) {
        throw "Falta $archivo. Usa el paquete individual generado por agregar_notebook.py."
    }
}
$config = Get-Content -LiteralPath (Join-Path $origen 'configuracion.json') -Raw | ConvertFrom-Json
$servidor = $config.servidor -as [uri]
$esCitt = $config.ruta_reportes -ceq '/api/notebooks/reportes'
$usaCaLocal = $config.certificado_ca -ceq 'ca.pem'
if (-not $servidor -or -not $servidor.IsAbsoluteUri -or $servidor.Scheme -ne 'https' -or
    $servidor.IsLoopback -or $servidor.UserInfo -or $servidor.Query -or $servidor.Fragment -or
    $servidor.AbsolutePath -ne '/' -or
    (-not $esCitt -and -not $usaCaLocal) -or
    ($config.certificado_ca -and -not $usaCaLocal) -or
    ($config.ruta_reportes -and $config.ruta_reportes -cnotin @('/api/reportes', '/api/notebooks/reportes')) -or
    $config.identificador -isnot [string] -or $config.identificador -notmatch '^[\w-]+$' -or
    $config.clave -isnot [string] -or $config.clave -notmatch '^[A-Za-z0-9_-]{32,}$') {
    throw 'La configuracion no corresponde a un paquete individual HTTPS.'
}
if ($usaCaLocal) {
    if (-not (Test-Path -LiteralPath (Join-Path $origen 'ca.pem') -PathType Leaf)) {
        throw 'Falta ca.pem del paquete individual.'
    }
    $archivos += 'ca.pem'
}
if ($PythonZip) {
    $PythonZip = (Resolve-Path -LiteralPath $PythonZip).Path
    if ((Get-FileHash -LiteralPath $PythonZip -Algorithm SHA256).Hash -ne $hashPython) {
        throw 'El ZIP de Python no coincide con el SHA-256 oficial.'
    }
}

$raiz = Join-Path ([Environment]::GetFolderPath('ProgramFiles')) 'Administracion de Notebooks'
if (-not $PSCmdlet.ShouldProcess($env:COMPUTERNAME, "Instalar agente para $($config.identificador)")) {
    return
}
$identidad = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identidad)
if (-not $principal.IsInRole($sidAdmins)) {
    throw 'Abre PowerShell como administrador.'
}

$bloqueo = [Threading.Mutex]::new($false, 'Global\AdministracionNotebooksInstalacion')
$adquirido = $false
try {
    try { $adquirido = $bloqueo.WaitOne(0) }
    catch [Threading.AbandonedMutexException] { $adquirido = $true }
    if (-not $adquirido) { throw 'Ya hay otra instalacion del agente en curso.' }

    $tarea = Get-ScheduledTask -TaskName $nombreTarea -TaskPath '\' -ErrorAction SilentlyContinue
    if ($tarea -and $tarea.Description -ne $descripcion) {
        throw 'Existe una tarea anterior con ese nombre. Revisa su instalacion antes de migrarla.'
    }

    if (-not (Test-Path -LiteralPath $raiz)) {
        New-Item -ItemType Directory -Path $raiz | Out-Null
        $acl = [Security.AccessControl.DirectorySecurity]::new()
        $acl.SetOwner($sidAdmins)
        $acl.SetAccessRuleProtection($true, $false)
        foreach ($sid in @($sidAdmins, $sidSystem)) {
            $regla = [Security.AccessControl.FileSystemAccessRule]::new(
                $sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'
            )
            $acl.AddAccessRule($regla)
        }
        Set-Acl -LiteralPath $raiz -AclObject $acl
    }

    $directorio = Get-Item -LiteralPath $raiz -Force
    $acl = Get-Acl -LiteralPath $raiz
    $reglas = $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])
    if (-not $directorio.PSIsContainer -or ($directorio.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
        -not $acl.AreAccessRulesProtected -or $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sidAdmins.Value -or
        ($reglas | Where-Object { $_.IdentityReference.Value -notin @($sidAdmins.Value, $sidSystem.Value) })) {
        throw 'La carpeta del agente no tiene los permisos esperados. Debe estar protegida para Administradores y SYSTEM.'
    }

    if ($tarea) {
        $anterior = $tarea.Actions[0].WorkingDirectory
        if (-not $anterior -or [IO.Path]::GetDirectoryName($anterior) -ne $raiz) {
            throw 'La tarea existente apunta a una ubicacion inesperada.'
        }
        $configAnterior = Get-Content -LiteralPath (Join-Path $anterior 'configuracion.json') -Raw | ConvertFrom-Json
        if ($configAnterior.identificador -ne $config.identificador -or $configAnterior.servidor -ne $config.servidor) {
            throw 'Este notebook ya esta asignado a otro paquete o servidor.'
        }
    }

    $version = Join-Path $raiz ('agente-' + [guid]::NewGuid().ToString('N'))
    $runtime = Join-Path $version 'python'
    New-Item -ItemType Directory -Path $version, $runtime | Out-Null
    foreach ($archivo in $archivos) {
        Copy-Item -LiteralPath (Join-Path $origen $archivo) -Destination $version
    }
    $descargadoAqui = -not $PythonZip
    if ($descargadoAqui) {
        $PythonZip = Join-Path $version 'python-descarga.zip'
        Invoke-WebRequest -Uri $urlPython -OutFile $PythonZip -UseBasicParsing
    }
    if ((Get-FileHash -LiteralPath $PythonZip -Algorithm SHA256).Hash -ne $hashPython) {
        throw 'No se pudo verificar la descarga de Python.'
    }
    Expand-Archive -LiteralPath $PythonZip -DestinationPath $runtime
    if ($descargadoAqui) { Remove-Item -LiteralPath $PythonZip }
    Add-Content -LiteralPath (Join-Path $runtime 'python315._pth') -Value '..' -Encoding ASCII
    $python = Join-Path $runtime 'python.exe'
    & $python -B -c 'import agente, ssl, sys; assert sys.maxsize > 2**32'
    if ($LASTEXITCODE -ne 0) { throw 'El entorno de Python no pudo cargar el agente.' }

    $datos = Join-Path $raiz 'datos'
    $scriptAgente = Join-Path $version 'agente.py'
    $argumentos = '-B -u "{0}" --continuo --datos "{1}"' -f $scriptAgente, $datos
    $accion = New-ScheduledTaskAction -Execute $python -Argument $argumentos -WorkingDirectory $version
    $disparador = New-ScheduledTaskTrigger -AtStartup
    $cuenta = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
    $opciones = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew

    $respaldo = if ($tarea) { Export-ScheduledTask -TaskName $nombreTarea -TaskPath '\' }
    try {
        if ($tarea) { Stop-ScheduledTask -TaskName $nombreTarea -TaskPath '\' }
        Register-ScheduledTask -TaskName $nombreTarea -TaskPath '\' -Action $accion -Trigger $disparador -Principal $cuenta -Settings $opciones -Description $descripcion -Force | Out-Null
        Start-ScheduledTask -TaskName $nombreTarea -TaskPath '\'
    } catch {
        if ($respaldo) {
            Register-ScheduledTask -TaskName $nombreTarea -TaskPath '\' -Xml $respaldo -Force | Out-Null
            Start-ScheduledTask -TaskName $nombreTarea -TaskPath '\'
        }
        throw
    }
    [pscustomobject]@{ Equipo = $env:COMPUTERNAME; Estado = 'Tarea instalada e iniciada'; Servidor = $servidor.Authority }
} finally {
    if ($adquirido) { $bloqueo.ReleaseMutex() }
    $bloqueo.Dispose()
}
