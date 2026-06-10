# Prompt Maestro — Función "Recorrido GPS" (kilometraje por ubicación)

## Objetivo
Permitir que el vendedor registre su ubicación con un toque al **salir**, al **llegar a cada visita** (varias veces) y al **regresar**, y que la app **estime los kilómetros recorridos** apoyándose en mapas, **sin costo monetario**. La estimación se muestra siempre, el vendedor la **confirma/ajusta**, y al confirmar **alimenta el reporte oficial de kilometraje y el reembolso**.

## Decisiones (acordadas con el usuario)
1. **Reembolso:** el GPS estima → se muestra la estimación del programa → el vendedor confirma/ajusta → cuenta para el reporte oficial. (Opción "estima y confirma" + mostrar siempre la estimación).
2. **Cálculo de distancia:** intentar primero un **servicio de rutas gratuito** (OpenRouteService, por carretera real); si no hay llave, falla o se agota el límite, **caer automáticamente** a un **cálculo interno** (distancia geográfica entre puntos × factor de carretera). Sin costo en ningún caso.
3. **Ubicación en la app:** **integrado en la pantalla de Kilometraje**.

## Restricciones técnicas (honestas)
- Una **app web no puede rastrear el GPS en segundo plano** de forma confiable. Por eso el diseño es **"registro por toques"** (el vendedor pulsa un botón en cada parada). No hay seguimiento continuo automático.
- **Sin pago:** mapa con **Leaflet + OpenStreetMap** (sin llave). Distancia: ORS (llave gratuita opcional) con **respaldo interno Haversine × factor** (siempre gratis y disponible).
- La llave de ORS, si se usa, va **solo en el servidor** (variable `ORS_API_KEY`), nunca en el navegador.

## Arquitectura

### Backend
- **`services/distance.js`** — `estimateRoute(points, medio)`:
  - Si `ORS_API_KEY` está configurada: una sola petición a ORS `directions/driving-car` con todos los puntos en orden → distancia total + por tramo. Timeout ~8s.
  - Si no hay llave / error / límite: **Haversine** entre puntos consecutivos × `ROAD_FACTOR` (def. 1.3).
  - Devuelve `{ total_km, metodo: 'ruta'|'interno', legs: [{km}] }`.
- **Modelo `Trip`** (`trips`): `user_id`, `report_id`, `fecha`, `medio`, `estado` (en_curso|finalizado|confirmado), `puntos` (JSONB: orden, tipo salida|visita|regreso, label, lat, lng, ts), `legs` (JSONB), `total_km_estimado`, `total_km_confirmado`, `metodo`.
- **Rutas `/api/trips`** (con verificación de dueño, sin IDOR):
  - `POST /` iniciar recorrido (medio, fecha, primer punto "salida").
  - `POST /:id/points` agregar parada (lat,lng,label,tipo) → recalcula estimación.
  - `POST /:id/finish` cerrar recorrido.
  - `POST /:id/confirm` confirmar total → crea entradas de km en el reporte del mes (una por visita, distribuyendo el total confirmado de forma proporcional) y enlaza el reporte.
  - `GET /?mes&anio` listar; `DELETE /:id` borrar.

### Frontend (dentro de Kilometraje)
- Sección **"Recorrido con GPS"**: botones **Iniciar** (captura salida) → **Registrar llegada** (pide nombre del cliente) repetible → **Finalizar (regreso)**.
- **Mapa Leaflet** con los puntos (círculos) y la línea del recorrido + atribución OSM.
- Muestra **estimación total + por tramo + método usado** ("ruta real" o "estimado interno").
- Botón **Confirmar**: el vendedor puede ajustar el total antes de que cuente para el reporte/reembolso.

## Cálculo y dinero
- `valor_km = km × tarifa` (Carro $600,65 / Moto $507,03, configurables).
- Al confirmar: distribución proporcional del total confirmado entre los tramos; cada tramo = una entrada de km (cliente = destino del tramo; el regreso = "Regreso").
- La estimación es **aproximada** (especialmente el método interno). Por eso el vendedor confirma antes de que afecte el reembolso.

## Variables de entorno nuevas (opcionales)
- `ORS_API_KEY` — llave gratuita de OpenRouteService (si está vacía, se usa solo el cálculo interno).
- `ROAD_FACTOR` — factor de corrección de carretera para el método interno (def. `1.3`).

## Criterios de aceptación
- Funciona **sin configurar nada** (método interno) y **mejora** si se agrega `ORS_API_KEY`.
- No expone llaves al navegador. Respeta la propiedad de datos (cada quien ve/usa lo suyo).
- La estimación se ve siempre; el reembolso solo cambia tras la confirmación del vendedor.
