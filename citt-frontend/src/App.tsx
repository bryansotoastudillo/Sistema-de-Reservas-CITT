import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './componentes/AppLayout';
import LoginPage from './pages/LoginPage';
import PerfilPage from './pages/perfilPage';
import UsuariosPage from './pages/UsuariosPage';
import EspaciosPage from "./pages/EspaciosPage";
import { SolicitarReservaPage } from "./pages/SolicitarReservaPage";
import { FormularioSolicitudPage } from "./pages/FormularioSolicitudPage";
import { HistorialPage } from "./pages/HistorialPage";
import { CalendarioPage } from "./pages/CalendarioPage";
import { DashboardPage } from "./pages/DashboardPage";
import { NotebooksPage } from "./pages/NotebooksPage";

// Páginas de la rama articulos
import { ArticulosPage } from "./pages/ArticulosPage";
import { SolicitarPrestamoPage } from "./pages/SolicitarPrestamoPage";
import { SolicitudesPage } from "./pages/SolicitudesPage";
import SessionTimeout from "./componentes/sessionTimeout";

function App() {
  return (
    <BrowserRouter>
      <SessionTimeout />
      <Routes>
        <Route path="/" element={<LoginPage />} />

        {/* RUTAS PRIVADAS (Con el menú lateral) */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/perfil" element={<PerfilPage />} />
          <Route path="/usuarios" element={<UsuariosPage />} />
          <Route path="/espacios" element={<EspaciosPage />} />
          <Route path="/solicitar-reserva" element={<SolicitarReservaPage />} />
          <Route path="/crear-solicitud" element={<FormularioSolicitudPage />} />
          <Route path="/historial-espacios" element={<HistorialPage />} />
          <Route path="/calendario" element={<CalendarioPage />} />
          <Route path="/articulos" element={<ArticulosPage />} />
          <Route path="/notebooks" element={<NotebooksPage />} />
          <Route path="/solicitar-prestamo" element={<SolicitarPrestamoPage />} />
          <Route path="/solicitudes" element={<SolicitudesPage />} />
          
          {/* Rutas en desarrollo para evitar redirecciones al login */}
          <Route path="/prestamos" element={<PerfilPage />} />
          <Route path="/configuracion" element={<PerfilPage />} />
          <Route path="/reportes" element={<PerfilPage />} />
          <Route path="/historial" element={<HistorialPage />} />
          <Route path="/reservas" element={<SolicitudesPage />} />
        </Route>

        {/* COMODÍN */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
