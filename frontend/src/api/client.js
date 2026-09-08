const API_BASE = '/api/v1';

async function fetchJSON(endpoint, options = {}) {
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    let errorMsg = `Error en la petición: ${response.statusText}`;
    if (data?.detail) {
      if (typeof data.detail === 'string') {
        errorMsg = data.detail;
      } else if (Array.isArray(data.detail)) {
        errorMsg = data.detail.map((d) => d.msg || JSON.stringify(d)).join(', ');
      }
    }
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // Ambientes Públicos
  getAmbientes: () => fetchJSON('/ambientes'),

  // Áreas Solicitantes Públicas (RF-01.5)
  getAreasSolicitantes: () => fetchJSON('/areas-solicitantes'),

  // Recursos Públicos
  getRecursosCatalogo: () => fetchJSON('/recursos/catalogo'),
  checkDisponibilidad: (fecha_inicio, fecha_fin) =>
    fetchJSON('/recursos/disponibilidad', {
      method: 'POST',
      body: JSON.stringify({ fecha_inicio, fecha_fin }),
    }),

  // Eventos del Calendario
  getEventos: (params = {}) => {
    const query = new URLSearchParams();
    if (params.fecha_inicio) query.append('fecha_inicio', params.fecha_inicio);
    if (params.fecha_fin) query.append('fecha_fin', params.fecha_fin);
    if (params.ambiente_id) query.append('ambiente_id', params.ambiente_id);
    if (params.recurso_critico_id) query.append('recurso_critico_id', params.recurso_critico_id);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return fetchJSON(`/eventos${queryString}`);
  },

  // Solicitudes Públicas
  crearSolicitud: (payload) =>
    fetchJSON('/solicitudes', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getSeguimiento: (search) =>
    fetchJSON(`/solicitudes/seguimiento?search=${encodeURIComponent(search)}`),

  // ------------------------------------------------------------------
  // Módulo de Administración - Jefatura de Operaciones (RF-05)
  // ------------------------------------------------------------------
  adminLogin: (username, password) =>
    fetchJSON('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  // RF-05.1: Gestión de Solicitudes
  adminGetSolicitudes: (estado) => {
    const query = estado ? `?estado=${estado}` : '';
    return fetchJSON(`/admin/solicitudes${query}`);
  },
  adminUpdateSolicitudEstado: (id, estado, motivo_rechazo = null) =>
    fetchJSON(`/admin/solicitudes/${id}/estado`, {
      method: 'PATCH',
      body: JSON.stringify({ estado, motivo_rechazo }),
    }),

  // RF-05.2: Gestión de Ambientes
  adminGetAmbientes: () => fetchJSON('/admin/ambientes'),
  adminCreateAmbiente: (payload) =>
    fetchJSON('/admin/ambientes', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  adminUpdateAmbiente: (id, payload) =>
    fetchJSON(`/admin/ambientes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  adminDeleteAmbiente: (id) =>
    fetchJSON(`/admin/ambientes/${id}`, {
      method: 'DELETE',
    }),

  // RF-05.3: Gestión de Recursos e Inventario
  adminCreateRecurso: (payload) =>
    fetchJSON('/admin/recursos', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  adminUpdateStock: (id, stock_total) =>
    fetchJSON(`/admin/recursos/${id}/stock`, {
      method: 'PATCH',
      body: JSON.stringify({ stock_total: Number(stock_total) }),
    }),
  adminUpdateRecurso: (id, payload) =>
    fetchJSON(`/admin/recursos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  adminDeleteRecurso: (id) =>
    fetchJSON(`/admin/recursos/${id}`, {
      method: 'DELETE',
    }),

  // RF-05.4: Gestión de Áreas / Facultades Solicitantes
  adminGetAreasSolicitantes: () => fetchJSON('/admin/areas-solicitantes'),
  adminCreateAreaSolicitante: (payload) =>
    fetchJSON('/admin/areas-solicitantes', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  adminUpdateAreaSolicitante: (id, payload) =>
    fetchJSON(`/admin/areas-solicitantes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  adminDeleteAreaSolicitante: (id) =>
    fetchJSON(`/admin/areas-solicitantes/${id}`, {
      method: 'DELETE',
    }),

  // Gestión de Áreas Administrativas Responsables (Operativas / Destino)
  adminGetAreasDestino: () => fetchJSON('/admin/areas-destino'),
  adminCreateAreaDestino: (payload) =>
    fetchJSON('/admin/areas-destino', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  adminUpdateAreaDestino: (id, payload) =>
    fetchJSON(`/admin/areas-destino/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  adminDeleteAreaDestino: (id) =>
    fetchJSON(`/admin/areas-destino/${id}`, {
      method: 'DELETE',
    }),

  // Gestión de Cuentas de Administrador (Multi-Admin)
  adminGetUsuarios: () => fetchJSON('/admin/usuarios'),
  adminCreateUsuario: (payload) =>
    fetchJSON('/admin/usuarios', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  adminUpdateUsuario: (id, payload) =>
    fetchJSON(`/admin/usuarios/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  adminDeleteUsuario: (id) =>
    fetchJSON(`/admin/usuarios/${id}`, {
      method: 'DELETE',
    }),
};
