(() => {
  const ENABLED_KEY = 'heycensorEnabled';
  const toggle = document.getElementById('enabledToggle');
  const status = document.getElementById('status');

  const renderState = (enabled) => {
    toggle.checked = Boolean(enabled);
    status.textContent = enabled ? 'Estado: Activada' : 'Estado: Desactivada';
    status.style.color = enabled ? '#86efac' : '#fca5a5';
  };

  const showError = (message) => {
    status.textContent = `Error: ${message}`;
    status.style.color = '#fca5a5';
  };

  const loadState = () => {
    chrome.storage.local.get({ [ENABLED_KEY]: true }, (result) => {
      if (chrome.runtime.lastError) {
        showError(chrome.runtime.lastError.message || 'storage get');
        return;
      }

      renderState(result[ENABLED_KEY]);
    });
  };

  toggle.addEventListener('change', () => {
    const next = toggle.checked;
    chrome.storage.local.set({ [ENABLED_KEY]: next }, () => {
      if (chrome.runtime.lastError) {
        showError(chrome.runtime.lastError.message || 'storage set');
        return;
      }

      renderState(next);
    });
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (!changes[ENABLED_KEY]) return;
    renderState(Boolean(changes[ENABLED_KEY].newValue));
  });

  loadState();
})();
