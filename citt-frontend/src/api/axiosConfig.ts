import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? '/api' : 'http://localhost:8080/api');

const api = axios.create({
  baseURL: API_BASE_URL,
  // Obligatorio para enviar y recibir cookies entre frontend y backend
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// =================================================================
// BANDERAS PARA LA COLA DE PETICIONES (Evita bucles infinitos)
// =================================================================
let isRefreshing = false;
let failedQueue: any[] = [];

// Procesa todas las peticiones que quedaron en espera mientras se refrescaba el token
const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// =================================================================
// 1. INTERCEPTOR DE PETICIONES (REQUEST)
// =================================================================
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// =================================================================
// 2. INTERCEPTOR DE RESPUESTAS (RESPONSE)
// =================================================================
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Si el servidor responde con 401 o 403, intentamos refrescar el token
    if ((error.response?.status === 401 || error.response?.status === 403) && !originalRequest._retry) {

      // No interceptamos si el error viene del login o del propio endpoint de refresco
      // Tampoco interceptamos si el error es por contraseña provisional (ACCESO_DENEGADO)
      const errorDataStr = JSON.stringify(error.response?.data || {});

      if (
        originalRequest.url?.includes('/auth/login') ||
        originalRequest.url?.includes('/auth/refrescar-token') ||
        errorDataStr.includes('ACCESO_DENEGADO') ||
        errorDataStr.includes('Debe cambiar su contrase')
      ) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Si ya hay un refresco en progreso, ponemos esta petición en espera
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Pedimos un nuevo access token usando el refresh token (viaja automáticamente en la cookie)
        await axios.post(`${API_BASE_URL}/auth/refrescar-token`, {}, { withCredentials: true });

        // Procesamos las peticiones que estaban esperando
        processQueue(null);

        // Reintentamos la petición original que había fallado
        return api(originalRequest);

      } catch (refreshError) {
        // Si el refresh token también falló, limpiamos la sesión y redirigimos al login
        processQueue(refreshError, null);
        localStorage.clear();
        window.location.href = '/';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
