import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../componentes/AppLayout';
import { Cpu, Users, UserPlus, LogOut, AlertCircle, CheckCircle, Edit, Trash2, Search, Shield } from 'lucide-react';
import Boton from '../componentes/Boton';
import InputForm from '../componentes/InputForm';
import SessionTimeout from '../componentes/sessionTimeout';
import Modal from '../componentes/Modal';
import api from '../api/axiosConfig';
import { isAxiosError } from 'axios';

const TODOS_LOS_ROLES = ['ALUMNO', 'DOCENTE', 'AYUDANTE', 'COORDINADOR', 'DIRECTOR'];

interface UsuarioData {
  id: number;
  email: string;
  roles: string[];
  habilitado?: boolean;
}

const UsuariosPage = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState<{ email: string; roles: string[] } | null>(null);
  const [accesoDenegado, setAccesoDenegado] = useState(false);
  const [rolActivoActual, setRolActivoActual] = useState('');

  // Estados del listado de usuarios
  const [usuarios, setUsuarios] = useState<UsuarioData[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  // Estados del formulario de registro
  const [emailNuevo, setEmailNuevo] = useState('');
  const [rolesSeleccionados, setRolesSeleccionados] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [emailError, setEmailError] = useState('');

  // Estados del modal de edición
  const [showEditModal, setShowEditModal] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState<UsuarioData | null>(null);
  const [rolesEdicion, setRolesEdicion] = useState<string[]>([]);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [usuarioEstado, setUsuarioEstado] = useState<UsuarioData | null>(null);
  const [guardandoEstado, setGuardandoEstado] = useState(false);
  const [errorEstado, setErrorEstado] = useState('');
  const esDirector = rolActivoActual === 'DIRECTOR';
  const rolesGestionables = TODOS_LOS_ROLES.filter(rol => esDirector || rol !== 'DIRECTOR');


  useEffect(() => {
    const fetchPerfilYUsuarios = async () => {
      try {
        const response = await api.get('/auth/perfil');
        setUserData(response.data);

        // SEGURIDAD: Validar que el rol guardado en localStorage
        // realmente pertenece a los roles que el SERVIDOR devolvió.
        // Si alguien manipuló el localStorage, este check lo detecta.
        const savedRole = localStorage.getItem('activeRole') || '';
        const rolesDelServidor: string[] = response.data.roles || [];
        const activeRole = rolesDelServidor.includes(savedRole)
          ? savedRole
          : (rolesDelServidor[0] || '');

        // Sincronizar localStorage con el valor validado
        localStorage.setItem('activeRole', activeRole);
        setRolActivoActual(activeRole);

        if (activeRole !== 'DIRECTOR' && activeRole !== 'COORDINADOR') {
          setAccesoDenegado(true);
          return;
        }

        // Si tiene permiso, la lista se cargará con el useEffect de currentPage
      } catch (error) {
        navigate('/');
      }
    };
    fetchPerfilYUsuarios();
  }, [navigate]);

  const cargarUsuarios = async (page = currentPage, search = busqueda) => {
    try {
      const response = await api.get(`/usuarios?page=${page}&size=10&buscar=${search}`);
      setUsuarios(response.data.content || []);
      setTotalPages(response.data.totalPages || 0);
      setTotalElements(response.data.totalElements || 0);
    } catch (error) {
      console.error('Error al cargar usuarios', error);
    }
  };

  // Efecto para buscar y paginar (se ejecuta cuando cambia la página o la búsqueda)
  useEffect(() => {
    if (userData && !accesoDenegado) {
      const delaySearch = setTimeout(() => {
        cargarUsuarios(currentPage, busqueda);
      }, 300); // Pequeño delay para no saturar al escribir rápido
      return () => clearTimeout(delaySearch);
    }
  }, [currentPage, busqueda, userData, accesoDenegado]);

  // Maneja la selección múltiple de roles como "cajas chequeables" para registro
  const handleToggleRol = (rol: string) => {
    setRolesSeleccionados(prev =>
      prev.includes(rol) ? prev.filter(r => r !== rol) : [...prev, rol]
    );
  };

  // Maneja la selección de roles en el modal de edición
  const handleToggleRolEdicion = (rol: string) => {
    setRolesEdicion(prev =>
      prev.includes(rol) ? prev.filter(r => r !== rol) : [...prev, rol]
    );
  };

  const handleRegistrarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(''); // Limpiar errores visuales previos
    setErrorMsg('');
    setSuccessMsg('');

    // validaciones
    if (!emailNuevo.trim()) {
      setEmailError('El correo institucional es obligatorio.');
      return;
    }
    if (!emailNuevo.includes('@') || !emailNuevo.split('@')[1]) {
      setEmailError('La dirección de correo está incompleta.');
      return;
    }
    if (rolesSeleccionados.length === 0) {
      setErrorMsg('Debe seleccionar al menos un rol para el usuario.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.post('/auth/registro', {
        email: emailNuevo.trim().toLowerCase(),
        rolesNombres: rolesSeleccionados
      });
      setSuccessMsg(response.data.mensaje || '¡Usuario registrado con éxito! Se le enviará un correo con la clave provisoria.');
      setEmailNuevo('');
      setRolesSeleccionados([]);
      cargarUsuarios(); // Recargar la lista
    } catch (error: any) {
      const msgError = error.response?.data?.mensaje || 'Error al registrar el usuario. Verifique los datos e intente nuevamente.';

      if (msgError.toLowerCase().includes('correo') || msgError.toLowerCase().includes('institución') || msgError.toLowerCase().includes('permiten')) {
        setEmailError(msgError);
      } else {
        setErrorMsg(msgError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const abrirModalEdicion = (usuario: UsuarioData) => {
    setUsuarioEditando(usuario);
    setRolesEdicion(usuario.roles);
    setEditError('');
    setShowEditModal(true);
  };

  const handleGuardarEdicion = async () => {
    if (!usuarioEditando) return;
    if (rolesEdicion.length === 0) {
      setEditError('Debe seleccionar al menos un rol.');
      return;
    }

    setIsEditLoading(true);
    setEditError('');

    try {
      await api.put(`/usuarios/${usuarioEditando.id}`, {
        email: usuarioEditando.email,
        rolesNombres: rolesEdicion
      });
      setShowEditModal(false);
      cargarUsuarios(); // Recargar la lista para reflejar los cambios
      setSuccessMsg(`Roles de ${usuarioEditando.email} actualizados correctamente.`);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (error: any) {
      setEditError(error.response?.data?.mensaje || 'Error al actualizar los roles.');
    } finally {
      setIsEditLoading(false);
    }
  };


  const cambiarEstado = async () => {
    if (!usuarioEstado || guardandoEstado) return;
    setGuardandoEstado(true);
    setErrorEstado('');
    try {
      const { data } = await api.patch<UsuarioData>(`/usuarios/${usuarioEstado.id}/estado`, {
        habilitado: usuarioEstado.habilitado === false,
      });
      setUsuarios(actuales => actuales.map(usuario => usuario.id === data.id ? data : usuario));
      setSuccessMsg(`Cuenta ${data.habilitado ? 'habilitada' : 'deshabilitada'} correctamente.`);
      setUsuarioEstado(null);
    } catch (error) {
      setErrorEstado(isAxiosError(error) ? error.response?.data?.mensaje || 'No se pudo actualizar la cuenta.'
        : 'No se pudo actualizar la cuenta.');
    } finally {
      setGuardandoEstado(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('activeRole');
      navigate('/');
    }
  };

  if (!userData) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  if (accesoDenegado) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-200 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-10 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 max-w-lg w-full flex flex-col items-center">
          <div className="w-20 h-20 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-6 shadow-inner">
            <Shield size={40} />
          </div>
          <h1 className="text-3xl font-black text-slate-800 mb-2 tracking-tight">Acceso Restringido</h1>
          <p className="text-slate-500 font-medium mb-8 leading-relaxed">
            Actualmente estás navegando con el rol <span className="font-bold text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded-md">{rolActivoActual}</span>. Esta sección es exclusiva para administradores.
          </p>

          <button
            onClick={() => navigate('/perfil')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md shadow-blue-200 active:scale-95 flex items-center justify-center gap-2 mt-2"
          >
            <Cpu size={18} /> Ir a mi Perfil
          </button>
        </div>
      </div>
    );
  }

  return (
    <>


      <SessionTimeout />

      <Modal isOpen={usuarioEstado !== null} onClose={() => !guardandoEstado && setUsuarioEstado(null)}
        titulo={usuarioEstado?.habilitado === false ? "Habilitar cuenta" : "Deshabilitar cuenta"}
        icono={<Shield size={20} />}>
        {usuarioEstado && <div className="space-y-4">
          <p className="break-all font-semibold">{usuarioEstado.email}</p>
          <p className="text-sm text-slate-600">{usuarioEstado.habilitado === false
            ? "La cuenta podrá volver a iniciar sesión."
            : "La cuenta perderá el acceso y sus sesiones se invalidarán. Sus solicitudes quedarán guardadas."}</p>
          {errorEstado && <p role="alert" className="text-sm text-red-700">{errorEstado}</p>}
          <div className="flex flex-wrap gap-3">
            <Boton variante="primario" disabled={guardandoEstado} onClick={cambiarEstado}>
              {guardandoEstado ? "Guardando…" : usuarioEstado.habilitado === false ? "Habilitar cuenta" : "Deshabilitar cuenta"}
            </Boton>
            <button type="button" disabled={guardandoEstado} onClick={() => setUsuarioEstado(null)}
              className="rounded-xl border border-slate-200 px-4 py-2 font-semibold">Cancelar</button>
          </div>
        </div>}
      </Modal>

      {/* Modal de Edición de Roles */}
      <Modal
        isOpen={showEditModal}
        onClose={() => !isEditLoading && setShowEditModal(false)}
        titulo="Editar Roles de Usuario"
        icono={<Shield size={20} />}
      >
        {usuarioEditando && (
          <div>
            <p className="text-gray-500 text-sm mb-6 text-center">
              Modificando roles para: <span className="font-bold text-slate-800">{usuarioEditando.email}</span>
            </p>

            {editError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl text-sm flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <p>{editError}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-6">
              {rolesGestionables.map(rol => {
                const seleccionado = rolesEdicion.includes(rol);
                return (
                  <div
                    key={rol}
                    onClick={() => handleToggleRolEdicion(rol)}
                    className={`p-3 rounded-xl border-2 cursor-pointer flex items-center gap-2 transition-all duration-200 active:scale-95 select-none
                      ${seleccionado
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:bg-slate-50'}`}
                  >
                    <div className={`flex items-center justify-center w-4 h-4 rounded border ${seleccionado ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}`}>
                      {seleccionado && <CheckCircle size={12} />}
                    </div>
                    <span className="font-bold text-xs">{rol}</span>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3">
              <Boton variante="primario" bloque onClick={handleGuardarEdicion} disabled={isEditLoading}>
                {isEditLoading ? 'Guardando...' : 'Guardar Cambios'}
              </Boton>
              <button
                onClick={() => setShowEditModal(false)}
                disabled={isEditLoading}
                className="px-6 py-2 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </Modal>


      <div className="max-w-6xl mx-auto px-6 py-10">



        {/* MENSAJES GLOBALES */}
        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700 rounded-2xl text-sm flex items-start gap-3 shadow-sm">
            <AlertCircle size={20} className="shrink-0 mt-0.5 text-red-500" />
            <p className="font-medium text-left leading-relaxed">{errorMsg}</p>
          </div>
        )}
        {successMsg && (
          <div className="mb-6 p-4 bg-green-50 border border-green-100 text-green-700 rounded-2xl text-sm flex items-start gap-3 shadow-sm">
            <CheckCircle size={20} className="shrink-0 mt-0.5 text-green-500" />
            <p className="font-medium text-left leading-relaxed">{successMsg}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* PANEL IZQUIERDO: FORMULARIO DE REGISTRO */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50">
              <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="p-2 bg-slate-100 rounded-lg text-slate-600"><UserPlus size={20}/></div>
                Registrar Usuario
              </h3>

              <form onSubmit={handleRegistrarUsuario} className="space-y-6">
                <div>
                  <InputForm
                    label="Correo Institucional"
                    type="email"
                    placeholder="ejemplo@duoc.cl"
                    value={emailNuevo}
                    onChange={(e) => setEmailNuevo(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-3">Roles (Selección múltiple)</label>
                  <div className="grid grid-cols-2 gap-2">
                    {rolesGestionables.map(rol => {
                      const seleccionado = rolesSeleccionados.includes(rol);
                      return (
                        <div
                          key={rol}
                          onClick={() => handleToggleRol(rol)}
                          className={`p-2.5 rounded-xl border-2 cursor-pointer flex items-center gap-2 transition-all duration-200 active:scale-95 select-none
                            ${seleccionado
                              ? 'border-blue-600 bg-blue-50 text-blue-700'
                              : 'border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:bg-slate-50'}`}
                        >
                          <div className={`flex items-center justify-center w-4 h-4 rounded border ${seleccionado ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}`}>
                            {seleccionado && <CheckCircle size={12} />}
                          </div>
                          <span className="font-bold text-xs truncate" title={rol}>{rol}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <Boton type="submit" variante="primario" bloque disabled={isLoading}>
                    {isLoading ? 'Registrando...' : 'Crear Cuenta'}
                  </Boton>
                </div>
              </form>
            </div>
          </div>

          {/* PANEL DERECHO: LISTA DE USUARIOS */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50">

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg text-slate-600"><Users size={20}/></div>
                  Usuarios Registrados <span className="bg-slate-100 text-slate-500 text-sm py-1 px-2.5 rounded-full">{totalElements}</span>
                </h3>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search size={18} />
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar por correo..."
                    value={busqueda}
                    onChange={(e) => {
                      setBusqueda(e.target.value);
                      setCurrentPage(0);
                    }}
                    className="pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 w-full sm:w-64 text-sm font-medium transition-all"
                  />
                </div>
              </div>

              {/* TABLA DE USUARIOS */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-bold">
                      <th className="p-4">ID</th>
                      <th className="p-4">Correo</th>
                      <th className="p-4">Roles Asignados</th>
                      <th className="p-4">Estado</th>
                      <th className="p-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {usuarios.length > 0 ? (
                      usuarios.map((usuario) => (
                        <tr key={usuario.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 text-sm text-slate-500 font-medium">#{usuario.id}</td>
                          <td className="p-4">
                            <span className="text-sm font-bold text-slate-800">{usuario.email}</span>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1.5">
                              {usuario.roles.map(rol => (
                                <span key={rol} className="px-2 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold rounded-md uppercase">
                                  {rol}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${usuario.habilitado === false
                              ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'}`}>
                              {usuario.habilitado === false ? 'Deshabilitada' : 'Habilitada'}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            {(esDirector || !usuario.roles.includes('DIRECTOR')) && <button
                              onClick={() => abrirModalEdicion(usuario)}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-flex"
                              title="Editar Roles"
                            >
                              <Edit size={18} />
                            </button>}
                            {esDirector && usuario.email.toLowerCase() !== userData.email.toLowerCase() &&
                              <button type="button" onClick={() => {
                                setErrorEstado('');
                                setUsuarioEstado(usuario);
                              }} className="rounded-lg px-2 py-1 text-sm font-semibold text-blue-800 hover:bg-blue-50">
                                {usuario.habilitado === false ? 'Habilitar' : 'Deshabilitar'}
                              </button>}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500 font-medium">
                          No se encontraron usuarios con ese correo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* PAGINACIÓN */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                    disabled={currentPage === 0}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${currentPage === 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-700 border border-slate-200 hover:border-blue-500 hover:text-blue-600 shadow-sm'}`}
                  >
                    Anterior
                  </button>
                  <span className="text-sm font-medium text-slate-600">
                    Página <span className="font-bold text-slate-800">{currentPage + 1}</span> de <span className="font-bold text-slate-800">{totalPages}</span>
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                    disabled={currentPage >= totalPages - 1}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${currentPage >= totalPages - 1 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-700 border border-slate-200 hover:border-blue-500 hover:text-blue-600 shadow-sm'}`}
                  >
                    Siguiente
                  </button>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default UsuariosPage;
