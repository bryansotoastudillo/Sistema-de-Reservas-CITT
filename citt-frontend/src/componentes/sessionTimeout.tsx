import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Modal from './Modal';
import Boton from './Boton';
import { AlertTriangle } from 'lucide-react';
import api from '../api/axiosConfig';

// TIEMPO ORIGINAL - ESTE DE DEBE QUEDAR!!
const WARNING_TIME = 25 * 60 * 1000; // 25 minutos
const LOGOUT_TIME = 30 * 60 * 1000; // 30 minutos

// PARA PRUEBAS
// const WARNING_TIME = 5 * 1000; // 5 segundos
// const LOGOUT_TIME = 10 * 1000; // 10 segundos


const SessionTimeout: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const lastActivityTime = useRef<number>(Date.now());
  const warningOpen = useRef(false);
  const loggingOut = useRef(false);
  // Si estamos en la página de login, no registramos inactividad ni forzamos cierre
  const isExcludedPage = location.pathname === '/' || location.pathname === '/login';
  const resetActivity = useCallback(() => {
    if (isExcludedPage) return;
    lastActivityTime.current = Date.now();

    warningOpen.current = false;
    setShowModal(false);
  }, [isExcludedPage]);
  const handleLogout = useCallback(async () => {
    if (loggingOut.current) return;
    loggingOut.current = true;
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error("Error al cerrar sesión por inactividad", error);
    } finally {
      // Independientemente de si la API falló (ej: token ya expirado), limpiamos y redirigimos
      localStorage.clear();
      navigate('/');
    }
  }, [navigate]);
  useEffect(() => {
    warningOpen.current = false;
    loggingOut.current = false;
    setShowModal(false);
    if (isExcludedPage) {
      return;
    }
    // Inicializar el tiempo de actividad al entrar a una página protegida
    lastActivityTime.current = Date.now();
    // Eventos a escuchar para resetear el temporizador
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    // Con el aviso abierto, solo sus controles confirman que se desea continuar.
    const registerActivity = () => {
      if (!warningOpen.current && !loggingOut.current) resetActivity();
    };
    events.forEach((event) => window.addEventListener(event, registerActivity));
    // Revisar inactividad cada 10 segundos
    const timerInterval = window.setInterval(() => {
      const currentTime = Date.now();
      const inactiveDuration = currentTime - lastActivityTime.current;
      if (inactiveDuration >= LOGOUT_TIME) {
        handleLogout();
      } else if (inactiveDuration >= WARNING_TIME && !warningOpen.current) {
        warningOpen.current = true;
        setShowModal(true);
      }
    }, 10000); // cambiar a 1000 si se quiere probar con el tiempo de pruebas de lo contrario SIEMPRE DEJAR EN 10000
    return () => {
      events.forEach((event) => window.removeEventListener(event, registerActivity));
      window.clearInterval(timerInterval);
    };
  }, [isExcludedPage, resetActivity, handleLogout]);
  return (
    <Modal
      isOpen={showModal}
      onClose={resetActivity}
      titulo="¿Sigues ahí?"
      icono={<AlertTriangle className="text-warning" />}
    >
      <p className="text-gray-600 mb-6">
        Por seguridad, tu sesión se cerrará automáticamente en unos minutos debido a inactividad. ¿Deseas continuar navegando?
      </p>
      <div className="flex justify-center">
        <Boton variante="primario" bloque onClick={resetActivity}>
          Seguir navegando
        </Boton>
      </div>
    </Modal>
  );
};
export default SessionTimeout;
