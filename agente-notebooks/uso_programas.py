"""Observa ejecutables de programas instalados sin registrar sesiones de usuario."""
from datetime import datetime
import json
import ntpath
import os
import re
import subprocess

from vigilancia import ejecutar

INTERVALO_MUESTRA = 30
DIAS_INACTIVO = 30


def ruta_normalizada(valor):
    ruta = ntpath.normcase(ntpath.normpath(os.path.expandvars(valor.strip().strip('"'))))
    return ruta if ntpath.isabs(ruta) else ""


def ruta_instalador(ruta):
    nombre = ntpath.basename(ruta)
    return ("\\package cache\\" in ruta or "\\windows\\installer\\" in ruta
            or nombre.startswith(("unins", "vc_redist")) or nombre in {"setup.exe", "install.exe"})


def consultar_ejecutables():
    powershell = os.path.join(os.environ.get("SystemRoot", r"C:\Windows"),
                              "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
    # Excluye el agente y su consulta para no registrar su propia actividad.
    consulta = (
        "[Console]::OutputEncoding=[Text.Encoding]::UTF8; "
        f"Get-Process | Where-Object {{ $_.Id -ne $PID -and $_.Id -ne {os.getpid()} }} "
        "| ForEach-Object { $_.Path }"
    )
    try:
        salida = ejecutar([powershell, "-NoProfile", "-NonInteractive", "-Command", consulta])
        rutas = {ruta_normalizada(ruta) for ruta in salida.decode("utf-8-sig").splitlines()}
        return {ruta for ruta in rutas if ruta.endswith(".exe")} or None
    except (OSError, UnicodeError, subprocess.SubprocessError):
        return None


def referencias(instalados):
    programas = {}
    for programa in instalados:
        nombre = programa["nombre"]
        clave = nombre.casefold()
        entrada = programas.setdefault(clave, {"nombre": nombre, "ejecutables": set(), "carpetas": set()})
        if programa.get("_componente") == "1":
            continue
        icono = re.sub(r",\s*-?\d+\s*$", "", programa.get("_icono", ""))
        ejecutable = ruta_normalizada(icono)
        if ejecutable.endswith(".exe") and not ruta_instalador(ejecutable):
            entrada["ejecutables"].add(ejecutable)
        carpeta = ruta_normalizada(programa.get("_carpeta", ""))
        if carpeta and not ruta_instalador(carpeta + "\\") and len(ntpath.splitdrive(carpeta)[1].strip("\\").split("\\")) >= 2:
            entrada["carpetas"].add(carpeta.rstrip("\\") + "\\")
    return programas


def asociar(ejecutables, programas):
    detectados = set()
    for ruta in ejecutables:
        if ruta_instalador(ruta):
            continue
        exactos = [clave for clave, app in programas.items() if ruta in app["ejecutables"]]
        if exactos:
            if len(exactos) == 1:
                detectados.add(exactos[0])
            continue
        coincidencias = [(len(carpeta), clave) for clave, app in programas.items()
                         for carpeta in app["carpetas"] if ruta.startswith(carpeta)]
        if coincidencias:
            longitud = max(largo for largo, _ in coincidencias)
            candidatos = {clave for largo, clave in coincidencias if largo == longitud}
            if len(candidatos) == 1:
                detectados.update(candidatos)
    return detectados


class RegistroUso:
    def __init__(self, archivo):
        self.archivo = archivo
        try:
            self.historial = json.loads(archivo.read_text(encoding="utf-8"))
        except (FileNotFoundError, ValueError):
            self.historial = {}
        self.programas = {}
        self.detectados = set()
        self.consulta_correcta = False

    def actualizar_programas(self, instalados):
        self.programas = referencias(instalados)

    def observar(self):
        ejecutables = consultar_ejecutables()
        self.consulta_correcta = ejecutables is not None
        if ejecutables is None:
            return
        ahora = datetime.now().astimezone()
        dia = ahora.date().isoformat()
        self.detectados = asociar(ejecutables, self.programas)
        cambio = False
        for clave, programa in self.programas.items():
            if not (programa["ejecutables"] or programa["carpetas"]):
                continue
            datos = self.historial.setdefault(clave, {
                "ultima_ejecucion": None, "dias_sin_ejecucion": 0, "ultimo_dia": ""
            })
            if clave in self.detectados:
                datos.update(ultima_ejecucion=ahora.isoformat(timespec="seconds"),
                             dias_sin_ejecucion=0, ultimo_dia=dia)
                cambio = True
            elif dia > datos["ultimo_dia"]:
                datos["dias_sin_ejecucion"] = min(DIAS_INACTIVO, datos["dias_sin_ejecucion"] + 1)
                datos["ultimo_dia"] = dia
                cambio = True
        if cambio:
            self.archivo.parent.mkdir(parents=True, exist_ok=True)
            temporal = self.archivo.with_suffix(".tmp")
            temporal.write_text(json.dumps(self.historial, ensure_ascii=False), encoding="utf-8")
            temporal.replace(self.archivo)

    def resumen(self):
        return [
            {
                "nombre": programa["nombre"],
                "identificable": bool(programa["ejecutables"] or programa["carpetas"]),
                "ejecutandose": clave in self.detectados if self.consulta_correcta else None,
                "ultima_ejecucion": self.historial.get(clave, {}).get("ultima_ejecucion"),
                "dias_sin_ejecucion": self.historial.get(clave, {}).get("dias_sin_ejecucion", 0),
            }
            for clave, programa in self.programas.items()
        ]
