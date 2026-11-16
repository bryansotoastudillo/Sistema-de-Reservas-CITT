import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Boton from '../componentes/Boton';
import Modal from '../componentes/Modal';
import OpcionRol from '../componentes/OpcionRol';
import { Cpu, ArrowLeft, GraduationCap, BookOpen, ClipboardList, Crown, Wrench, Users, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../api/axiosConfig';

type ViewMode = 'login' | 'forgot_request' | 'forgot_reset' | 'register' | 'force_change_password';

// Función que asigna un ícono visual a cada rol
const getIconoPorRol = (rol: string) => {
  switch (rol) {
    case 'ALUMNO':       return <GraduationCap size={32} />;
    case 'DOCENTE':      return <BookOpen size={32} />;
    case 'COORDINADOR':
    case 'ADMINISTRATIVO': return <ClipboardList size={32} />;
    case 'DIRECTOR':     return <Crown size={32} />;
    case 'AYUDANTE':     return <Wrench size={32} />;
    default:             return <Users size={32} />;
  }
};

const LoginPage = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewMode>('login');

  // Estados del formulario
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Estado para guardar los errores visuales de cada input
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Estados para recuperación de contraseña
  const [forgotCode, setForgotCode] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');

  // Estados para el modal de selección de rol
  const [showRolModal, setShowRolModal] = useState(false);
  const [rolesDisponibles, setRolesDisponibles] = useState<string[]>([]);
  const [rolSeleccionado, setRolSeleccionado] = useState('');

  const changeView = (newView: ViewMode) => {
    setView(newView);
    setErrorMsg('');
    setSuccessMsg('');
    setFieldErrors({}); // Limpiar errores al cambiar de vista
  };

  // Auto-dismiss: los mensajes desaparecen solos a los 5 segundos
  useEffect(() => {
    if (!errorMsg) return;
    const t = setTimeout(() => setErrorMsg(''), 5000);
    return () => clearTimeout(t);
  }, [errorMsg]);

  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(''), 5000);
    return () => clearTimeout(t);
  }, [successMsg]);

  // Función auxiliar para borrar un error cuando el usuario empieza a escribir
  const clearFieldError = (field: string) => {
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    setFieldErrors({});

    // Validación Manual de campos vacíos
    let hasError = false;
    let newErrors: Record<string, string> = {};

    if (!email.trim()) {
      newErrors.email = 'El correo institucional es obligatorio';
      hasError = true;
    }
    if (!password.trim()) {
      newErrors.password = 'La contraseña es obligatoria';
      hasError = true;
    }

    if (hasError) {
      setFieldErrors(newErrors);
      setIsLoading(false);
      return; // Detenemos la ejecución aquí
    }

    try {
      const response = await api.post('/auth/login', {
        email: email.trim().toLowerCase(),
        password: password.trim(),
      });

      const perfilResponse = await api.get('/auth/perfil');
      const roles: string[] = perfilResponse.data.roles;
      const userEmail: string = perfilResponse.data.email;

      localStorage.setItem('userEmail', userEmail || '');
      localStorage.setItem('userRoles', JSON.stringify(roles || []));

      if (roles.length > 1) {
        setRolesDisponibles(roles);
        setRolSeleccionado(roles[0]);
        setShowRolModal(true);
      } else {
        localStorage.setItem('activeRole', roles[0] || '');
        setSuccessMsg('¡Inicio de sesión exitoso! Redirigiendo...');
        setTimeout(() => navigate('/dashboard'), 1500);
      }

    } catch (error: any) {
      console.error('Error de inicio de sesión:', error);

      const errorDataStr = typeof error.response?.data === 'string'
        ? error.response.data
        : JSON.stringify(error.response?.data || {});

      if (errorDataStr.includes('ACCESO_DENEGADO') || errorDataStr.includes('Debe cambiar su contrase')) {
        setSuccessMsg('Para tu seguridad, debes crear una nueva contraseña personal.');
        changeView('force_change_password');
        return;
      }

      if (error.response?.status === 401 || error.response?.status === 403) {
        setErrorMsg('Credenciales incorrectas. Verifica tu correo y contraseña.');
      } else {
        setErrorMsg('Ocurrió un error al intentar conectarse al servidor.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForzarCambioPassword = async (e: FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    let newErrors: Record<string, string> = {};
    let hasError = false;

    if (!forgotNewPassword) {
      newErrors.forgotNewPassword = 'Debe ingresar una nueva contraseña';
      hasError = true;
    }
    if (!forgotConfirmPassword) {
      newErrors.forgotConfirmPassword = 'Debe confirmar su contraseña';
      hasError = true;
    }

    if (hasError) {
      setFieldErrors(newErrors);
      return;
    }

    if (!validaciones.largo || !validaciones.mayuscula || !validaciones.numero) {
      setErrorMsg('La contraseña no cumple con los requisitos de seguridad.');
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setFieldErrors({ forgotConfirmPassword: 'Las contraseñas no coinciden' });
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await api.put('/auth/cambiar-password', {
        passwordActual: password,
        nuevaPassword: forgotNewPassword
      });

      const perfilResponse = await api.get('/auth/perfil');
      const roles: string[] = perfilResponse.data.roles;
      const userEmail: string = perfilResponse.data.email;

      localStorage.setItem('userEmail', userEmail || '');
      localStorage.setItem('userRoles', JSON.stringify(roles || []));

      if (roles.length > 1) {
        setRolesDisponibles(roles);
        setRolSeleccionado(roles[0]);
        setShowRolModal(true);
      } else {
        localStorage.setItem('activeRole', roles[0] || '');
        setSuccessMsg('¡Contraseña actualizada! Redirigiendo...');
        setTimeout(() => navigate('/dashboard'), 1500);
      }
    } catch (error: any) {
      const msg = error.response?.data?.mensaje || 'Error al actualizar contraseña. Recuerda que debe ser segura.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmarRol = () => {
    localStorage.setItem('activeRole', rolSeleccionado);
    setShowRolModal(false);
    navigate('/dashboard');
  };

  const handleOlvidoPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setFieldErrors({ email: 'Ingresa tu correo para poder ayudarte' });
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);
    try {
      await api.post('/auth/olvido-password', { email });
      setSuccessMsg('Si el correo está registrado, recibirás un código en breve.');
      setTimeout(() => changeView('forgot_reset'), 2000);
    } catch (error: any) {
      setErrorMsg('Hubo un error al procesar tu solicitud. Intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestablecerPassword = async (e: FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    let newErrors: Record<string, string> = {};
    let hasError = false;

    if (!forgotCode) { newErrors.forgotCode = 'Requerido'; hasError = true; }
    if (!forgotNewPassword) { newErrors.forgotNewPassword = 'Requerido'; hasError = true; }

    if (hasError) {
      setFieldErrors(newErrors);
      return;
    }

    if (!validaciones.largo || !validaciones.mayuscula || !validaciones.numero) {
      setErrorMsg('La contraseña no cumple con los requisitos de seguridad.');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);
    try {
      await api.post('/auth/restablecer-password', {
        codigoRecuperacion: forgotCode,
        nuevaPassword: forgotNewPassword
      });
      setSuccessMsg('¡Contraseña restablecida exitosamente! Redirigiéndote al inicio de sesión...');
      setForgotCode('');
      setForgotNewPassword('');
      setForgotConfirmPassword('');
      setPassword('');
      setTimeout(() => changeView('login'), 3000);
    } catch (error: any) {
      const msg = error.response?.data?.mensaje || 'Código incorrecto o la contraseña no cumple los requisitos.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoRegistro = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setFieldErrors({ email: 'El correo institucional es obligatorio' });
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);
    try {
      const response = await api.post('/auth/auto-registro', { email: email.trim().toLowerCase() });
      setSuccessMsg(response.data.mensaje || '¡Cuenta creada! Revisa tu correo institucional para ver tu contraseña provisoria.');
      setEmail('');
      setTimeout(() => changeView('login'), 4000);
    } catch (error: any) {
      const msg = error.response?.data?.mensaje || 'Error al registrar la cuenta. Usa un correo institucional habilitado para autorregistro.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const validaciones = {
    largo: forgotNewPassword.length >= 8,
    mayuscula: /[A-Z]/.test(forgotNewPassword),
    numero: /[0-9]/.test(forgotNewPassword),
  };

  const IndicadorPassword = () => forgotNewPassword.length > 0 ? (
    <div className="mt-2 space-y-1.5 p-3 bg-gray-50 border border-gray-200 rounded-xl">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Requisitos:</p>
      <div className={`flex items-center gap-2 text-xs font-medium ${validaciones.largo ? 'text-green-600' : 'text-gray-400'}`}>
        {validaciones.largo ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
        Mínimo 8 caracteres
      </div>
      <div className={`flex items-center gap-2 text-xs font-medium ${validaciones.mayuscula ? 'text-green-600' : 'text-gray-400'}`}>
        {validaciones.mayuscula ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
        Al menos 1 letra mayúscula
      </div>
      <div className={`flex items-center gap-2 text-xs font-medium ${validaciones.numero ? 'text-green-600' : 'text-gray-400'}`}>
        {validaciones.numero ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
        Al menos 1 número
      </div>
    </div>
  ) : null;

  return (
    <>
      <Modal
        isOpen={showRolModal}
        onClose={() => {}}
        titulo="¿Con qué rol deseas ingresar?"
        icono={<Users size={22} />}
      >
        <p className="text-gray-500 text-sm mb-6 text-center">
          Tu cuenta tiene múltiples roles. Selecciona con cuál deseas trabajar en esta sesión.
        </p>
        <div className="grid grid-cols-2 gap-4 mb-6">
          {rolesDisponibles.map((rol) => (
            <OpcionRol
              key={rol}
              nombreRol={rol}
              icono={getIconoPorRol(rol)}
              seleccionado={rolSeleccionado === rol}
              onClick={() => setRolSeleccionado(rol)}
            />
          ))}
        </div>
        <Boton variante="primario" bloque onClick={handleConfirmarRol} disabled={!rolSeleccionado}>
          Ingresar como {rolSeleccionado}
        </Boton>
      </Modal>

      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #f1f5f9 0%, #e2e8f0 40%, #dbeafe 100%)" }}>

        <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-30" style={{ background: "radial-gradient(circle, #bfdbfe, transparent)" }} />
          <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #fed7aa, transparent)" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-20 border border-blue-200" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full opacity-20 border border-blue-200" />
          <div className="absolute top-20 right-20 grid grid-cols-5 gap-3 opacity-20">
            {Array.from({ length: 25 }).map((_, i) => (<div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400" />))}
          </div>
          <div className="absolute bottom-20 left-20 grid grid-cols-5 gap-3 opacity-20">
            {Array.from({ length: 25 }).map((_, i) => (<div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400" />))}
          </div>
        </div>

        <div className="relative w-full max-w-[460px]">
          <div className="bg-white border border-blue-100 rounded-3xl shadow-xl shadow-blue-100/60 overflow-hidden">
            <div className="p-10 flex flex-col items-center">
              <div className="flex items-center justify-center gap-2 mb-8 mt-2">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center">
                  <Cpu size={28} className="text-blue-600" strokeWidth={2.5} />
                </div>
                <span className="text-[2rem] font-black tracking-tight text-slate-800">
                  <span className="text-blue-600">CITT</span> DuocUC
                </span>
              </div>

              {errorMsg && (
                <div className="w-full mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm flex items-center gap-3" role="alert">
                  <AlertCircle size={20} className="shrink-0 text-red-500" />
                  <p className="font-semibold leading-snug">{errorMsg}</p>
                </div>
              )}
              {successMsg && (
                <div className="w-full mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-2xl text-sm flex items-center gap-3" role="alert">
                  <CheckCircle size={20} className="shrink-0 text-green-500" />
                  <p className="font-semibold leading-snug">{successMsg}</p>
                </div>
              )}

              {/* VISTA 1: LOGIN */}
              {view === 'login' && (
                <>
                  <h2 className="text-[1.8rem] font-bold text-slate-800 mb-1 text-center">¡Bienvenido!</h2>
                  <p className="text-[14px] text-slate-400 mb-8 text-center font-medium">Ingresa tus datos e inicia sesión</p>

                  {/*noValidate */}
                  <form onSubmit={handleLogin} className="w-full space-y-4" noValidate>
                    <div>
                      <label className="block text-sm font-bold text-slate-600 mb-1.5">Correo Institucional</label>
                      <input type="email" placeholder="ejemplo@duocuc.cl"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); clearFieldError('email'); }}
                        disabled={isLoading}
                        // Clases dinámicas para pintar el borde rojo si hay error
                        className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none transition-all ${
                          fieldErrors.email
                            ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                            : 'border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20'
                        }`} />
                      {/*  Texto de error rojo */}
                      {fieldErrors.email && <span className="text-red-500 text-xs mt-1 block font-medium">{fieldErrors.email}</span>}
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-600 mb-1.5">Contraseña</label>
                      <input type="password" placeholder="••••••••"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); clearFieldError('password'); }}
                        disabled={isLoading}
                        className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none transition-all ${
                          fieldErrors.password
                            ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                            : 'border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20'
                        }`} />
                      {fieldErrors.password && <span className="text-red-500 text-xs mt-1 block font-medium">{fieldErrors.password}</span>}
                    </div>
                    <button type="submit" disabled={isLoading}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer border-none mt-2 disabled:opacity-60 disabled:cursor-not-allowed">
                      {isLoading ? 'Verificando...' : 'Iniciar Sesión'}
                    </button>
                  </form>

                  <div className="flex flex-col gap-3 text-center mt-6 w-full">
                    <button type="button" onClick={() => changeView('forgot_request')}
                      className="text-blue-500 hover:text-blue-600 text-[14px] font-medium bg-transparent border-none cursor-pointer transition-colors">
                      ¿Olvidaste tu contraseña?
                    </button>
                    <div className="text-[13px] text-slate-400 font-medium">
                      ¿No tienes cuenta?{' '}
                      <button type="button" onClick={() => changeView('register')}
                        className="text-blue-500 hover:text-blue-600 font-bold bg-transparent border-none cursor-pointer transition-colors">
                        Regístrate aquí
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* VISTA DE CAMBIO DE CONTRASEÑA FORZOSO */}
              {view === 'force_change_password' && (
                <>
                  <h2 className="text-[1.8rem] font-bold text-slate-800 mb-2 text-center">Cambiar Contraseña</h2>
                  <p className="text-[14px] text-slate-500 mb-8 text-center leading-relaxed">
                    Por seguridad, debes cambiar tu clave provisoria antes de entrar al sistema por primera vez.
                  </p>
                  <form onSubmit={handleForzarCambioPassword} className="w-full space-y-4" noValidate>
                    <div>
                      <label className="block text-sm font-bold text-slate-600 mb-1.5">Tu Nueva Contraseña Personal</label>
                      <input type="password" placeholder="Mínimo 8 caracteres"
                        value={forgotNewPassword} onChange={(e) => { setForgotNewPassword(e.target.value); clearFieldError('forgotNewPassword'); }} disabled={isLoading}
                        className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none transition-all ${fieldErrors.forgotNewPassword ? 'border-red-500 focus:ring-red-200' : 'border-slate-200 focus:border-blue-400'}`} />
                      {fieldErrors.forgotNewPassword && <span className="text-red-500 text-xs mt-1 block font-medium">{fieldErrors.forgotNewPassword}</span>}
                    </div>
                    <IndicadorPassword />
                    <div>
                      <label className="block text-sm font-bold text-slate-600 mb-1.5">Confirmar Nueva Contraseña</label>
                      <input type="password" placeholder="Repite la contraseña"
                        value={forgotConfirmPassword} onChange={(e) => { setForgotConfirmPassword(e.target.value); clearFieldError('forgotConfirmPassword'); }} disabled={isLoading}
                        className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none transition-all ${fieldErrors.forgotConfirmPassword ? 'border-red-500 focus:ring-red-200' : 'border-slate-200 focus:border-blue-400'}`} />
                      {fieldErrors.forgotConfirmPassword && <span className="text-red-500 text-xs mt-1 block font-medium">{fieldErrors.forgotConfirmPassword}</span>}
                    </div>
                    <button type="submit" disabled={isLoading}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-200 cursor-pointer border-none mt-2 disabled:opacity-60">
                      {isLoading ? 'Guardando...' : 'Guardar y Entrar'}
                    </button>
                  </form>
                </>
              )}

              {/* VISTA 2: RECUPERAR CONTRASEÑA */}
              {view === 'forgot_request' && (
                <>
                  <h2 className="text-[1.8rem] font-bold text-slate-800 mb-2 text-center">Recuperar Contraseña</h2>
                  <p className="text-[14px] text-slate-500 mb-8 text-center leading-relaxed">
                    Ingresa tu correo institucional para recibir las instrucciones de recuperación.
                  </p>
                  <form onSubmit={handleOlvidoPassword} className="w-full space-y-4" noValidate>
                    <div>
                      <label className="block text-sm font-bold text-slate-600 mb-1.5">Correo Institucional</label>
                      <input type="email" placeholder="ejemplo@duocuc.cl"
                        value={email} onChange={(e) => { setEmail(e.target.value); clearFieldError('email'); }} disabled={isLoading}
                        className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none transition-all ${fieldErrors.email ? 'border-red-500 focus:ring-red-200' : 'border-slate-200 focus:border-blue-400'}`} />
                      {fieldErrors.email && <span className="text-red-500 text-xs mt-1 block font-medium">{fieldErrors.email}</span>}
                    </div>
                    <button type="submit" disabled={isLoading}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-200 cursor-pointer border-none mt-2 disabled:opacity-60">
                      {isLoading ? 'Enviando...' : 'Enviar Instrucciones'}
                    </button>
                  </form>
                  <button type="button" onClick={() => changeView('login')}
                    className="text-slate-500 hover:text-slate-700 text-[14px] font-medium bg-transparent border-none cursor-pointer flex items-center justify-center gap-2 mx-auto mt-6 transition-colors">
                    <ArrowLeft size={16} /> Volver al inicio
                  </button>
                </>
              )}

              {/* VISTA 3: RESTABLECER CONTRASEÑA */}
              {view === 'forgot_reset' && (
                <>
                  <h2 className="text-[1.8rem] font-bold text-slate-800 mb-2 text-center">Restablecer Contraseña</h2>
                  <p className="text-[14px] text-slate-500 mb-8 text-center leading-relaxed">
                    Hemos enviado una <strong className="text-slate-700">clave temporal</strong> a tu correo. Ingrésala abajo junto con tu nueva contraseña.
                  </p>
                  <form onSubmit={handleRestablecerPassword} className="w-full space-y-4" noValidate>
                    <div>
                      <label className="block text-sm font-bold text-slate-600 mb-1.5">Clave Temporal</label>
                      <input type="text" placeholder="Ej: 54a5b0c4"
                        value={forgotCode} onChange={(e) => { setForgotCode(e.target.value); clearFieldError('forgotCode'); }} disabled={isLoading}
                        className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none transition-all ${fieldErrors.forgotCode ? 'border-red-500 focus:ring-red-200' : 'border-slate-200 focus:border-blue-400'}`} />
                      {fieldErrors.forgotCode && <span className="text-red-500 text-xs mt-1 block font-medium">{fieldErrors.forgotCode}</span>}
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-600 mb-1.5">Nueva Contraseña</label>
                      <input type="password" placeholder="Mínimo 8 caracteres, 1 mayúscula, 1 número"
                        value={forgotNewPassword} onChange={(e) => { setForgotNewPassword(e.target.value); clearFieldError('forgotNewPassword'); }} disabled={isLoading}
                        className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none transition-all ${fieldErrors.forgotNewPassword ? 'border-red-500 focus:ring-red-200' : 'border-slate-200 focus:border-blue-400'}`} />
                      {fieldErrors.forgotNewPassword && <span className="text-red-500 text-xs mt-1 block font-medium">{fieldErrors.forgotNewPassword}</span>}
                    </div>
                    <IndicadorPassword />
                    <button type="submit" disabled={isLoading}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-200 cursor-pointer border-none mt-2 disabled:opacity-60">
                      {isLoading ? 'Actualizando...' : 'Guardar Nueva Contraseña'}
                    </button>
                  </form>
                  <button type="button" onClick={() => changeView('login')}
                    className="text-slate-400 hover:text-slate-300 text-[14px] font-medium bg-transparent border-none cursor-pointer flex items-center justify-center gap-2 mx-auto mt-6 transition-colors">
                    <ArrowLeft size={16} /> Volver al inicio
                  </button>
                </>
              )}

              {/* VISTA 4: REGISTRO */}
              {view === 'register' && (
                <>
                  <h2 className="text-[1.8rem] font-bold text-slate-800 mb-2 text-center">Crear Cuenta</h2>
                  <p className="text-[14px] text-slate-500 mb-8 text-center leading-relaxed">
                    Ingresa tu correo institucional y te enviaremos una clave provisoria.
                  </p>
                  <form onSubmit={handleAutoRegistro} className="w-full space-y-4" noValidate>
                    <div>
                      <label className="block text-sm font-bold text-slate-600 mb-1.5">Correo Institucional</label>
                      <input type="email" placeholder="ejemplo@duocuc.cl"
                        value={email} onChange={(e) => { setEmail(e.target.value); clearFieldError('email'); }} disabled={isLoading}
                        className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none transition-all ${fieldErrors.email ? 'border-red-500 focus:ring-red-200' : 'border-slate-200 focus:border-blue-400'}`} />
                      {fieldErrors.email && <span className="text-red-500 text-xs mt-1 block font-medium">{fieldErrors.email}</span>}
                    </div>
                    <button type="submit" disabled={isLoading}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-200 cursor-pointer border-none mt-2 disabled:opacity-60">
                      {isLoading ? 'Registrando...' : 'Crear Cuenta'}
                    </button>
                  </form>
                  <button type="button" onClick={() => changeView('login')}
                    className="text-slate-500 hover:text-slate-700 text-[14px] font-medium bg-transparent border-none cursor-pointer flex items-center justify-center gap-2 mx-auto mt-6 transition-colors">
                    <ArrowLeft size={16} /> Volver al inicio
                  </button>
                </>
              )}

            </div>
          </div>
          <div className="absolute -bottom-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-orange-400/30 to-transparent" />
        </div>
      </div>
    </>
  );
};

export default LoginPage;