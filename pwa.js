/* Registrierung nur unter HTTPS oder localhost (nicht bei file://). */
(() => {
  'use strict';
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(error => {
      console.warn('Offline-Installation konnte nicht aktiviert werden:', error);
    });
  });
})();
