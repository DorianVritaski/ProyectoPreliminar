import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingHome from './views/LandingHome';
import EventsPublicPortal from './views/EventsPublicPortal';
import AccesosModule from './views/AccesosModule';
import PacientesModule from './views/PacientesModule';

/**
 * RF-00: Portal Gateway de Servicios Universitarios
 * Punto de entrada público en la raíz '/' que distribuye la navegación hacia:
 * - / -> Pantalla Principal (Landing Hub de Selección)
 * - /eventos/* -> Plataforma Completa de Gestión de Eventos y Reservas
 * - /accesos -> Módulo de Control de Accesos y Seguridad
 * - /accesos/pacientes -> Sub-Módulo Unificado de Pacientes para Prácticas Clínicas (Odonto/Psico/Enfermería)
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Pantalla Principal Unificada */}
        <Route path="/" element={<LandingHome />} />

        {/* Módulo de Eventos (Plataforma Completa GestEvents) */}
        <Route path="/eventos" element={<EventsPublicPortal />} />
        <Route path="/eventos/*" element={<EventsPublicPortal />} />

        {/* Módulo de Control de Accesos y Seguridad */}
        <Route path="/accesos" element={<AccesosModule />} />
        <Route path="/accesos/pacientes" element={<PacientesModule />} />

        {/* Ruta comodín de redirección al portal principal */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
