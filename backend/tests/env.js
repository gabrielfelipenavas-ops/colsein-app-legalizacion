// Variables de entorno para las pruebas (se cargan antes que la app)
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-pruebas-no-usar-en-produccion-0123456789';
process.env.UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads-test';
