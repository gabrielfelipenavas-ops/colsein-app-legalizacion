'use strict';
const bcrypt = require('bcryptjs');

module.exports = {
  async up(queryInterface) {
    const hash = (pw) => bcrypt.hashSync(pw, 12);

    // ── USERS ──
    await queryInterface.bulkInsert('users', [
      { id: 1, nombre: 'Luis Esteban Meza Ardila', cedula: '79627188', email: 'esteban.meza@colsein.co', password_hash: hash('meza2026'), rol: 'comercial', zona: 'Eje Cafetero', vehiculo_tipo: 'CARRO', placa: 'ABC123', activo: true, created_at: new Date(), updated_at: new Date() },
      { id: 2, nombre: 'Harol Herrera Diaz', cedula: '80123456', email: 'harol.herrera@colsein.co', password_hash: hash('herrera2026'), rol: 'comercial', zona: 'Bogotá', vehiculo_tipo: 'CARRO', placa: 'JNZ859', activo: true, created_at: new Date(), updated_at: new Date() },
      { id: 3, nombre: 'Juan Carlos Pinzón Rodríguez', cedula: '79628000', email: 'juan.pinzon@colsein.co', password_hash: hash('pinzon2026'), rol: 'comercial', zona: 'Antioquia', vehiculo_tipo: 'CARRO', placa: 'DEF456', activo: true, created_at: new Date(), updated_at: new Date() },
      { id: 4, nombre: 'Carlos Ramírez', cedula: '1010101010', email: 'carlos.ramirez@colsein.co', password_hash: hash('ramirez2026'), rol: 'lider_regional', zona: 'Nacional', activo: true, created_at: new Date(), updated_at: new Date() },
      { id: 5, nombre: 'Biviana Baez', cedula: '2020202020', email: 'biviana.baez@colsein.co', password_hash: hash('admin2026'), rol: 'administrador', zona: 'Nacional', activo: true, created_at: new Date(), updated_at: new Date() },
    ]);

    // ── CLIENTS ──
    await queryInterface.bulkInsert('clients', [
      { nombre: 'Tomy', ciudad: 'Pereira', departamento: 'Risaralda', zona: 'Eje Cafetero', activo: true, created_at: new Date(), updated_at: new Date() },
      { nombre: 'Hitachi', ciudad: 'Pereira', departamento: 'Risaralda', zona: 'Eje Cafetero', activo: true, created_at: new Date(), updated_at: new Date() },
      { nombre: 'Hitachi Dosquebradas', ciudad: 'Dosquebradas', departamento: 'Risaralda', zona: 'Eje Cafetero', activo: true, created_at: new Date(), updated_at: new Date() },
      { nombre: 'Colanta', ciudad: 'Armenia', departamento: 'Quindío', zona: 'Eje Cafetero', activo: true, created_at: new Date(), updated_at: new Date() },
      { nombre: 'Café Quindío', ciudad: 'Armenia', departamento: 'Quindío', zona: 'Eje Cafetero', activo: true, created_at: new Date(), updated_at: new Date() },
      { nombre: 'Suzuki', ciudad: 'Pereira', departamento: 'Risaralda', zona: 'Eje Cafetero', activo: true, created_at: new Date(), updated_at: new Date() },
      { nombre: 'Buencafé', ciudad: 'Chinchiná', departamento: 'Caldas', zona: 'Eje Cafetero', activo: true, created_at: new Date(), updated_at: new Date() },
      { nombre: 'TRULULU', ciudad: 'La Virginia', departamento: 'Risaralda', zona: 'Eje Cafetero', activo: true, created_at: new Date(), updated_at: new Date() },
      { nombre: 'SENA', ciudad: 'Manizales', departamento: 'Caldas', zona: 'Eje Cafetero', activo: true, created_at: new Date(), updated_at: new Date() },
      { nombre: 'MABE', ciudad: 'Manizales', departamento: 'Caldas', zona: 'Eje Cafetero', activo: true, created_at: new Date(), updated_at: new Date() },
      { nombre: 'MAGNETRON', ciudad: 'Pereira', departamento: 'Risaralda', zona: 'Eje Cafetero', activo: true, created_at: new Date(), updated_at: new Date() },
      { nombre: 'CEMEX', ciudad: 'Pereira', departamento: 'Risaralda', zona: 'Eje Cafetero', activo: true, created_at: new Date(), updated_at: new Date() },
      { nombre: 'ALPINA', ciudad: 'Chinchiná', departamento: 'Caldas', zona: 'Eje Cafetero', activo: true, created_at: new Date(), updated_at: new Date() },
      { nombre: 'PRODIMIN COLOMBIA SA', ciudad: 'Bogotá', departamento: 'Cundinamarca', zona: 'Bogotá', activo: true, created_at: new Date(), updated_at: new Date() },
      { nombre: 'UNIVERSIDAD NACIONAL DE COLOMBIA', ciudad: 'Bogotá', departamento: 'Cundinamarca', zona: 'Bogotá', activo: true, created_at: new Date(), updated_at: new Date() },
      { nombre: 'AL INDUSTRY SAS', ciudad: 'Bogotá', departamento: 'Cundinamarca', zona: 'Bogotá', activo: true, created_at: new Date(), updated_at: new Date() },
      { nombre: 'FIRMENICH', ciudad: 'Bogotá', departamento: 'Cundinamarca', zona: 'Bogotá', activo: true, created_at: new Date(), updated_at: new Date() },
      { nombre: 'CIPA', ciudad: 'Cartago', departamento: 'Valle del Cauca', zona: 'Eje Cafetero', activo: true, created_at: new Date(), updated_at: new Date() },
      { nombre: 'PANASA', ciudad: 'Cartago', departamento: 'Valle del Cauca', zona: 'Eje Cafetero', activo: true, created_at: new Date(), updated_at: new Date() },
      { nombre: 'PCP', ciudad: 'Pereira', departamento: 'Risaralda', zona: 'Eje Cafetero', activo: true, created_at: new Date(), updated_at: new Date() },
    ]);

    // ── SYSTEM CONFIG ──
    await queryInterface.bulkInsert('system_config', [
      { clave: 'tarifa_carro', valor: '600.65', descripcion: 'Tarifa por km para carro (COP)', updated_at: new Date() },
      { clave: 'tarifa_moto', valor: '507.03', descripcion: 'Tarifa por km para moto (COP)', updated_at: new Date() },
      { clave: 'empresa_nombre', valor: 'COLSEIN S.A.S.', descripcion: 'Razón social', updated_at: new Date() },
      { clave: 'empresa_nit', valor: '800002030', descripcion: 'NIT de la empresa', updated_at: new Date() },
      { clave: 'plazo_entrega_km', valor: '5', descripcion: 'Días calendario para entregar reporte de km', updated_at: new Date() },
      { clave: 'plazo_legalizacion', valor: '3', descripcion: 'Días hábiles para legalizar anticipo', updated_at: new Date() },
      { clave: 'banco_tc', valor: 'BANCO DE OCCIDENTE', descripcion: 'Banco tarjeta crédito corporativa', updated_at: new Date() },
      { clave: 'banco_tc_nit', valor: '890.300.279-4', descripcion: 'NIT del banco', updated_at: new Date() },
    ]);

    // ── SAMPLE KILOMETRAGE REPORT (Esteban Meza - Feb 2026) ──
    await queryInterface.bulkInsert('kilometrage_reports', [{
      id: 1, user_id: 1, periodo_mes: 2, periodo_anio: 2026, estado: 'borrador',
      total_km: 1170, total_valor_km: 754519, total_peajes: 212200, total_parqueaderos: 0, total_taxis: 0, total_otros: 0,
      valor_total: 966719, created_at: new Date(), updated_at: new Date(),
    }]);

    // Sample entries from Esteban Meza's real report
    const entries = [
      { fecha: '2026-02-03', cliente_nombre: 'Tomy', medio: 'CARRO', km_inicial: 0, km_final: 19 },
      { fecha: '2026-02-03', cliente_nombre: 'Hitachi', medio: 'CARRO', km_inicial: 19, km_final: 41 },
      { fecha: '2026-02-03', cliente_nombre: 'Hitachi Dosquebradas', medio: 'CARRO', km_inicial: 41, km_final: 57 },
      { fecha: '2026-02-04', cliente_nombre: 'Colanta', medio: 'MOTO', km_inicial: 0, km_final: 44 },
      { fecha: '2026-02-04', cliente_nombre: 'Café Quindío', medio: 'MOTO', km_inicial: 44, km_final: 54 },
      { fecha: '2026-02-04', cliente_nombre: 'Suzuki', medio: 'MOTO', km_inicial: 54, km_final: 133 },
      { fecha: '2026-02-06', cliente_nombre: 'TRULULU', medio: 'CARRO', km_inicial: 0, km_final: 77, peajes: 68000 },
      { fecha: '2026-02-12', cliente_nombre: 'SENA', medio: 'CARRO', km_inicial: 0, km_final: 84, peajes: 35600 },
      { fecha: '2026-02-12', cliente_nombre: 'MABE', medio: 'CARRO', km_inicial: 84, km_final: 160 },
      { fecha: '2026-02-17', cliente_nombre: 'FRIGORIFICO', medio: 'CARRO', km_inicial: 0, km_final: 30 },
      { fecha: '2026-02-19', cliente_nombre: 'BUENCAFE', medio: 'CARRO', km_inicial: 0, km_final: 38, peajes: 35600 },
      { fecha: '2026-02-19', cliente_nombre: 'ALPINA', medio: 'CARRO', km_inicial: 38, km_final: 79 },
      { fecha: '2026-02-25', cliente_nombre: 'BUENCAFE', medio: 'CARRO', km_inicial: 0, km_final: 38, peajes: 35600 },
      { fecha: '2026-02-25', cliente_nombre: 'MAGNETRON', medio: 'CARRO', km_inicial: 38, km_final: 87 },
    ];

    const tarifaCarro = 600.65;
    const tarifaMoto = 507.03;

    await queryInterface.bulkInsert('kilometrage_entries', entries.map((e, i) => {
      const totalKm = e.km_final - e.km_inicial;
      const tarifa = e.medio === 'CARRO' ? tarifaCarro : tarifaMoto;
      return {
        report_id: 1, user_id: 1,
        fecha: e.fecha, cliente_nombre: e.cliente_nombre, medio: e.medio,
        km_inicial: e.km_inicial, km_final: e.km_final, total_km: totalKm,
        valor_km: Math.round(totalKm * tarifa),
        peajes: e.peajes || 0, parqueaderos: 0, taxis: 0, otros: 0,
        created_at: new Date(), updated_at: new Date(),
      };
    }));
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('kilometrage_entries', null, {});
    await queryInterface.bulkDelete('kilometrage_reports', null, {});
    await queryInterface.bulkDelete('system_config', null, {});
    await queryInterface.bulkDelete('clients', null, {});
    await queryInterface.bulkDelete('users', null, {});
  },
};
