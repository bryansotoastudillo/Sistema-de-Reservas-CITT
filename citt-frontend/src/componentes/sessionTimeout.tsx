import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Boton from './Boton';
import { AlertTriangle, X } from 'lucide-react';
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
  const warningDeadline = useRef<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const loggingOut = useRef(false);
  // Si estamos en la página de login, no registramos inactividad ni forzamos cierre
  const isExcludedPage = location.pathname === '/' || location.pathname === '/login';
  const resetActivity = useCallback(() => {
    if (isExcludedPage) return;
    lastActivityTime.current = Date.now();

    warningOpen.current = false;
    warningDeadline.current = null;
    setShowModal(false);
  }, [isExcludedPage]);
  const handleLogout = useCallback(async () => {
    if (loggingOut.current) return;
    loggingOut.current = true;
    setShowModal(false);
    try {
      await api.post('/auth/logout', undefined, { timeout: 10000 });
    } catch (error) {
      console.error("Error al cerrar sesión por inactividad", error);
    } finally {
      // Independientemente de si la API falló (ej: token ya expirado), limpiamos y redirigimos
      localStorage.clear();
      navigate('/', { replace: true });
    }
  }, [navigate]);
  useEffect(() => {
    if (showModal) {
      if (!dialog.current?.open) dialog.current?.showModal();
    } else {
      dialog.current?.close();
    }
  }, [showModal]);
  useEffect(() => {
    warningOpen.current = false;
    warningDeadline.current = null;
    loggingOut.current = false;
    setShowModal(false);
    if (isExcludedPage) {
      return;
    }
    // Inicializar el tiempo de actividad al entrar a una página protegida
    lastActivityTime.current = Date.now();
    // Eventos a escuchar para resetear el temporizador
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    const checkInactivity = () => {
      if (document.hidden || loggingOut.current) return;
      const now = Date.now();
      if (warningOpen.current) {
        if (warningDeadline.current !== null && now >= warningDeadline.current) void handleLogout();
      } else if (now - lastActivityTime.current >= WARNING_TIME) {
        // Incluso al volver de una pestaña suspendida, mostrar el aviso antes de cerrar.
        warningDeadline.current = now + (LOGOUT_TIME - WARNING_TIME);
        warningOpen.current = true;
        setShowModal(true);
      }
    };
    // Con el aviso abierto, solo sus controles confirman que se desea continuar.
    const registerActivity = () => {
      checkInactivity();
      if (!warningOpen.current && !loggingOut.current) resetActivity();
    };
    events.forEach((event) => window.addEventListener(event, registerActivity));
    // Revisar inactividad cada 10 segundos
    const timerInterval = window.setInterval(checkInactivity, 10000);
    document.addEventListener('visibilitychange', checkInactivity);
    window.addEventListener('focus', checkInactivity);
    return () => {
      events.forEach((event) => window.removeEventListener(event, registerActivity));
      window.clearInterval(timerInterval);
      document.removeEventListener('visibilitychange', checkInactivity);
      window.removeEventListener('focus', checkInactivity);
    };
  }, [isExcludedPage, resetActivity, handleLogout]);
  return (
    <dialog ref={dialog} aria-labelledby="aviso-inactividad-titulo" aria-describedby="aviso-inactividad-texto"
      onCancel={event => { event.preventDefault(); void handleLogout(); }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-lg overflow-y-auto rounded-xl bg-white p-0 shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 sm:px-6">
        <h3 id="aviso-inactividad-titulo" className="m-0 flex items-center gap-2 text-xl">
          <AlertTriangle className="text-warning" aria-hidden="true" /> ¿Sigues ahí?
        </h3>
        <button type="button" aria-label="Cerrar sesión" onClick={() => void handleLogout()}
          className="grid size-11 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-100">
          <X size={24} aria-hidden="true" />
        </button>
      </div>
      <div className="p-4 sm:p-6">
      <p id="aviso-inactividad-texto" className="text-gray-600 mb-6">
        Por seguridad, tu sesión se cerrará automáticamente en unos minutos debido a inactividad. ¿Deseas continuar navegando?
      </p>
      <p className="mb-4 text-sm text-gray-600">Pulsa «Seguir navegando» para continuar o la X para cerrar sesión.</p>
      <div className="flex justify-center">
        <Boton autoFocus variante="primario" bloque onClick={resetActivity}>
          Seguir navegando
        </Boton>
      </div>
      </div>
    </dialog>
  );
};
export default SessionTimeout;
