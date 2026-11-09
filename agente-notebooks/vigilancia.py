"""Consultas de solo lectura y comparacion de cambios observados."""
import json
import os
import re
import subprocess


def ejecutar(argumentos):
    resultado = subprocess.run(argumentos, capture_output=True, timeout=30,
                               creationflags=subprocess.CREATE_NO_WINDOW)
    if resultado.returncode:
        raise OSError("Windows no permitio completar la consulta")
    return resultado.stdout


def consultar_wifi():
    try:
        salida = ejecutar([os.path.join(os.environ.get("SystemRoot", r"C:\Windows"), "System32", "netsh.exe"),
                           "wlan", "show", "interfaces"])
        # SSID es una etiqueta estable; no se consultan perfiles ni contrasenas.
        texto = salida.decode("oem", errors="replace")
        redes = sorted(set(re.findall(r"^\s*SSID\s*:\s*(.*?)\s*$", texto, re.MULTILINE)))
        if not redes:
            return {"ok": False, "redes": [], "detalle": "SSID no disponible: sin conexion Wi-Fi, sin adaptador o acceso restringido por Windows."}
        return {"ok": True, "redes": redes, "detalle": ""}
    except (OSError, subprocess.SubprocessError):
        return {"ok": False, "redes": [], "detalle": "No se pudo consultar el Wi-Fi."}


def consultar_usuarios():
    script = "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; $ErrorActionPreference='Stop'; @(Get-LocalUser | ForEach-Object { @{nombre=$_.Name; sid=$_.SID.Value; habilitado=$_.Enabled} }) | ConvertTo-Json -Compress"
    try:
        salida = ejecutar([os.path.join(os.environ.get("SystemRoot", r"C:\Windows"), "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
                           "-NoProfile", "-NonInteractive", "-Command", script])
        cuentas = json.loads(salida.decode("utf-8-sig"))
        if isinstance(cuentas, dict):
            cuentas = [cuentas]
        if not isinstance(cuentas, list):
            raise ValueError("Respuesta inesperada")
        return {"ok": True, "cuentas": cuentas, "detalle": ""}
    except (OSError, ValueError, subprocess.SubprocessError):
        return {"ok": False, "cuentas": [], "detalle": "No se pudieron consultar las cuentas locales; revisar permisos y Python de 64 bits."}


def consultar_eventos_energia():
    tipos = {12: "inicio", 13: "apagado", 42: "suspension", 107: "reanudacion"}
    powershell = os.path.join(os.environ.get("SystemRoot", r"C:\Windows"), "System32",
                              "WindowsPowerShell", "v1.0", "powershell.exe")
    script = """
    [Console]::OutputEncoding=[System.Text.Encoding]::UTF8
    $filtro = "*[System[(Provider[@Name='Microsoft-Windows-Kernel-General'] and (EventID=12 or EventID=13)) or (Provider[@Name='Microsoft-Windows-Kernel-Power'] and (EventID=42 or EventID=107))]]"
    Get-WinEvent -LogName System -FilterXPath $filtro -MaxEvents 12 -ErrorAction SilentlyContinue |
        ForEach-Object { "$($_.Id)|$($_.TimeCreated.ToUniversalTime().ToString('o'))" }
    """
    try:
        salida = ejecutar([powershell, "-NoProfile", "-NonInteractive", "-Command", script])
        eventos = []
        for linea in salida.decode("utf-8-sig").splitlines():
            codigo, separador, fecha = linea.partition("|")
            if separador and codigo.isdigit() and int(codigo) in tipos:
                eventos.append({"tipo": tipos[int(codigo)], "fecha": fecha})
        return eventos[:12]
    except (OSError, ValueError, subprocess.SubprocessError):
        return []


def detectar_cambios(anterior, actual):
    eventos = []
    # Una consulta fallida nunca sustituye la ultima referencia valida.
    for campo in ("wifi", "usuarios_locales"):
        nuevo = actual.get(campo, {})
        viejo = anterior.get(campo, {})
        if not nuevo.get("ok") or not viejo.get("ok"):
            continue
        if campo == "wifi":
            antes, despues = sorted(viejo["redes"]), sorted(nuevo["redes"])
            if antes != despues:
                eventos.append({"tipo": "wifi_cambiado", "mensaje": "Wi-Fi cambio de " + ", ".join(antes) + " a " + ", ".join(despues)})
        else:
            existentes = {u["sid"] for u in viejo["cuentas"]}
            for cuenta in nuevo["cuentas"]:
                if cuenta["sid"] not in existentes:
                    eventos.append({"tipo": "usuario_nuevo", "mensaje": "Cuenta local nueva observada: " + cuenta["nombre"]})
    return eventos
