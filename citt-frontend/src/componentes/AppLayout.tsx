import React from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import {
  Cpu, Calendar, Package, History, Users, FileText, Settings, LogOut, PieChart, CalendarCheck, Handshake, Box, UserCog, MonitorSmartphone, ClipboardList, PackageOpen,
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
  "/solicitar-reserva": "Reserva de Espacios",
  "/crear-solicitud": "Nueva Solicitud",
  "/historial-espacios": "Historial de Solicitudes",
  "/calendario": "Calendario",
  "/articulos": "Inventario",
  "/notebooks": "Notebooks",
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
  "/notebooks": "Revisa la batería, los programas y el estado de los notebooks vinculados al inventario.",
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

  const email = localStorage.getItem("userEmail") || "Usuario";
  const rolActivo = localStorage.getItem("activeRole") || "";
  const rolesRaw = localStorage.getItem("userRoles");
  const userRoles = rolesRaw ? JSON.parse(rolesRaw) : [];

  const getRolPrincipal = (roles: string[]) => {
    if (roles.includes("ADMIN")) return "Administrador";
    if (roles.includes("DIRECTOR")) return "Director";
    if (roles.includes("COORDINADOR")) return "Coordinador CITT";
    if (roles.includes("DOCENTE")) return "Docente";
    if (roles.includes("AYUDANTE")) return "Ayudante";
    if (roles.includes("ALUMNO")) return "Alumno";
    return "Usuario";
  };

  const rolPrincipal = rolActivo
    ? getRolPrincipal([rolActivo])
    : getRolPrincipal(userRoles);

  //  acceso basados en rolActivo
  const isAdminArea = ["ADMIN", "DIRECTOR", "COORDINADOR"].includes(rolActivo);
  const isStaff = ["AYUDANTE", "DOCENTE", "COORDINADOR", "DIRECTOR"].includes(
    rolActivo,
  );
  const isAyudante = rolActivo === "AYUDANTE";

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
          ...(["DIRECTOR", "COORDINADOR"].includes(rolActivo)
            ? [{ name: "Notebooks", icon: MonitorSmartphone, path: "/notebooks" }]
            : []),
          {
            name: "Espacios",
            icon: MonitorSmartphone,
            path: "/espacios",
          },
        ]
      : []),
  ];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      <aside className="w-64 bg-[#1e1e2d] text-gray-300 flex flex-col shadow-xl z-20">
        <div className="flex items-center gap-2 h-16 px-6 border-b border-gray-800">
          <Cpu className="text-blue-500 w-8 h-8" strokeWidth={2.5} />
          <span className="text-xl font-bold text-white tracking-wide">
            CITT <span className="font-normal text-gray-400">DuocUC</span>
          </span>
        </div>
        <div className="mx-4 mt-6 mb-2 p-3 rounded-lg flex items-center gap-3 transition-colors hover:bg-white/5 cursor-pointer" onClick={() => navigate('/perfil')}>
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white font-semibold text-lg">
              {rolPrincipal.charAt(0).toUpperCase()}
            </div>
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#1e1e2d]"></div>
          </div>
          <div className="flex flex-col overflow-hidden justify-center">
            <span className="text-sm font-medium text-slate-200 truncate capitalize">{rolPrincipal}</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-3 scroll-styled scroll-dark">
          {menuItems.map((item) => {
            const isActive = location.pathname.includes(item.path);
            return (
              <button
                key={item.name}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium cursor-pointer ${
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
            onClick={() => navigate("/perfil")}
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
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-gray-50 min-w-0">
        <main
          className="flex-1 overflow-x-hidden overflow-y-scroll scroll-styled scroll-light relative min-h-0"
          style={{ scrollbarGutter: "stable" }}
        >
          <div className="max-w-[1600px] mx-auto w-full px-8 pt-8 pb-4">
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
      </div>
    </div>
  );
};
