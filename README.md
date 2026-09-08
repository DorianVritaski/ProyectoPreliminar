# GestEvents - Sistema de Gestión y Reserva de Espacios y Mobiliario

**Versión:** 1.0.0  
**Arquitectura:** Single Page Application (SPA) - Monolito Desacoplado (React 18 + FastAPI + PostgreSQL 15)  
**Entorno de ejecución:** Docker Desktop (Docker Compose)

---

## 🚀 Inicio Rápido con Docker Desktop

Para compilar y desplegar los 3 contenedores del sistema (Base de datos PostgreSQL, Backend FastAPI y Frontend React):

```bash
docker compose up --build -d
```

Una vez levantados los contenedores:
- **Frontend (Web App):** [http://localhost:5173](http://localhost:5173)
- **Backend (FastAPI Docs):** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check:** [http://localhost:8000/health](http://localhost:8000/health)
- **Base de Datos:** PostgreSQL en el puerto `5432`

Para detener los servicios:
```bash
docker compose down
```

---

## 📋 Módulos y Requisitos Implementados

### 1. Interfaz Pública sin Autenticación (RF-01)
- Acceso libre e inmediato sin pantalla de login.
- Calendario interactivo codificado por colores:
  - 🟢 **Libre** (Horarios disponibles)
  - 🔴 **Ocupado** (Eventos Aprobados)
  - 🟡 **En revisión** (Eventos Pendientes)
- Barra lateral de navegación con únicamente dos módulos (RF-01.3):
  1. **Calendario de Eventos**
  2. **Consultar Estado de Solicitud** (búsqueda por código de ticket o correo institucional).

### 2. Visualización de Disponibilidad y Modales (RF-02)
- Celdas del calendario con formato `09:00 - 11:00 | Auditorio UC`.
- Indicador dinámico interactivo `+N eventos más` si hay más de 2 eventos por día.
- Modal **"Detalle del Día"** al hacer clic en cualquier celda de fecha:
  - Cronograma ordenado por franjas horarias.
  - Recursos asignados por evento (con datos personales anonimizados).
  - Saldo de stock disponible en esa fecha para recursos clave (sillas, proyectores, vallas, etc.).
  - Botón directo `[ + Reservar en esta Fecha ]`.

### 3. Filtros de Búsqueda y Recursos Críticos (RF-03)
- Dropdown por los **8 espacios oficiales**:
  1. Pérgolas pabellón F
  2. Área verde a lado del pabellón A
  3. Área verde a lado del auditorio
  4. Área verde a lado del pabellón C
  5. Área verde a lado del pabellón H
  6. Auditorio UC
  7. Área entre pabellón C y pabellón D
  8. Sala de audiencia
- Filtros por **Equipos Críticos** (Vallas, Proyectores, Micrófonos, Parlantes, Laptops) con actualización dinámica del calendario.

### 4. Formulario Unificado de Solicitud (RF-04)
- **Datos del Solicitante:** Validación de correo institucional `@continental.edu.pe`, teléfono/anexo y área solicitante.
- **Datos del Evento:** Fecha/hora inicio y fin, selección de ambiente con validación inmediata de no-solapamiento (**RN-01**).
- **Desglose de Recursos y Servicios:**
  - *Servicios Generales y Mantenimiento / Activos:* Sillas, mesas, manteles, puntos de luz, vallas.
  - *Tecnologías de la Información (TI):* Parlantes, micrófonos, laptops, proyectores, pantallas, ecran.
  - *Seguridad, SSOMA y Vigilancia:* Control de acceso, personal de resguardo, validación de protocolo SSOMA.
- **Cálculo Dinámico de Stock (RN-02):**
  $$\text{Stock Disponible} = \text{Stock Total} - \sum \text{Stock Reservado en Eventos Simultáneos}$$
- **Deshabilitación Automática (RN-03):** Si el stock disponible es 0 durante el horario seleccionado, el input queda deshabilitado con la etiqueta *"Agotado en este horario"*.
- **Ruteo Interno de Áreas (RN-04):** Etiquetado automático por área destino bajo supervisión de la Jefatura de Operaciones.
- Generación de código único de ticket en formato `EVT-2026-XXXX`.
