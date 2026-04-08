'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // ── USERS ──
    await queryInterface.createTable('users', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      nombre: { type: Sequelize.STRING(200), allowNull: false },
      cedula: { type: Sequelize.STRING(20), allowNull: false, unique: true },
      email: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      password_hash: { type: Sequelize.STRING(255), allowNull: false },
      rol: { type: Sequelize.ENUM('comercial', 'lider_regional', 'gerente_ventas', 'control_interno', 'administrador'), allowNull: false, defaultValue: 'comercial' },
      zona: { type: Sequelize.STRING(100) },
      lider_regional_id: { type: Sequelize.INTEGER, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      vehiculo_tipo: { type: Sequelize.ENUM('CARRO', 'MOTO'), defaultValue: 'CARRO' },
      placa: { type: Sequelize.STRING(10) },
      telefono: { type: Sequelize.STRING(20) },
      activo: { type: Sequelize.BOOLEAN, defaultValue: true },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });

    // ── CLIENTS ──
    await queryInterface.createTable('clients', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      nombre: { type: Sequelize.STRING(200), allowNull: false },
      nit: { type: Sequelize.STRING(20) },
      direccion: { type: Sequelize.STRING(300) },
      ciudad: { type: Sequelize.STRING(100) },
      departamento: { type: Sequelize.STRING(100) },
      zona: { type: Sequelize.STRING(100) },
      latitud: { type: Sequelize.DECIMAL(10, 7) },
      longitud: { type: Sequelize.DECIMAL(10, 7) },
      contacto_nombre: { type: Sequelize.STRING(200) },
      contacto_telefono: { type: Sequelize.STRING(20) },
      activo: { type: Sequelize.BOOLEAN, defaultValue: true },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });

    // ── SYSTEM CONFIG ──
    await queryInterface.createTable('system_config', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      clave: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      valor: { type: Sequelize.TEXT, allowNull: false },
      descripcion: { type: Sequelize.STRING(300) },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });

    // ── KILOMETRAGE REPORTS (monthly summary) ──
    await queryInterface.createTable('kilometrage_reports', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      user_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      periodo_mes: { type: Sequelize.INTEGER, allowNull: false },
      periodo_anio: { type: Sequelize.INTEGER, allowNull: false },
      estado: { type: Sequelize.ENUM('borrador', 'enviado', 'revisado', 'aprobado', 'rechazado'), defaultValue: 'borrador' },
      total_km: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
      total_valor_km: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
      total_peajes: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
      total_parqueaderos: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
      total_taxis: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
      total_otros: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
      valor_total: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
      observaciones: { type: Sequelize.TEXT },
      revisado_por: { type: Sequelize.INTEGER, references: { model: 'users', key: 'id' } },
      aprobado_por: { type: Sequelize.INTEGER, references: { model: 'users', key: 'id' } },
      fecha_envio: { type: Sequelize.DATE },
      fecha_revision: { type: Sequelize.DATE },
      fecha_aprobacion: { type: Sequelize.DATE },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.addIndex('kilometrage_reports', ['user_id', 'periodo_mes', 'periodo_anio'], { unique: true });

    // ── KILOMETRAGE ENTRIES (daily records) ──
    await queryInterface.createTable('kilometrage_entries', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      report_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'kilometrage_reports', key: 'id' }, onDelete: 'CASCADE' },
      user_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      fecha: { type: Sequelize.DATEONLY, allowNull: false },
      client_id: { type: Sequelize.INTEGER, references: { model: 'clients', key: 'id' } },
      cliente_nombre: { type: Sequelize.STRING(200), allowNull: false },
      medio: { type: Sequelize.ENUM('CARRO', 'MOTO'), allowNull: false },
      km_inicial: { type: Sequelize.DECIMAL(10, 1), allowNull: false, defaultValue: 0 },
      km_final: { type: Sequelize.DECIMAL(10, 1), allowNull: false, defaultValue: 0 },
      total_km: { type: Sequelize.DECIMAL(10, 1), defaultValue: 0 },
      valor_km: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
      peajes: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
      parqueaderos: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
      taxis: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
      taxi_tipo: { type: Sequelize.STRING(50) },
      taxi_origen: { type: Sequelize.STRING(200) },
      taxi_destino: { type: Sequelize.STRING(200) },
      otros: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
      // GPS
      origen_lat: { type: Sequelize.DECIMAL(10, 7) },
      origen_lng: { type: Sequelize.DECIMAL(10, 7) },
      destino_lat: { type: Sequelize.DECIMAL(10, 7) },
      destino_lng: { type: Sequelize.DECIMAL(10, 7) },
      distancia_api: { type: Sequelize.DECIMAL(10, 2) },
      // Photo references
      peaje_foto: { type: Sequelize.STRING(500) },
      parqueadero_foto: { type: Sequelize.STRING(500) },
      taxi_foto: { type: Sequelize.STRING(500) },
      otros_foto: { type: Sequelize.STRING(500) },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.addIndex('kilometrage_entries', ['user_id', 'fecha']);
    await queryInterface.addIndex('kilometrage_entries', ['report_id']);

    // ── TRAVEL REQUESTS (Anticipos) ──
    await queryInterface.createTable('travel_requests', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      user_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      consecutivo: { type: Sequelize.STRING(20), allowNull: false, unique: true },
      destino_tipo: { type: Sequelize.ENUM('NACIONAL', 'INTERNACIONAL'), defaultValue: 'NACIONAL' },
      motivo: { type: Sequelize.TEXT, allowNull: false },
      proceso: { type: Sequelize.STRING(100) },
      ciudad_destino: { type: Sequelize.STRING(100), allowNull: false },
      fecha_ida: { type: Sequelize.DATEONLY, allowNull: false },
      fecha_regreso: { type: Sequelize.DATEONLY, allowNull: false },
      duracion_dias: { type: Sequelize.INTEGER },
      // Budget per day
      alojamiento_dia: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
      alimentacion_dia: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
      transportes_dia: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
      imprevistos_dia: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
      representacion_dia: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
      presupuesto_total: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
      anticipo_total: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
      estado: { type: Sequelize.ENUM('borrador', 'enviado', 'aprobado', 'rechazado', 'anticipo_girado', 'legalizado'), defaultValue: 'borrador' },
      aprobado_por: { type: Sequelize.INTEGER, references: { model: 'users', key: 'id' } },
      acepta_terminos: { type: Sequelize.BOOLEAN, defaultValue: false },
      fecha_solicitud: { type: Sequelize.DATEONLY },
      fecha_aprobacion: { type: Sequelize.DATE },
      observaciones: { type: Sequelize.TEXT },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });

    // ── EXPENSE LEGALIZATIONS ──
    await queryInterface.createTable('expense_legalizations', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      travel_request_id: { type: Sequelize.INTEGER, references: { model: 'travel_requests', key: 'id' }, onDelete: 'SET NULL' },
      user_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      ciudades_visitadas: { type: Sequelize.TEXT },
      moneda: { type: Sequelize.STRING(10), defaultValue: 'COP' },
      gasto_real_total: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
      valor_anticipo: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
      pago_favor_empresa: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
      pago_favor_empleado: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
      estado: { type: Sequelize.ENUM('borrador', 'enviado', 'revisado', 'aprobado', 'rechazado'), defaultValue: 'borrador' },
      revisado_por: { type: Sequelize.INTEGER, references: { model: 'users', key: 'id' } },
      aprobado_por: { type: Sequelize.INTEGER, references: { model: 'users', key: 'id' } },
      observaciones_imprevistos: { type: Sequelize.TEXT },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });

    // ── EXPENSES (individual receipts/invoices) ──
    await queryInterface.createTable('expenses', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      user_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      legalization_id: { type: Sequelize.INTEGER, references: { model: 'expense_legalizations', key: 'id' }, onDelete: 'SET NULL' },
      kilometrage_entry_id: { type: Sequelize.INTEGER, references: { model: 'kilometrage_entries', key: 'id' }, onDelete: 'SET NULL' },
      categoria: { type: Sequelize.ENUM('alojamiento', 'alimentacion', 'transportes', 'imprevistos', 'representacion', 'peaje', 'parqueadero', 'taxi', 'otro'), allowNull: false },
      fecha: { type: Sequelize.DATEONLY, allowNull: false },
      establecimiento: { type: Sequelize.STRING(300) },
      nit_establecimiento: { type: Sequelize.STRING(20) },
      direccion: { type: Sequelize.STRING(300) },
      valor: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      iva: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0 },
      medio_pago: { type: Sequelize.ENUM('efectivo', 'tarjeta_debito', 'tarjeta_credito'), defaultValue: 'efectivo' },
      numero_factura: { type: Sequelize.STRING(50) },
      cufe: { type: Sequelize.STRING(200) },
      imagen_url: { type: Sequelize.STRING(500) },
      imagen_thumbnail: { type: Sequelize.STRING(500) },
      datos_ocr: { type: Sequelize.JSONB },
      validado: { type: Sequelize.BOOLEAN, defaultValue: false },
      observaciones: { type: Sequelize.TEXT },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.addIndex('expenses', ['user_id', 'fecha']);
    await queryInterface.addIndex('expenses', ['legalization_id']);

    // ── APPROVALS ──
    await queryInterface.createTable('approvals', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tipo: { type: Sequelize.ENUM('kilometraje', 'anticipo', 'legalizacion'), allowNull: false },
      referencia_id: { type: Sequelize.INTEGER, allowNull: false },
      aprobador_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
      rol_aprobador: { type: Sequelize.STRING(50) },
      estado: { type: Sequelize.ENUM('aprobado', 'rechazado'), allowNull: false },
      comentarios: { type: Sequelize.TEXT },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });

    // ── CREDIT CARD TRANSACTIONS ──
    await queryInterface.createTable('credit_card_transactions', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      user_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      expense_id: { type: Sequelize.INTEGER, references: { model: 'expenses', key: 'id' }, onDelete: 'SET NULL' },
      travel_request_id: { type: Sequelize.INTEGER, references: { model: 'travel_requests', key: 'id' }, onDelete: 'SET NULL' },
      fecha: { type: Sequelize.DATEONLY, allowNull: false },
      numero_documento: { type: Sequelize.STRING(50) },
      pagado_a: { type: Sequelize.STRING(300) },
      nit: { type: Sequelize.STRING(20) },
      concepto: { type: Sequelize.STRING(200) },
      descripcion_zona: { type: Sequelize.STRING(200) },
      categoria: { type: Sequelize.STRING(50) },
      numero_viaje: { type: Sequelize.INTEGER },
      valor: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('credit_card_transactions');
    await queryInterface.dropTable('approvals');
    await queryInterface.dropTable('expenses');
    await queryInterface.dropTable('expense_legalizations');
    await queryInterface.dropTable('travel_requests');
    await queryInterface.dropTable('kilometrage_entries');
    await queryInterface.dropTable('kilometrage_reports');
    await queryInterface.dropTable('system_config');
    await queryInterface.dropTable('clients');
    await queryInterface.dropTable('users');
  },
};
