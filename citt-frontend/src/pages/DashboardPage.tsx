import { rolesGestionCitt } from "../utils/roles";
import React from "react";
import { AdminDashboard } from "../componentes/dashboard/AdminDashboard";
import { StaffDashboard } from "../componentes/dashboard/StaffDashboard";
import { AlumnoDashboard } from "../componentes/dashboard/AlumnoDashboard";
import { FraseDelDia } from "../componentes/dashboard/FraseDelDia";

export const DashboardPage: React.FC = () => {
  const rolActivo = localStorage.getItem("activeRole") || "";
  const rolesRaw = localStorage.getItem("userRoles");
  const userRoles = rolesRaw ? JSON.parse(rolesRaw) : [];

  // Si no hay rol activo por alguna razón, usamos el primer rol de la lista
  const rol = rolActivo || (userRoles.length > 0 ? userRoles[0] : "");

  // Evaluar qué dashboard mostrar
  if (rol === "ADMIN" || rolesGestionCitt.includes(rol)) {
    return (
      <div className="space-y-8 pb-8">
        <AdminDashboard />
        <FraseDelDia />
      </div>
    );
  }

  if (rol === "DOCENTE" || rol === "AYUDANTE") {
    return (
      <div className="space-y-8 pb-8">
        <StaffDashboard />
        <FraseDelDia />
      </div>
    );
  }

  if (rol === "ALUMNO") {
    return (
      <div className="space-y-8 pb-8">
        <AlumnoDashboard />
        <FraseDelDia />
      </div>
    );
  }

  // Fallback si no tiene rol o el rol no coincide
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
      <h2 className="text-2xl font-bold">Bienvenido al Sistema</h2>
      <p>No se pudo determinar tu rol o no tienes permisos asignados.</p>
    </div>
  );
};
