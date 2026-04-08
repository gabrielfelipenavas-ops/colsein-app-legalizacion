# CLAUDE.md — Contexto para Claude Code

## Qué es este proyecto
Sistema de gestión de gastos y kilometraje para COLSEIN S.A.S. (NIT 800002030), empresa colombiana de medición, control y automatización industrial. Digitaliza el proceso de reportes de transporte y viáticos que antes se hacía en Excel/PDF.

## Stack tecnológico
- **Backend**: Node.js 18+, Express 4, Sequelize 6 (ORM), PostgreSQL 16
- **Frontend**: React 18, Vite 5, Tailwind CSS 3, React Router 6, Axios, Lucide Icons
- **Infra**: Docker Compose (postgres + pgadmin)

## Estructura
```
backend/
  src/index.js          — Entry point Express
  src/models/index.js   — Sequelize models + associations
  src/routes/            — API endpoints (auth, kilometraje, anticipos, expenses, reports, clients, users, config)
  src/middleware/        — auth.js (JWT), upload.js (Multer)
  src/services/          — excelGenerator.js (ExcelJS)
  migrations/            — Sequelize migrations
  seeds/                 — Demo data
  config/database.js     — DB config

frontend/
  src/main.jsx           — React entry + Router
  src/context/           — AuthContext (JWT login)
  src/services/api.js    — Axios API client
  src/pages/             — LoginPage, HomePage, KilometrajePage, FacturasPage, ViajesPage, ReportesPage
  src/components/        — AppLayout (nav), AddEntryModal (km entry with photos+taxis)
  src/utils/helpers.js   — Formatters, constants
```

## Comandos de desarrollo
```bash
# Levantar todo
npm run dev                  # backend (3001) + frontend (5173) simultáneos

# Solo backend
cd backend && npm run dev

# Base de datos
docker-compose up -d         # PostgreSQL + pgAdmin
cd backend && npx sequelize-cli db:migrate
cd backend && npx sequelize-cli db:seed:all

# Frontend
cd frontend && npm run dev
cd frontend && npm run build
```

## Reglas de negocio clave
- Tarifas km: CARRO=$600.65/km, MOTO=$507.03/km (configurables en system_config)
- Peajes, parqueaderos y taxis requieren foto de soporte obligatoria
- Taxis requieren autorización previa + tipo + origen + destino
- Kilometraje se entrega en los primeros 5 días calendario del mes siguiente
- No se reconoce km para ir a oficinas de Colsein
- Anticipos se legalizan máximo 3 días después del retorno
- Recibos de parqueadero necesitan: fecha, nombre, NIT, régimen, dirección, resolución facturación, valor

## Flujo de aprobaciones
Vendedor envía → Líder Regional revisa → Gerente Ventas aprueba → Control Interno audita

## API principal
- POST /api/auth/login — { email, password } → { token, user }
- GET/POST /api/kilometraje/entries — CRUD registros diarios
- POST /api/kilometraje/entries/:id/upload/:field — Subir foto soporte
- POST /api/kilometraje/reports/:id/submit — Enviar reporte
- POST /api/expenses/ocr — OCR con Claude Vision API
- GET /api/reports/kilometraje/:id/excel — Descargar Excel formato oficial

## Usuarios de prueba
- esteban.meza@colsein.co / meza2026 (Comercial)
- carlos.ramirez@colsein.co / ramirez2026 (Líder Regional)  
- biviana.baez@colsein.co / admin2026 (Admin)

## Moneda y formato
- Pesos colombianos (COP), formato $XXX.XXX (punto como separador de miles)
- Fechas en DD/MM/YYYY
- Idioma: Español (Colombia)
