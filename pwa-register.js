(function(){
  if (!('serviceWorker' in navigator)) return;
  let deferredPrompt = null;
  function btn(){ return document.getElementById('installBtn'); }
  function showInstall(show){ if (!btn()) return; btn().classList.toggle('hidden', !show); }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstall(true);
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    showInstall(false);
  });
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('./sw.js?v=51.5.0', { scope: './' });
      const installBtn = btn();
      if (installBtn) {
        installBtn.addEventListener('click', async () => {
          if (!deferredPrompt) return;
          deferredPrompt.prompt();
          try { await deferredPrompt.userChoice; } catch (e) {}
          deferredPrompt = null;
          showInstall(false);
        });
      }
    } catch (err) {
      console.error('PWA register failed', err);
    }
  });
})();
