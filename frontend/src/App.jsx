import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import CalendarView from './components/Calendar/CalendarView';
import TrackingView from './components/Tracking/TrackingView';
import ReservationModal from './components/Reservation/ReservationModal';
import AdminLoginModal from './components/Admin/AdminLoginModal';
import AdminDashboard from './components/Admin/AdminDashboard';
import { api } from './api/client';

export default function App() {
  const [activeTab, setActiveTab] = useState('calendario'); // 'calendario' | 'seguimiento' | 'admin'
  const [ambientes, setAmbientes] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [selectedAmbienteId, setSelectedAmbienteId] = useState(null);
  const [selectedCriticalItem, setSelectedCriticalItem] = useState(null);
  const [recursosCatalogo, setRecursosCatalogo] = useState([]);

  // Modal de Reserva Pública
  const [isReservationOpen, setIsReservationOpen] = useState(false);
  const [prefilledDate, setPrefilledDate] = useState(null);
  const [trackingQuery, setTrackingQuery] = useState('');

  // Autenticación Administrativa (Jefatura de Operaciones)
  const [adminUser, setAdminUser] = useState(() => {
    const saved = localStorage.getItem('gestevents_admin_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);

  // 1. Cargar catálogo de ambientes y recursos
  const loadAmbientes = useCallback(async () => {
    try {
      const data = await api.getAmbientes();
      setAmbientes(data);
    } catch (err) {
      console.error('Error cargando ambientes:', err);
    }
  }, []);

  const loadCatalogo = useCallback(async () => {
    try {
      const data = await api.getRecursosCatalogo();
      setRecursosCatalogo(data);
    } catch (err) {
      console.error('Error cargando catálogo:', err);
    }
  }, []);

  useEffect(() => {
    loadAmbientes();
    loadCatalogo();
  }, [loadAmbientes, loadCatalogo]);

  // 2. Cargar eventos según filtros activos
  const loadEventos = useCallback(async () => {
    try {
      const params = {};
      if (selectedAmbienteId) {
        params.ambiente_id = selectedAmbienteId;
      }

      // Si hay un recurso crítico seleccionado, encontrar su ID
      if (selectedCriticalItem && recursosCatalogo.length > 0) {
        for (const area of recursosCatalogo) {
          const rec = area.recursos.find(
            (r) => r.nombre.toLowerCase() === selectedCriticalItem.toLowerCase()
          );
          if (rec) {
            params.recurso_critico_id = rec.id;
            break;
          }
        }
      }

      const data = await api.getEventos(params);
      setEventos(data);
    } catch (err) {
      console.error('Error cargando eventos:', err);
    }
  }, [selectedAmbienteId, selectedCriticalItem, recursosCatalogo]);

  useEffect(() => {
    loadEventos();
  }, [loadEventos]);

  // Manejar apertura de reserva con fecha preseleccionada
  const handleOpenReservationWithDate = (date) => {
    setPrefilledDate(date);
    setIsReservationOpen(true);
  };

  // Manejar toggle de recurso crítico
  const handleToggleCriticalItem = (resourceName) => {
    setSelectedCriticalItem((prev) => (prev === resourceName ? null : resourceName));
  };

  const handleResetFilters = () => {
    setSelectedAmbienteId(null);
    setSelectedCriticalItem(null);
  };

  const handleGoToTracking = (ticketCode) => {
    setTrackingQuery(ticketCode);
    setActiveTab('seguimiento');
  };

  // Handlers Admin
  const handleSuccessLogin = (loginRes) => {
    setAdminUser(loginRes.user);
    localStorage.setItem('gestevents_admin_user', JSON.stringify(loginRes.user));
    setActiveTab('admin');
  };

  const handleLogout = () => {
    setAdminUser(null);
    localStorage.removeItem('gestevents_admin_user');
    setActiveTab('calendario');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans">
      {/* Sidebar con los 2 módulos públicos (RF-01.3) y acceso a administración */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        adminUser={adminUser}
        onOpenAdminLogin={() => setIsAdminLoginOpen(true)}
        onGoToAdminDashboard={() => setActiveTab('admin')}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Header */}
        <Header
          onOpenReservation={() => {
            setPrefilledDate(null);
            setIsReservationOpen(true);
          }}
        />

        {/* View Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {activeTab === 'calendario' && (
            <CalendarView
              eventos={eventos}
              ambientes={ambientes}
              selectedAmbienteId={selectedAmbienteId}
              onSelectAmbiente={setSelectedAmbienteId}
              selectedCriticalItem={selectedCriticalItem}
              onToggleCriticalItem={handleToggleCriticalItem}
              onResetFilters={handleResetFilters}
              onOpenReservationWithDate={handleOpenReservationWithDate}
            />
          )}

          {activeTab === 'seguimiento' && (
            <TrackingView initialSearchQuery={trackingQuery} />
          )}

          {activeTab === 'admin' && (
            <AdminDashboard
              adminUser={adminUser}
              onLogout={handleLogout}
              onRefreshPublicData={() => {
                loadEventos();
                loadAmbientes();
                loadCatalogo();
              }}
            />
          )}
        </main>
      </div>

      {/* Modal Unificado de Solicitud de Reserva (RF-04 y RF-01.5) */}
      <ReservationModal
        isOpen={isReservationOpen}
        prefilledDate={prefilledDate}
        ambientes={ambientes}
        onClose={() => {
          setIsReservationOpen(false);
          setPrefilledDate(null);
        }}
        onSuccessCreated={() => {
          loadEventos();
        }}
        onGoToTracking={handleGoToTracking}
      />

      {/* Modal de Autenticación para Administrador (RF-05) */}
      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => setIsAdminLoginOpen(false)}
        onSuccessLogin={handleSuccessLogin}
      />
    </div>
  );
}
