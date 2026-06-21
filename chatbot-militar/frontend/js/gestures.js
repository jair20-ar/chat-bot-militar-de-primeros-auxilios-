const API_URL = 'http://localhost:3001';

let gesturePoints = [];
let isDrawing = false;
let canvas = null;
let ctx = null;
let menu = null;

// --- CONFIGURACIÓN DE NAVEGACIÓN COMPATIBLE ---
function navigateTo(path) {
  if (path === '/') {
    window.location.href = 'index.html';
  } else {
    // Remueve barra diagonal inicial para evitar fallos de protocolo local
    window.location.href = path.replace(/^\//, '');
  }
}

// --- CONFIGURACIÓN DE CANVAS TÁCTICO ---
function ensureCanvas() {
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'gesture-canvas';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '99999999';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
  }
}

function startDrawing(x, y) {
  ensureCanvas();
  gesturePoints = [{ x, y, time: Date.now() }];
  isDrawing = true;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function addPoint(x, y) {
  gesturePoints.push({ x, y, time: Date.now() });
}

function drawTrail() {
  if (!canvas || !ctx || gesturePoints.length < 2) return;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Estilo de rayo láser táctico neon
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // Brillo exterior
  ctx.shadowBlur = 12;
  ctx.shadowColor = '#00ffa3';
  ctx.strokeStyle = '#00ffa3';
  ctx.lineWidth = 4;
  
  ctx.beginPath();
  ctx.moveTo(gesturePoints[0].x, gesturePoints[0].y);
  for (let i = 1; i < gesturePoints.length; i++) {
    ctx.lineTo(gesturePoints[i].x, gesturePoints[i].y);
  }
  ctx.stroke();
  
  // Capa externa translúcida para mayor grosor visual
  ctx.shadowBlur = 24;
  ctx.shadowColor = 'rgba(0, 255, 163, 0.4)';
  ctx.strokeStyle = 'rgba(0, 255, 163, 0.25)';
  ctx.lineWidth = 10;
  ctx.stroke();
}

function fadeTrail() {
  if (!canvas || !ctx || gesturePoints.length === 0) return;
  
  const fadeDuration = 250;
  const startTime = Date.now();
  
  function anim() {
    const elapsed = Date.now() - startTime;
    const progress = elapsed / fadeDuration;
    
    if (progress >= 1.0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      gesturePoints = [];
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.globalAlpha = 1.0 - progress;
      
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#00ffa3';
      ctx.strokeStyle = '#00ffa3';
      ctx.lineWidth = 4;
      
      ctx.beginPath();
      ctx.moveTo(gesturePoints[0].x, gesturePoints[0].y);
      for (let i = 1; i < gesturePoints.length; i++) {
        ctx.lineTo(gesturePoints[i].x, gesturePoints[i].y);
      }
      ctx.stroke();
      ctx.restore();
      
      requestAnimationFrame(anim);
    }
  }
  anim();
}

// --- ALGORITMO DE RECONOCIMIENTO DE GESTOS ---
function recognizeGesture() {
  if (gesturePoints.length < 5) return null;
  
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  gesturePoints.forEach(p => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });
  
  const width = maxX - minX;
  const height = maxY - minY;
  const diagonal = Math.hypot(width, height);
  
  if (diagonal < 35) return null; // Ignorar movimientos insignificantes
  
  const directions = [];
  let prevPoint = gesturePoints[0];
  const segmentMinDist = 25; // Distancia mínima para considerar cambio de vector
  
  for (let i = 1; i < gesturePoints.length; i++) {
    const p = gesturePoints[i];
    const dx = p.x - prevPoint.x;
    const dy = p.y - prevPoint.y;
    const dist = Math.hypot(dx, dy);
    
    if (dist >= segmentMinDist) {
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      let dir = '';
      
      if (angle >= -45 && angle < 45) dir = 'R'; // Derecha
      else if (angle >= 45 && angle < 135) dir = 'D'; // Abajo
      else if (angle >= -135 && angle < -45) dir = 'U'; // Arriba
      else dir = 'L'; // Izquierda
      
      if (directions.length === 0 || directions[directions.length - 1] !== dir) {
        directions.push(dir);
      }
      prevPoint = p;
    }
  }
  
  if (directions.length === 0) return null;
  const gestureStr = directions.join('');
  
  // Diccionario de gestos
  if (gestureStr === 'L') {
    return { name: 'Volver a Inicio (HUD)', action: () => navigateTo('/') };
  }
  if (gestureStr === 'R') {
    return { name: 'Ir al Buscador', action: () => navigateTo('/buscador.html') };
  }
  if (gestureStr === 'U') {
    return { name: 'Subir Página', action: () => window.scrollTo({ top: 0, behavior: 'smooth' }) };
  }
  if (gestureStr === 'D') {
    return { name: 'Bajar Página', action: () => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }) };
  }
  if (gestureStr === 'DR') {
    return { name: 'Cerrar Sesión / Salir', action: () => handleLogout() };
  }
  if (gestureStr === 'RDL' || gestureStr === 'LDR' || gestureStr === 'URD' || gestureStr === 'DLUR') {
    return { name: 'Alternar Tema Claro/Oscuro', action: () => toggleTheme() };
  }
  
  return null;
}

// --- MENÚ CONTEXTUAL TÁCTICO CUSTOM ---
function ensureMenu() {
  if (menu) return;
  
  menu = document.createElement('div');
  menu.id = 'tactical-context-menu';
  
  const style = document.createElement('style');
  style.innerHTML = `
    #tactical-context-menu {
      position: absolute;
      background: rgba(10, 16, 26, 0.96);
      border: 1px solid rgba(0, 229, 255, 0.4);
      box-shadow: 0 0 20px rgba(0, 229, 255, 0.2), inset 0 0 10px rgba(0, 229, 255, 0.08);
      border-radius: 8px;
      padding: 6px 0;
      width: 220px;
      z-index: 100000000;
      display: none;
      font-family: 'Segoe UI', system-ui, sans-serif;
      backdrop-filter: blur(10px);
      animation: menuFadeIn 0.12s ease-out;
    }
    
    @keyframes menuFadeIn {
      from { opacity: 0; transform: scale(0.96) translateY(-4px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    
    .context-menu-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 18px;
      color: #8b93a7;
      font-size: 0.82rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      cursor: pointer;
      transition: all 0.15s ease;
      text-transform: uppercase;
      border-left: 3px solid transparent;
    }
    
    .context-menu-item:hover {
      color: #00e5ff;
      background: rgba(0, 229, 255, 0.08);
      border-left: 3px solid #00e5ff;
      padding-left: 21px;
    }
    
    .context-menu-divider {
      height: 1px;
      background: rgba(0, 229, 255, 0.15);
      margin: 4px 0;
    }
    
    .gesture-toast {
      position: fixed;
      bottom: 90px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(8, 16, 15, 0.98);
      border: 1px solid #00ffa3;
      box-shadow: 0 0 20px rgba(0, 255, 163, 0.35);
      border-radius: 6px;
      padding: 12px 24px;
      color: #00ffa3;
      font-weight: 700;
      font-size: 0.85rem;
      letter-spacing: 0.12em;
      z-index: 100000001;
      pointer-events: none;
      text-transform: uppercase;
      font-family: 'Consolas', monospace;
      animation: toastFadeIn 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards;
    }
    
    @keyframes toastFadeIn {
      from { opacity: 0; transform: translate(-50%, 15px) scale(0.9); }
      to { opacity: 1; transform: translate(-50%, 0) scale(1); }
    }
    
    .gesture-toast.fade-out {
      animation: toastFadeOut 0.18s ease-in forwards;
    }
    
    @keyframes toastFadeOut {
      from { opacity: 1; transform: translate(-50%, 0) scale(1); }
      to { opacity: 0; transform: translate(-50%, -15px) scale(0.95); }
    }
  `;
  document.head.appendChild(style);
  
  updateMenuOptions();
  document.body.appendChild(menu);
  
  document.addEventListener('mousedown', (e) => {
    if (menu && !menu.contains(e.target) && e.button !== 2) {
      hideMenu();
    }
  });
}

function updateMenuOptions() {
  if (!menu) return;
  
  const isAdmin = localStorage.getItem('adminToken') === 'true';
  const isMedico = localStorage.getItem('medicoData') !== null;
  
  let userSection = '';
  if (isAdmin) {
    userSection = `<div class="context-menu-item" onclick="window.gestures.nav('/admin.html')">⚙️ Panel Admin</div>`;
  } else if (isMedico) {
    userSection = `<div class="context-menu-item" onclick="window.gestures.nav('/panel.html')">🩺 Panel Médico</div>`;
  } else {
    userSection = `
      <div class="context-menu-item" onclick="window.gestures.nav('/medicos.html')">🩺 Acceso Médico</div>
      <div class="context-menu-item" onclick="window.gestures.nav('/login_admin.html')">⚙️ Acceso Admin</div>
    `;
  }
  
  menu.innerHTML = `
    <div class="context-menu-item" onclick="window.gestures.nav('/')">🏠 Inicio (HUD)</div>
    <div class="context-menu-divider"></div>
    ${userSection}
    <div class="context-menu-item" onclick="window.gestures.toggleTheme()">🌓 Alternar Tema</div>
    ${(isAdmin || isMedico) ? `
      <div class="context-menu-divider"></div>
      <div class="context-menu-item" onclick="window.gestures.logout()">🚪 Cerrar Sesión</div>
    ` : ''}
  `;
}

function showMenu(x, y) {
  ensureMenu();
  updateMenuOptions();
  
  const menuWidth = 220;
  const menuHeight = menu.offsetHeight || 180;
  
  let left = x + window.scrollX;
  let top = y + window.scrollY;
  
  if (x + menuWidth > window.innerWidth) {
    left = window.innerWidth - menuWidth - 10 + window.scrollX;
  }
  if (y + menuHeight > window.innerHeight) {
    top = window.innerHeight - menuHeight - 10 + window.scrollY;
  }
  
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.style.display = 'block';
}

function hideMenu() {
  if (menu) menu.style.display = 'none';
}

// --- HUD TOAST OVERLAYS ---
function showToast(message) {
  const existing = document.querySelector('.gesture-toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = 'gesture-toast';
  toast.innerText = `GESTO: ${message}`;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 200);
  }, 1600);
}

// --- ACCIONES GENERALES ---
function updateThemeIcons(theme) {
  const sunPath = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>';
  const moonPath = '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>';
  const iconContent = theme === 'light' ? moonPath : sunPath;

  // Actualizar por ID
  const themeToggleIcon = document.getElementById('themeIcon');
  if (themeToggleIcon) {
    themeToggleIcon.innerHTML = iconContent;
  }
  
  // Actualizar cualquier SVG dentro de los botones de tema
  const themeButtons = document.querySelectorAll('.theme-btn svg, .theme-toggle svg, #themeToggle svg, .top-right-btn svg');
  themeButtons.forEach(svg => {
    svg.innerHTML = iconContent;
  });
}

function toggleTheme() {
  const body = document.body;
  const currentTheme = body.getAttribute('data-theme') || 'dark';
  const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
  body.setAttribute('data-theme', nextTheme);
  localStorage.setItem('theme', nextTheme);
  
  updateThemeIcons(nextTheme);
  showToast(`TEMA ${nextTheme.toUpperCase()}`);
}


function handleLogout() {
  localStorage.removeItem('adminToken');
  localStorage.removeItem('medicoData');
  showToast('CERRANDO SESIÓN...');
  setTimeout(() => navigateTo('/'), 600);
}

// --- ARRRASTRE PARA SCROLL (DRAG SCROLL) ---
function initDragScroll() {
  const scrollContainers = document.querySelectorAll('.drag-scroll');
  
  scrollContainers.forEach(container => {
    let isDown = false;
    let startX, startY;
    let scrollLeft, scrollTop;
    
    container.style.cursor = 'grab';
    container.style.userSelect = 'none';
    
    container.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Solo click izquierdo
      isDown = true;
      container.style.cursor = 'grabbing';
      startX = e.pageX - container.offsetLeft;
      startY = e.pageY - container.offsetTop;
      scrollLeft = container.scrollLeft;
      scrollTop = container.scrollTop;
    });
    
    container.addEventListener('mouseleave', () => {
      isDown = false;
      container.style.cursor = 'grab';
    });
    
    container.addEventListener('mouseup', () => {
      isDown = false;
      container.style.cursor = 'grab';
    });
    
    container.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - container.offsetLeft;
      const y = e.pageY - container.offsetTop;
      const walkX = (x - startX) * 1.5; // Multiplicador de velocidad de scroll horizontal
      const walkY = (y - startY) * 1.5; // Multiplicador de velocidad de scroll vertical
      container.scrollLeft = scrollLeft - walkX;
      container.scrollTop = scrollTop - walkY;
    });
  });
}

// --- REGISTRO DE EVENTOS GLOBALES ---
document.addEventListener('DOMContentLoaded', () => {
  // --- INICIALIZACIÓN DE TEMA ---
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.body.setAttribute('data-theme', savedTheme);
  updateThemeIcons(savedTheme);

  // Vincular eventos click a todos los botones físicos de cambio de tema
  const themeSelectors = '.theme-btn, .theme-toggle, #themeToggle, .top-right-btn';
  document.querySelectorAll(themeSelectors).forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      toggleTheme();
    });
  });

  // Buscar botones con clase icon-btn que contengan el SVG de themeIcon
  document.querySelectorAll('.icon-btn').forEach(btn => {
    if (btn.querySelector('#themeIcon') && !btn.getAttribute('data-theme-bound')) {
      btn.setAttribute('data-theme-bound', 'true');
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        toggleTheme();
      });
    }
  });

  initDragScroll();
  
  let rightClickDown = false;
  let dragStarted = false;
  let startX = 0;
  let startY = 0;
  
  window.addEventListener('mousedown', (e) => {
    if (e.button === 2) {
      rightClickDown = true;
      dragStarted = false;
      startX = e.clientX;
      startY = e.clientY;
    }
  });
  
  window.addEventListener('mousemove', (e) => {
    if (rightClickDown) {
      const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
      if (dist > 8) {
        if (!dragStarted) {
          dragStarted = true;
          startDrawing(startX, startY);
        }
        addPoint(e.clientX, e.clientY);
        drawTrail();
      }
    }
  });
  
  window.addEventListener('mouseup', (e) => {
    if (e.button === 2 && rightClickDown) {
      rightClickDown = false;
      if (!dragStarted) {
        hideMenu();
        showMenu(startX, startY);
      } else {
        isDrawing = false;
        const gesture = recognizeGesture();
        if (gesture) {
          showToast(gesture.name);
          setTimeout(() => {
            gesture.action();
          }, 350);
        }
        fadeTrail();
      }
    }
  });
  
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });
});

// Registrar en el espacio de nombres global
window.gestures = {
  nav: navigateTo,
  toggleTheme: toggleTheme,
  logout: handleLogout
};
