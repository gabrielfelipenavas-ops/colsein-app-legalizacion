# COLSEIN S.A.S. — Sistema de Gestión de Gastos y Kilometraje

Sistema web responsive (mobile-first) para digitalizar el proceso de reporte de gastos de transporte y viáticos de la empresa COLSEIN S.A.S.

## Arquitectura

```
colsein-app/
├── backend/          # API REST — Node.js + Express + PostgreSQL
│   ├── src/
│   │   ├── routes/   # Endpoints por módulo
│   │   ├── middleware/# Auth, uploads, validaciones
│   │   ├── models/   # Modelos Sequelize (ORM)
│   │   ├── services/ # Lógica de negocio (OCR, Excel, cálculos)
│   │   └── utils/    # Helpers, constantes
│   ├── migrations/   # Migraciones de BD
│   ├── seeds/        # Datos de ejemplo
│   └── config/       # Configuración de BD y app
├── frontend/         # SPA — React + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/ # Componentes reutilizables
│   │   ├── pages/      # Pantallas por módulo
│   │   ├── hooks/      # Custom hooks
│   │   ├── services/   # API client (axios)
│   │   ├── context/    # Auth, App state
│   │   └── utils/      # Helpers
│   └── public/
└── docker-compose.yml  # PostgreSQL + pgAdmin
```

## Requisitos previos

- Node.js >= 18
- PostgreSQL >= 15 (o Docker)
- npm >= 9

## Instalación rápida

```bash
# 1. Clonar e instalar dependencias
cd colsein-app
npm install           # instala dependencias raíz (concurrently)
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# 2. Levantar PostgreSQL con Docker (opcional)
docker-compose up -d

# 3. Configurar variables de entorno
cp backend/.env.example backend/.env
# Editar backend/.env con tus credenciales de BD

# 4. Ejecutar migraciones y seeds
cd backend
npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all
cd ..

# 5. Iniciar en modo desarrollo (backend + frontend simultáneos)
npm run dev
```

## URLs de desarrollo

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001/api
- **pgAdmin**: http://localhost:5050 (admin@colsein.co / admin123)

## Usuarios de prueba (seed)

| Email | Contraseña | Rol |
|---|---|---|
| esteban.meza@colsein.co | meza2026 | Comercial |
| harol.herrera@colsein.co | herrera2026 | Comercial |
| juan.pinzon@colsein.co | pinzon2026 | Comercial |
| carlos.ramirez@colsein.co | ramirez2026 | Líder Regional |
| biviana.baez@colsein.co | admin2026 | Administrador |

## Módulos

1. **Kilometraje** — Registro diario con GPS, cálculo automático, fotos de soportes
2. **Facturas OCR** — Escaneo inteligente con Claude Vision API
3. **Anticipos** — Solicitud y aprobación de viáticos
4. **Legalizaciones** — Legalización de gastos post-viaje
5. **Tarjeta Crédito** — Control de gastos corporativos
6. **Reportes** — Dashboard, exportación Excel/PDF
7. **Admin** — Usuarios, tarifas, clientes, zonas

## Variables de entorno (backend/.env)

```env
PORT=3001
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=colsein_gastos
DB_USER=postgres
DB_PASS=postgres
JWT_SECRET=colsein-secret-change-in-production
JWT_EXPIRES_IN=7d
ANTHROPIC_API_KEY=sk-ant-...    # Para OCR con Claude Vision
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

## Scripts disponibles

```bash
# Raíz
npm run dev          # Backend + Frontend simultáneos
npm run backend      # Solo backend
npm run frontend     # Solo frontend

# Backend
npm run dev          # nodemon
npm run start        # producción
npm run migrate      # ejecutar migraciones
npm run seed         # cargar datos de ejemplo
npm run migrate:undo # revertir última migración

# Frontend
npm run dev          # Vite dev server
npm run build        # Build para producción
npm run preview      # Preview del build
```

## Tecnologías

**Backend**: Node.js, Express, Sequelize ORM, PostgreSQL, JWT, Multer, Sharp, ExcelJS
**Frontend**: React 18, Vite, Tailwind CSS, Axios, React Router, Lucide Icons, React Hook Form
**Infraestructura**: Docker Compose, pgAdmin
