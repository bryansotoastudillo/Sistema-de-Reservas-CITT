"""Inventario local de Windows. Ejecutar con Python 3, sin dependencias externas."""
import argparse
import ctypes
from ctypes import wintypes
from datetime import datetime
import json
from pathlib import Path
import platform
import socket
import time
import winreg
import ssl
import subprocess
import uuid
import os
from urllib.parse import urlparse
from vigilancia import consultar_eventos_energia, consultar_wifi, consultar_usuarios
from uso_programas import INTERVALO_MUESTRA, RegistroUso
from urllib.request import Request, urlopen
from urllib.error import URLError


class EstadoEnergia(ctypes.Structure):
    _fields_ = [
        ("corriente", wintypes.BYTE),
        ("banderas", wintypes.BYTE),
        ("porcentaje", wintypes.BYTE),
        ("ahorro", wintypes.BYTE),
        ("segundos", wintypes.DWORD),
        ("duracion", wintypes.DWORD),
    ]


def bateria():
    estado = EstadoEnergia()
    consultar = ctypes.WinDLL("kernel32", use_last_error=True).GetSystemPowerStatus
    consultar.argtypes = [ctypes.POINTER(EstadoEnergia)]
    consultar.restype = wintypes.BOOL
    if not consultar(ctypes.byref(estado)):
        raise ctypes.WinError(ctypes.get_last_error())
    sin_bateria = estado.banderas != 255 and bool(estado.banderas & 128)
    return {
        "presente": False if sin_bateria else (None if estado.banderas == 255 else True),
        "porcentaje": None if sin_bateria or estado.porcentaje == 255 else estado.porcentaje,
        "cargador_conectado": None if estado.corriente == 255 else estado.corriente == 1,
    }


def programas():
    ruta = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"
    encontrados = {}
    errores = []
    origenes = [(winreg.HKEY_LOCAL_MACHINE, "equipo", ruta),
                (winreg.HKEY_CURRENT_USER, "usuario_actual", ruta)]
    try:
        for indice in range(winreg.QueryInfoKey(winreg.HKEY_USERS)[0]):
            sid = winreg.EnumKey(winreg.HKEY_USERS, indice)
            if sid.startswith("S-1-5-21-") and not sid.endswith("_Classes"):
                origenes.append((winreg.HKEY_USERS, "perfil_cargado:" + sid, sid + "\\" + ruta))
    except OSError:
        errores.append("No se pudieron enumerar los perfiles de usuario cargados.")
    for raiz, ambito, ruta_usuario in origenes:
        for vista in (winreg.KEY_WOW64_64KEY, winreg.KEY_WOW64_32KEY):
            try:
                with winreg.OpenKey(raiz, ruta_usuario, 0, winreg.KEY_READ | vista) as clave:
                    for indice in range(winreg.QueryInfoKey(clave)[0]):
                        nombre_clave = winreg.EnumKey(clave, indice)
                        try:
                            with winreg.OpenKey(clave, nombre_clave) as entrada:
                                def valor(nombre):
                                    try:
                                        return str(winreg.QueryValueEx(entrada, nombre)[0])
                                    except FileNotFoundError:
                                        return ""
                                nombre = valor("DisplayName").strip()
                                if nombre:
                                    version = valor("DisplayVersion")
                                    editor = valor("Publisher")
                                    encontrados[(nombre.casefold(), version, editor, ambito)] = {
                                        "nombre": nombre, "version": version,
                                        "editor": editor, "ambito": ambito,
                                        "_icono": valor("DisplayIcon"),
                                        "_carpeta": valor("InstallLocation"),
                                        "_componente": valor("SystemComponent"),
                                    }
                        except OSError as error:
                            errores.append(f"No se pudo leer una entrada: {error}")
            except FileNotFoundError:
                pass
            except OSError as error:
                errores.append(f"No se pudo consultar {ambito}: {error}")
    return sorted(encontrados.values(), key=lambda p: p["nombre"].casefold()), errores


def generar_reporte(destino, instalados, errores, registro):
    reporte = {
        "equipo": socket.gethostname(),
        "estado": "encendido",
        "eventos_energia": consultar_eventos_energia(),
        "sistema": platform.platform(),
        "actualizado": datetime.now().astimezone().isoformat(timespec="seconds"),
        "bateria": bateria(),
        "wifi": consultar_wifi(),
        "usuarios_locales": consultar_usuarios(),
        "reporte_id": str(uuid.uuid4()),
        "programas": [{clave: valor for clave, valor in programa.items() if not clave.startswith("_")}
                      for programa in instalados],
        "uso_programas": registro.resumen(),
        "advertencias": errores,
        "alcance": "Registro de Windows: equipo, usuario actual y perfiles cargados accesibles. Puede contener entradas repetidas por ambito. No incluye todos los perfiles cerrados, Microsoft Store ni programas portatiles.",
    }
    destino.parent.mkdir(parents=True, exist_ok=True)
    temporal = destino.with_suffix(".tmp")
    temporal.write_text(json.dumps(reporte, ensure_ascii=False, indent=2), encoding="utf-8")
    temporal.replace(destino)
    energia = reporte["bateria"]
    porcentaje = energia["porcentaje"]
    print(f"Equipo: {reporte['equipo']}")
    print(f"Bateria: {str(porcentaje) + '%' if porcentaje is not None else 'Sin lectura disponible'}")
    print(f"Cargador conectado: {energia['cargador_conectado']}")
    print(f"Programas registrados: {len(instalados)}")
    print(f"Reporte guardado: {destino}")
    return reporte


def peticion_json(config, ruta, datos):
    peticion = Request(config["servidor"].rstrip("/") + ruta,
                       data=json.dumps(datos).encode("utf-8"),
                       headers={"Content-Type": "application/json"},
                       method="POST")
    peticion.add_unredirected_header("Authorization", "Bearer " + config["clave"])
    return peticion


def enviar_ubicacion(config, contexto, respuesta):
    try:
        permiso = json.loads(respuesta.read(4096))
        prestamo = permiso.get("prestamoExterno") if isinstance(permiso, dict) else None
        if type(prestamo) is not int or prestamo <= 0:
            return
        powershell = Path(os.environ["SystemRoot"]) / "System32/WindowsPowerShell/v1.0/powershell.exe"
        resultado = subprocess.run(
            [str(powershell), "-NoProfile", "-NonInteractive", "-File",
             str(Path(__file__).resolve().with_name("ubicacion.ps1"))],
            capture_output=True, timeout=25, creationflags=subprocess.CREATE_NO_WINDOW,
        )
        if resultado.returncode != 0 or not resultado.stdout.strip():
            return
        ubicacion = json.loads(resultado.stdout)
        ubicacion["prestamoExterno"] = prestamo
        peticion = peticion_json(config, "/api/notebooks/ubicacion", ubicacion)
        with urlopen(peticion, timeout=10, context=contexto):
            pass
    except (OSError, ValueError, TypeError, KeyError, subprocess.TimeoutExpired):
        print("No se pudo actualizar la ubicacion del prestamo.")


def enviar(reporte, consultar_posicion=False):
    configuracion = Path(__file__).resolve().parent / "configuracion.json"
    if not configuracion.exists():
        print("Reporte local guardado. Inicia servidor.py para habilitar el envio al panel.")
        return False
    try:
        config = json.loads(configuracion.read_text(encoding="utf-8"))
        url = urlparse(config["servidor"])
        if url.scheme != "https" and not (url.scheme == "http" and url.hostname in ("localhost", "127.0.0.1")):
            raise ValueError("Los envios por red requieren HTTPS")
        contexto = ssl.create_default_context(cafile=str(configuracion.parent / config["certificado_ca"])) if config.get("certificado_ca") else None
        ruta_reportes = config.get("ruta_reportes", "/api/reportes")
        if ruta_reportes not in ("/api/reportes", "/api/notebooks/reportes"):
            raise ValueError("Ruta de reportes invalida")
        cuerpo = reporte
        if ruta_reportes == "/api/notebooks/reportes":
            campos = ("equipo", "estado", "actualizado", "bateria", "eventos_energia", "uso_programas")
            cuerpo = {campo: reporte[campo] for campo in campos if campo in reporte}
            cuerpo["programas"] = [{clave: valor for clave, valor in programa.items()
                                    if clave in ("nombre", "version", "editor")}
                                   for programa in reporte["programas"]]
        peticion = peticion_json(config, ruta_reportes, cuerpo)
        with urlopen(peticion, timeout=10, context=contexto) as respuesta:
            if respuesta.status != 200:
                raise ValueError("Respuesta inesperada")
            if (consultar_posicion and url.scheme == "https" and ruta_reportes == "/api/notebooks/reportes"
                    and (configuracion.parent / "ubicacion-habilitada").is_file()):
                enviar_ubicacion(config, contexto, respuesta)
        print("Reporte enviado al panel.")
        return True
    except (OSError, URLError, ValueError, KeyError):
        print("No se pudo enviar al panel. Los reportes pendientes quedan guardados y se reenviaran al recuperar la conexion.")
        return False


def guardar_y_enviar(reporte, pendientes):
    pendientes.mkdir(exist_ok=True)
    actual = pendientes / (str(time.time_ns()) + ".json")
    actual.write_text(json.dumps(reporte, ensure_ascii=False), encoding="utf-8")
    for archivo in sorted(pendientes.glob("*.json")):
        if not enviar(json.loads(archivo.read_text(encoding="utf-8")), consultar_posicion=archivo == actual):
            break
        archivo.unlink()


def main():
    parser = argparse.ArgumentParser(description="Consulta bateria e inventario local de Windows")
    parser.add_argument("--continuo", action="store_true", help="Repetir cada cinco minutos")
    parser.add_argument("--datos", type=Path, help="Carpeta de datos persistentes")
    args = parser.parse_args()
    datos = args.datos or Path(__file__).resolve().parent / "datos"
    destino = datos / "reporte.json"
    registro = RegistroUso(destino.parent / "uso_programas.json")
    try:
        while True:
            instalados, errores = programas()
            registro.actualizar_programas(instalados)
            registro.observar()
            siguiente = time.monotonic() + 300
            reporte = generar_reporte(destino, instalados, errores, registro)
            guardar_y_enviar(reporte, destino.parent / "pendientes")
            if not args.continuo:
                return
            while True:
                restante = siguiente - time.monotonic()
                if restante <= INTERVALO_MUESTRA:
                    time.sleep(max(0, restante))
                    break
                time.sleep(INTERVALO_MUESTRA)
                registro.observar()
    except KeyboardInterrupt:
        print("Consulta detenida.")


if __name__ == "__main__":
    main()
