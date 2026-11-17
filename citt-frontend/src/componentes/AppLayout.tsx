import { rolesGestionCitt, rolesPersonalCitt } from "../utils/roles";
import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate, useLocation, Outlet } from "react-router-dom";
import {
  Cpu, Calendar, History, Users, LogOut, PieChart, Box, UserCog, MonitorSmartphone, ClipboardList, PackageOpen, Images, Menu, X,
} from "lucide-react";
import api from "../api/axiosConfig";
import { useSeguridad } from "../hooks/useSeguridad";
import { HeaderBanner } from "./HeaderBanner";

// Nombres  para cada ruta del sistema
const RUTAS_NOMBRES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/perfil": "Mi Perfil",
  "/usuarios": "Gestión de Usuarios",
  "/espacios": "Gestión de Espacios",
  "/contenido-pantalla": "Contenido de pantalla",
  "/solicitar-reserva": "Reserva de Espacios",
  "/regularizar-reserva": "Regularizar reserva",
  "/crear-solicitud": "Nueva Solicitud",
  "/historial-espacios": "Historial de Solicitudes",
  "/calendario": "Calendario",
  "/articulos": "Inventario",
  "/solicitar-prestamo": "Solicitar Artículo",
  "/solicitudes": "Solicitudes",
  "/prestamos": "Préstamos",
  "/configuracion": "Configuración",
  "/reportes": "Reportes",
  "/reservas": "Gestión de Reservas",
  "/historial": "Historial",
};

const RUTAS_DESCRIPCIONES: Record<string, string> = {
  "/dashboard": "Resumen global del estado de inventario y accesos rápidos.",
  "/perfil": "Revisa y actualiza tu información personal.",
  "/usuarios": "Crea cuentas, revisa registros y administra los roles.",
  "/espacios": "Administra los laboratorios y salas disponibles en la sede CITT.",
  "/solicitar-reserva": "Visualiza los laboratorios operativos de la sede y gestiona tus solicitudes de reserva.",
  "/crear-solicitud": "Completa el formulario para solicitar artículos o espacios.",
  "/historial-espacios": "Registro completo de solicitudes finalizadas y artículos devueltos.",
  "/calendario": "Revisa los eventos programados y las reservas de laboratorios.",
  "/articulos": "Administra el inventario de artículos disponibles para préstamo.",
  "/solicitar-prestamo": "Consulta el catálogo y solicita equipos en préstamo.",
  "/solicitudes": "Administra las solicitudes de préstamo y entrega de artículos.",
  "/prestamos": "Revisa el estado de los préstamos activos.",
  "/configuracion": "Configura los parámetros del sistema.",
  "/reportes": "Genera y revisa los reportes estadísticos.",
  "/reservas": "Administra y revisa las reservas de espacios.",
  "/historial": "Revisa el historial de acciones.",
};

interface AppLayoutProps {
  children?: React.ReactNode;
  titulo?: string;
  breadcrumb?: string;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  titulo = "Gestión de Recursos",
  breadcrumb = "CITT DuocUC",
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isVerificando } = useSeguridad();
  const menuMovil = useRef<HTMLDialogElement>(null);
  const contenido = useRef<HTMLElement>(null);
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    menuMovil.current?.close();
    contenido.current?.scrollTo({ top: 0 });
  }, [location.pathname, location.search]);

  useEffect(() => {
    const escritorio = window.matchMedia("(min-width: 64rem)");
    const cerrarSiEscritorio = () => { if (escritorio.matches) menuMovil.current?.close(); };
    escritorio.addEventListener("change", cerrarSiEscritorio);
    return () => escritorio.removeEventListener("change", cerrarSiEscritorio);
  }, []);

  const email = localStorage.getItem("userEmail") || "Usuario";
  const rolActivo = localStorage.getItem("activeRole") || "";
  const rolesRaw = localStorage.getItem("userRoles");
  const userRoles = rolesRaw ? JSON.parse(rolesRaw) : [];

  const getRolPrincipal = (roles: string[]) => {
    if (roles.includes("ADMIN")) return "Administrador";
    if (roles.includes("DIRECTOR")) return "Director";
    if (roles.includes("COORDINADOR")) return "Coordinador CITT";
    if (roles.includes("ADMINISTRATIVO")) return "Administrativo";
    if (roles.includes("DOCENTE")) return "Docente";
    if (roles.includes("AYUDANTE")) return "Ayudante";
    if (roles.includes("ALUMNO")) return "Alumno";
    return "Usuario";
  };

  const rolPrincipal = rolActivo
    ? getRolPrincipal([rolActivo])
    : getRolPrincipal(userRoles);

  //  acceso basados en rolActivo
  const isAdminArea = ["ADMIN", ...rolesGestionCitt].includes(rolActivo);
  const isStaff = rolesPersonalCitt.includes(
    rolActivo,
  );

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Ignoramos errores de red
    } finally {
      localStorage.clear();
      navigate("/");
    }
  };

  if (isVerificando) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const menuItems = [
    // COMUNES A TODOS LOS ROLES
    { name: "Dashboard", icon: PieChart, path: "/dashboard" },
    { name: "Calendario", icon: Calendar, path: "/calendario" },
    {
      name: "Solicitar Artículo",
      icon: PackageOpen,
      path: "/solicitar-prestamo",
    },
    { name: "Solicitudes", icon: ClipboardList, path: "/solicitudes" },
    {
      name: "Reserva de Espacios",
      icon: MonitorSmartphone,
      path: "/solicitar-reserva",
    },


    ...(isStaff
      ? [{ name: "Historial", icon: History, path: "/historial-espacios" }]
      : []),


    ...(isAdminArea
      ? [
          { name: "Usuarios", icon: Users, path: "/usuarios" },
          { name: "Inventario", icon: Box, path: "/articulos" },
          ...(rolesGestionCitt.includes(rolActivo)
            ? [{ name: "Contenido de pantalla", icon: Images, path: "/contenido-pantalla" }]
            : []),
          {
            name: "Espacios",
            icon: MonitorSmartphone,
            path: "/espacios",
          },
        ]
      : []),
  ];

  const accesosMovil = [
    { label: "Inicio", path: "/dashboard", icon: PieChart },
    { label: "Espacios", path: "/solicitar-reserva", icon: MonitorSmartphone },
    { label: "Artículos", path: "/solicitar-prestamo", icon: PackageOpen },
    { label: "Solicitudes", path: "/solicitudes", icon: ClipboardList },
  ];
  const navegar = (ruta: string) => {
    menuMovil.current?.close();
    navigate(ruta);
  };
  const marca = (
    <>
      <Cpu className="size-6 shrink-0 text-blue-500 lg:size-8" aria-hidden="true" strokeWidth={2.5} />
      <span className="text-lg font-bold tracking-wide text-white lg:text-xl">
        CITT <span className="font-normal text-gray-300">DuocUC</span>
      </span>
    </>
  );
  const navegacion = (
    <>
        <Link to="/perfil" onClick={() => menuMovil.current?.close()}
          className="mx-4 mt-4 mb-2 flex items-center gap-3 rounded-lg p-3 hover:bg-white/5 lg:mt-6">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white font-semibold text-lg">
              {rolPrincipal.charAt(0).toUpperCase()}
            </div>
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#1e1e2d]"></div>
          </div>
          <div className="flex flex-col overflow-hidden justify-center">
            <span className="text-sm font-medium text-slate-200 truncate capitalize">{rolPrincipal}</span>
          </div>
        </Link>

        <nav aria-label="Navegación principal" className="min-h-0 flex-1 overflow-y-auto py-2 space-y-1 px-3 scroll-styled scroll-dark lg:py-4">
          {menuItems.map((item) => {
            const isActive = location.pathname.includes(item.path);
            return (
              <button
                key={item.name}
                type="button"
                aria-current={isActive ? "page" : undefined}
                onClick={() => navegar(item.path)}
                className={`w-full min-h-11 flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200 text-sm font-medium cursor-pointer ${
                  isActive
                    ? "bg-blue-600/15 text-blue-400"
                    : "hover:bg-gray-800 hover:text-white text-gray-400"
                }`}
              >
                <item.icon
                  className={`w-5 h-5 ${isActive ? "text-blue-500" : "text-gray-500"}`}
                />
                {item.name}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800 space-y-2">
          <button
            onClick={() => navegar("/perfil")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              location.pathname.includes("/perfil")
                ? "bg-gray-800 text-white"
                : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`}
          >
            <UserCog className="w-5 h-5" />
            Mi Perfil
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            Cerrar Sesión
          </button>
        </div>
    </>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-gray-50 font-sans">
      <aside className="hidden w-64 shrink-0 flex-col bg-[#1e1e2d] text-gray-300 shadow-xl lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-gray-800 px-6">{marca}</div>
        {navegacion}
      </aside>
      <dialog id="menu-movil-citt" ref={menuMovil} aria-label="Menú de navegación"
        onClose={() => setMenuAbierto(false)}
        onClick={event => { if (event.target === event.currentTarget) menuMovil.current?.close(); }}
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(85vw,20rem)] max-w-none bg-[#1e1e2d] p-0 text-gray-300 backdrop:bg-slate-950/55 lg:hidden">
        <div className="flex h-full flex-col">
          <div className="flex min-h-14 items-center justify-between border-b border-gray-800 px-4">
            <div className="flex items-center gap-2">{marca}</div>
            <button type="button" aria-label="Cerrar menú" onClick={() => menuMovil.current?.close()}
              className="grid size-11 place-items-center rounded-lg text-white hover:bg-white/10">
              <X size={22} aria-hidden="true" />
            </button>
          </div>
          {navegacion}
        </div>
      </dialog>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-gray-50 [--barra-citt:calc(4rem_+_env(safe-area-inset-bottom))]">
        <header className="flex min-h-14 shrink-0 items-center justify-between gap-2 bg-[#1e1e2d] px-3 lg:hidden">
          <Link to="/dashboard" className="flex min-h-11 items-center gap-2" aria-label="Inicio CITT">{marca}</Link>
          <button type="button" aria-haspopup="dialog" aria-controls="menu-movil-citt" aria-expanded={menuAbierto}
            onClick={() => {
              menuMovil.current?.showModal();
              setMenuAbierto(true);
            }}
            className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-white hover:bg-white/10">
            <Menu size={22} aria-hidden="true" /> Menú
          </button>
        </header>
        <main
          ref={contenido}
          className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto scroll-styled scroll-light lg:[scrollbar-gutter:stable]"
        >
          <div className="mx-auto w-full max-w-[1600px] px-3 pb-4 pt-4 sm:px-5 lg:px-8 lg:pt-8">
            <HeaderBanner 
              pantallaActual={RUTAS_NOMBRES[location.pathname] || "Sistema CITT"} 
              descripcion={
                location.pathname === "/dashboard" 
                  ? (rolActivo === "ALUMNO" 
                      ? "Utiliza este espacio para revisar los laboratorios disponibles, pedir materiales para tus proyectos o reservar un lugar tranquilo para programar y estudiar con tu equipo." 
                      : (rolActivo === "DOCENTE" || rolActivo === "AYUDANTE")
                        ? "Bienvenido al portal de gestión académica. Desde aquí puedes revisar rápidamente la disponibilidad de los laboratorios, agendar espacios para tus clases o reservar equipamiento."
                        : RUTAS_DESCRIPCIONES[location.pathname])
                  : RUTAS_DESCRIPCIONES[location.pathname] || ""
              }
            />
            {children || <Outlet />}
          </div>
        </main>
        <nav aria-label="Accesos rápidos" className="grid h-[var(--barra-citt)] shrink-0 grid-cols-4 border-t border-slate-200 bg-white px-1 pb-[env(safe-area-inset-bottom)] lg:hidden">
          {accesosMovil.map(({label, path, icon: Icono}) => (
            <NavLink key={path} to={path}
              className={({isActive}) => `flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-semibold ${isActive ? "bg-blue-50 text-blue-800" : "text-slate-700 hover:bg-slate-50"}`}>
              <Icono size={20} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
};
