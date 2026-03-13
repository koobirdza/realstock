(function () {
  if (!('serviceWorker' in navigator)) return;

  const SW_URL = './sw.js?v=51.4.6';
  const APP_MARKER = 'realstock-v51-4-6';
  let deferredPrompt = null;

  function qs(id) {
    return document.getElementById(id);
  }

  function setInstallReady(isReady) {
    const btn = qs('installBtn');
    if (!btn) return;
    btn.classList.toggle('hidden', !isReady);
    btn.disabled = !isReady;
  }

  async function cleanupLegacyWorkers() {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        const script =
          (reg.active && reg.active.scriptURL) ||
          (reg.waiting && reg.waiting.scriptURL) ||
          (reg.installing && reg.installing.scriptURL) ||
          '';
        if (!script.includes('/sw.js')) continue;
        if (script.includes('?v=')) {
          await reg.unregister();
        }
      }
    } catch (err) {
      console.warn('Legacy service worker cleanup failed:', err);
    }
  }

  async function registerOnce() {
    try {
      await cleanupLegacyWorkers();
      const reg = await navigator.serviceWorker.register(SW_URL, { scope: './' });
      window.__realstockSwRegistration = reg;
      document.documentElement.setAttribute('data-pwa', APP_MARKER);
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredPrompt = event;
    setInstallReady(true);
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    setInstallReady(false);
  });

  window.addEventListener('load', function () {
    registerOnce();
  }, { once: true });

  document.addEventListener('click', async function (event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.id !== 'installBtn') return;
    if (!deferredPrompt) return;

    try {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } catch (err) {
      console.warn('Install prompt failed:', err);
    } finally {
      deferredPrompt = null;
      setInstallReady(false);
    }
  });
})();