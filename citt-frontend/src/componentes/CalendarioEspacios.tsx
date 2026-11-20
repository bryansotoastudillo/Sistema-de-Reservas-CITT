import React, { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import api from '../api/axiosConfig';
import { useSeguridad } from '../hooks/useSeguridad';
import './CalendarioEspacios.css';

interface CalendarioEventoDTO {
  idSolicitud: number;
  title: string;
  date: string;
  start: string;
  end: string;
  nombreEspacio: string;
  esExclusivo: boolean;
  solicitanteEmail?: string;
  estadoActual?: string;
}

function claseHora(tiempo?: { milliseconds: number }) {
  return Math.floor((tiempo?.milliseconds ?? 0) / 3600000) % 2 === 0
    ? 'citt-hora-clara' : 'citt-hora-sombreada';
}

export const CalendarioEspacios: React.FC = () => {
  const [eventos, setEventos] = useState<any[]>([]);
  const calendario = useRef<FullCalendar>(null);
  const [pantallaCompacta, setPantallaCompacta] = useState(() => window.matchMedia("(max-width: 639px)").matches);
  // Usamos el hook de seguridad por si necesitamos la información, pero el backend ya filtra la información sensible.
  const { isVerificando } = useSeguridad();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const rolActivo = localStorage.getItem("activeRole") || "";
  const isAlumno = rolActivo.toUpperCase() === "ALUMNO";

  useEffect(() => {
    fetchEventos();
  }, []);

  useEffect(() => {
    const pantalla = window.matchMedia("(max-width: 639px)");
    const adaptarVista = () => {
      setPantallaCompacta(pantalla.matches);
      calendario.current?.getApi().changeView("timeGridDay");
    };
    pantalla.addEventListener("change", adaptarVista);
    return () => pantalla.removeEventListener("change", adaptarVista);
  }, []);

  const fetchEventos = async () => {
    try {
      const response = await api.get<CalendarioEventoDTO[]>('/solicitudes/calendario');
      
      const mappedEvents = response.data.map(evento => ({
        id: String(evento.idSolicitud),
        title: `${evento.nombreEspacio} - ${evento.title} ${evento.esExclusivo ? '⭐ (EXCLUSIVO)' : ''}`,
        start: `${evento.date}T${evento.start}`,
        end: `${evento.date}T${evento.end}`,
        backgroundColor: `hsl(${evento.esExclusivo ? 0 : (evento.idSolicitud * 137.508) % 360}, 60%, 93%)`,
        borderColor: `hsl(${evento.esExclusivo ? 0 : (evento.idSolicitud * 137.508) % 360}, 70%, 39%)`,
        textColor: '#172333',
        extendedProps: {
          exclusivo: evento.esExclusivo,
          solicitante: evento.solicitanteEmail,
          estado: evento.estadoActual,
          nombreEspacio: evento.nombreEspacio,
          proposito: evento.title,
          horaInicio: evento.start,
          horaFin: evento.end,
        }
      }));
      setEventos(mappedEvents);
    } catch (error) {
      console.error('Error fetching calendar events', error);
    }
  };

  const handleEventClick = (clickInfo: any) => {
    const props = clickInfo.event.extendedProps;
    setSelectedEvent({
      title: clickInfo.event.title,
      ...props
    });
    setModalOpen(true);
  };

  return (
    <div className="citt-calendario w-full h-full bg-white rounded-2xl shadow-sm p-2 sm:p-5 border border-gray-200">
      
      <div className="calendar-container h-[min(700px,75dvh)] min-h-96 sm:h-[700px] overflow-hidden">
        <FullCalendar
          ref={calendario}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridDay"
          headerToolbar={pantallaCompacta ? { left: "title", center: "", right: "prev,next today" } : {
            left: 'prev,next today',
            center: 'title',
            right: 'timeGridDay,timeGridWeek'
          }}
          buttonText={{
            today: 'Hoy',
            month: 'Mes',
            week: 'Semana',
            day: 'Día',
            list: 'Agenda'
          }}
          slotMinTime="08:00:00"
          slotMaxTime="22:00:00"
          slotDuration="00:30:00"
          slotLabelInterval="01:00:00"
          slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          slotLaneClassNames={({ time }) => claseHora(time)}
          slotLabelClassNames={({ time }) => claseHora(time)}
          nowIndicator={true}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          displayEventEnd={true}
          views={{ timeGridDay: {
            dayHeaders: false,
            titleFormat: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
          } }}
          events={eventos}
          eventClick={handleEventClick}
          height="100%"
          eventClassNames="cursor-pointer"
          eventContent={({ event, timeText }) => <div className="citt-calendario-evento">
            <strong className="citt-calendario-proposito">{event.extendedProps.proposito}</strong>
            <span className="citt-calendario-horario">{timeText}</span>
            <span className="citt-calendario-lugar">{event.extendedProps.nombreEspacio}</span>
            {event.extendedProps.exclusivo && <span className="citt-calendario-exclusivo">Exclusivo</span>}
          </div>}
          allDaySlot={false}
          locale={esLocale}
          slotEventOverlap={false}
        />
      </div>

      {modalOpen && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300">
          <div className="bg-white rounded-2xl p-4 sm:p-8 max-w-lg w-full max-h-[85dvh] overflow-y-auto m-4 shadow-2xl transform transition-all duration-300 scale-100 animate-in fade-in zoom-in-95 border border-gray-100">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-2xl font-bold text-gray-800 break-words flex-1 pr-4">
                {isAlumno ? "Detalles de Reserva" : selectedEvent.proposito}
              </h3>
              <button 
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4 bg-gradient-to-r from-gray-50 to-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shadow-inner">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Espacio Reservado</p>
                  <p className="text-xl font-bold text-gray-800">{selectedEvent.nombreEspacio}</p>
                </div>
              </div>

              <div className={`grid ${!isAlumno ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 shadow-sm transition hover:shadow-md">
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Horario</p>
                  <p className="text-gray-800 font-semibold flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    {selectedEvent.horaInicio.substring(0, 5)} - {selectedEvent.horaFin.substring(0, 5)}
                  </p>
                </div>
                
                {!isAlumno && (
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center transition hover:shadow-md">
                    {selectedEvent.exclusivo ? (
                      <span className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold bg-red-100 text-red-700 shadow-sm">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                        Exclusivo
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold bg-blue-100 text-blue-700 shadow-sm">
                        Normal
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Vista para Roles con más permisos: DOCENTE, AYUDANTE, DIRECTOR, COORDINADOR, ADMIN */}
              {!isAlumno && selectedEvent.solicitante && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-xs font-extrabold text-indigo-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                    Información Adicional
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center bg-indigo-50 p-3.5 rounded-xl border border-indigo-100 shadow-sm">
                      <span className="text-sm text-indigo-900 font-bold">Solicitante</span>
                      <span className="text-sm text-indigo-700 font-medium">{selectedEvent.solicitante}</span>
                    </div>
                    <div className="flex justify-between items-center bg-indigo-50 p-3.5 rounded-xl border border-indigo-100 shadow-sm">
                      <span className="text-sm text-indigo-900 font-bold">Estado Actual</span>
                      <span className="px-3 py-1 text-xs font-black tracking-wide rounded-lg bg-indigo-200 text-indigo-900 shadow-sm">
                        {selectedEvent.estado}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-8">
              <button 
                onClick={() => setModalOpen(false)}
                className="w-full py-3.5 px-4 bg-gray-900 hover:bg-gray-800 text-white font-bold tracking-wide rounded-xl transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 active:scale-95"
              >
                Cerrar Detalles
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
