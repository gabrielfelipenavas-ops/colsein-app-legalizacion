// Script de arranque de la app (externo porque la CSP de helmet bloquea inline).
// Hace dos cosas:
//
// 1. Activa las fuentes de Google sin bloquear el primer pintado: el <link>
//    llega con media="print" (no bloqueante) y aquí se cambia a "all" cuando
//    la hoja termina de cargar. Si Google Fonts no responde, la app se ve
//    igual con la fuente del sistema.
//
// 2. Red de seguridad contra la app "atascada cargando": si tras 8 segundos
//    React no montó nada en #root (típico cuando el service worker o la caché
//    del navegador sirven archivos de un despliegue anterior que ya no
//    existen), se desregistra el service worker, se borran las cachés y se
//    recarga UNA sola vez. Así el usuario se recupera solo, sin tener que
//    borrar los datos del navegador a mano.
(function () {
  // ── 1. Fuentes no bloqueantes ──
  var fuentes = document.querySelector('link[data-fuentes]');
  if (fuentes) {
    var activar = function () { fuentes.media = 'all'; };
    if (fuentes.sheet) activar();
    else fuentes.addEventListener('load', activar);
  }

  // ── 2. Auto-recuperación de caché/service worker dañados ──
  var FLAG = 'colsein_recuperacion_cache';
  setTimeout(function () {
    var root = document.getElementById('root');
    if (root && root.childElementCount > 0) return; // la app arrancó bien
    var yaIntentado = null;
    try { yaIntentado = sessionStorage.getItem(FLAG); } catch (e) {}
    if (yaIntentado) return; // ya se intentó una vez: no reiniciar en bucle
    try { sessionStorage.setItem(FLAG, '1'); } catch (e) {}

    var recargar = function () { location.reload(); };
    var tareas = [];
    if ('serviceWorker' in navigator) {
      tareas.push(
        navigator.serviceWorker.getRegistrations().then(function (regs) {
          return Promise.all(regs.map(function (r) { return r.unregister(); }));
        })
      );
    }
    if (window.caches && caches.keys) {
      tareas.push(
        caches.keys().then(function (keys) {
          return Promise.all(keys.map(function (k) { return caches.delete(k); }));
        })
      );
    }
    Promise.all(tareas).then(recargar, recargar);
  }, 8000);
})();
