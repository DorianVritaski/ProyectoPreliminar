import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import LandingHome from './views/LandingHome';
import EventsPublicPortal from './views/EventsPublicPortal';
import AccesosModule from './views/AccesosModule';

/**
 * RF-00: Portal Gateway de Servicios Universitarios
 * Si se accede desde un código QR o enlace directo a la raíz con parámetros (?codigo=... o ?view=accesos),
 * redirige inmediatamente a /accesos preservando los parámetros.
 * Esto garantiza que el escaneo funcione en cualquier servidor en la nube sin importar sus reglas de rewrite.
 */
function RootGateway() {
  const [searchParams] = useSearchParams();
  const codigo = searchParams.get('codigo');
  const view = searchParams.get('view');

  if (codigo || view === 'accesos') {
    return <Navigate to={`/accesos?${searchParams.toString()}`} replace />;
  }

  return <LandingHome />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Pantalla Principal Unificada */}
        <Route path="/" element={<RootGateway />} />

        {/* Módulo de Eventos (Plataforma Completa GestEvents) */}
        <Route path="/eventos" element={<EventsPublicPortal />} />
        <Route path="/eventos/*" element={<EventsPublicPortal />} />

        {/* Módulo Futuro: Control de Accesos */}
        <Route path="/accesos" element={<AccesosModule />} />

        {/* Ruta comodín de redirección al portal principal */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
