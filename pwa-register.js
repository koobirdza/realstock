(function () {
  if (!('serviceWorker' in navigator)) return;

  const SW_URL = './sw.js?v=51.4.3';
  let deferredPrompt = null;
  let refreshing = false;

  function qs(id) {
    return document.getElementById(id);
  }

  function setInstallReady(isReady) {
    const btn = qs('installBtn');
    if (!btn) return;
    btn.classList.toggle('hidden', !isReady);
    btn.disabled = !isReady;
  }

  async function clearOldServiceWorkers() {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        const script = (reg.active && reg.active.scriptURL) || (reg.waiting && reg.waiting.scriptURL) || (reg.installing && reg.installing.scriptURL) || '';
        if (!script.includes('/sw.js')) continue;
        if (!script.includes('v=51.4.3')) {
          await reg.unregister();
        }
      }
    } catch (err) {
      console.warn('Old service worker cleanup failed:', err);
    }
  }

  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredPrompt = event;
    setInstallReady(true);
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    setInstallReady(false);
  });

  window.addEventListener('load', async function () {
    await clearOldServiceWorkers();

    try {
      const reg = await navigator.serviceWorker.register(SW_URL, { scope: './' });

      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      reg.addEventListener('updatefound', function () {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', function () {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      setInterval(function () {
        reg.update();
      }, 60000);
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  });

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
