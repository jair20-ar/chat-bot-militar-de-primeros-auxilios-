const SyncEngine = {
  _isSyncing: false,
  _onlineStatus: navigator.onLine,

  init() {
    window.addEventListener('online', () => { this._onlineStatus = true; this.onStatusChange(true); this.fullSync(); });
    window.addEventListener('offline', () => { this._onlineStatus = false; this.onStatusChange(false); });
    this.updateIndicator();
  },

  isOnline() {
    return this._onlineStatus;
  },

  onStatusChange(online) {
    this.updateIndicator();
  },

  updateIndicator() {
    let indicator = document.getElementById('sync-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'sync-indicator';
      indicator.style.cssText = 'position:fixed;top:8px;right:8px;padding:4px 12px;border-radius:4px;font-size:0.7rem;font-weight:700;letter-spacing:0.08em;z-index:99999;text-transform:uppercase;font-family:Consolas,monospace;transition:all 0.3s;';
      document.body.appendChild(indicator);
    }
    if (this._onlineStatus) {
      indicator.style.background = 'rgba(0,200,83,0.15)';
      indicator.style.border = '1px solid rgba(0,200,83,0.5)';
      indicator.style.color = '#00c853';
      indicator.textContent = '● ONLINE';
    } else {
      indicator.style.background = 'rgba(255,82,82,0.15)';
      indicator.style.border = '1px solid rgba(255,82,82,0.5)';
      indicator.style.color = '#ff5252';
      indicator.textContent = '● OFFLINE';
    }
  },

  async syncAll() {
    if (this._isSyncing) return;
    this._isSyncing = true;
    try {
      const response = await fetch('/api/sync/full');
      if (!response.ok) throw new Error('Sync failed');
      const data = await response.json();
      if (data.success && data.instrucciones) {
        await LocalDB.guardarInstrucciones(data.instrucciones);
        await LocalDB.guardarUltimoSync(new Date().toISOString());
      }
    } catch (err) {
      console.error('Sync download error:', err);
    } finally {
      this._isSyncing = false;
    }
  },

  async uploadPending() {
    const cambios = await LocalDB.obtenerCambiosPendientes();
    if (cambios.length === 0) return;
    try {
      const response = await fetch('/api/sync/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes: cambios })
      });
      const data = await response.json();
      if (data.success) {
        await LocalDB.limpiarCambiosPendientes();
      }
    } catch (err) {
      console.error('Sync upload error:', err);
    }
  },

  async fullSync() {
    if (!this.isOnline()) return;
    await this.uploadPending();
    await this.syncAll();
  }
};
