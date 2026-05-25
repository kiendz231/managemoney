// Main Application Entry Point
import './styles/index.css';
import './styles/components.css';
import './styles/pages.css';
import './styles/responsive.css';
import './styles/liquid-glass.css';

import { createIcons, icons } from 'lucide';
import { observeAuthState, signInWithEmail, signUpWithEmail, signInWithGoogle } from './auth.js';
import { setUserId } from './store.js';
import { initModal } from './components/modal.js';
import { showToast } from './components/toast.js';
import { openTransactionForm } from './components/transaction-form.js';
import { initLiquidGlass } from './components/liquid-glass.js';

import { renderDashboard, destroyDashboard } from './pages/dashboard.js';
import { renderTransactions, destroyTransactions } from './pages/transactions.js';
import { renderInstallments, destroyInstallments } from './pages/installments.js';
import { renderReports, destroyReports } from './pages/reports.js';
import { renderSettings, destroySettings } from './pages/settings.js';

// ---- State ----
let currentPage = 'dashboard';
let currentUser = null;

// ---- Init ----
function init() {
  // Apply saved theme
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  // Init icons
  createIcons({ icons });

  // Init modal
  initModal();

  // Init liquid glass ambient bubbles
  initLiquidGlass();

  // Auth observer
  observeAuthState((user) => {
    currentUser = user;
    if (user) {
      setUserId(user.uid);
      showMainApp(user);
    } else {
      setUserId(null);
      showLoginScreen();
    }
  });

  // Setup login handlers
  setupLoginHandlers();

  // Setup navigation
  setupNavigation();

  // Setup FABs
  setupFABs();
}

// ---- Login Screen ----
function showLoginScreen() {
  document.getElementById('login-form-container').classList.remove('hidden');
  document.getElementById('login-loading').classList.add('hidden');
  document.getElementById('login-screen').classList.add('active');
  document.getElementById('main-app').classList.remove('active');
}

function showMainApp(user) {
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('main-app').classList.add('active');

  // Update user info in sidebar
  const name = user.displayName || user.email?.split('@')[0] || 'User';
  document.getElementById('sidebar-username').textContent = name;
  document.getElementById('sidebar-email').textContent = user.email || '';
  document.getElementById('sidebar-avatar').textContent = name.charAt(0).toUpperCase();

  // Navigate to current page
  navigateTo(currentPage);
}

function setupLoginHandlers() {
  // Tab switching
  const tabSignin = document.getElementById('tab-signin');
  const tabSignup = document.getElementById('tab-signup');
  const signinForm = document.getElementById('email-signin-form');
  const signupForm = document.getElementById('email-signup-form');

  tabSignin.addEventListener('click', () => {
    tabSignin.classList.add('active');
    tabSignup.classList.remove('active');
    signinForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
  });

  tabSignup.addEventListener('click', () => {
    tabSignup.classList.add('active');
    tabSignin.classList.remove('active');
    signupForm.classList.remove('hidden');
    signinForm.classList.add('hidden');
  });

  // Email sign in
  signinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signin-email').value;
    const password = document.getElementById('signin-password').value;
    showLoginLoading();
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      hideLoginLoading();
      console.error('Sign in error:', err);
      showToast(getAuthErrorMessage(err.code, err), 'error');
    }
  });

  // Email sign up
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    showLoginLoading();
    try {
      await signUpWithEmail(email, password, name);
    } catch (err) {
      hideLoginLoading();
      console.error('Sign up error:', err);
      showToast(getAuthErrorMessage(err.code, err), 'error');
    }
  });

  // Google sign in
  document.getElementById('btn-google-signin').addEventListener('click', async () => {
    showLoginLoading();
    try {
      await signInWithGoogle();
    } catch (err) {
      hideLoginLoading();
      console.error('Google sign in error:', err);
      if (err.code !== 'auth/popup-closed-by-user') {
        showToast(getAuthErrorMessage(err.code, err), 'error');
      }
    }
  });
}

function showLoginLoading() {
  document.getElementById('login-form-container').classList.add('hidden');
  document.getElementById('login-loading').classList.remove('hidden');
}

function hideLoginLoading() {
  document.getElementById('login-form-container').classList.remove('hidden');
  document.getElementById('login-loading').classList.add('hidden');
}

function getAuthErrorMessage(code, err) {
  const messages = {
    'auth/invalid-email': 'Email không hợp lệ',
    'auth/user-disabled': 'Tài khoản đã bị vô hiệu hóa',
    'auth/user-not-found': 'Không tìm thấy tài khoản',
    'auth/wrong-password': 'Mật khẩu không đúng',
    'auth/invalid-credential': 'Thông tin đăng nhập không hợp lệ',
    'auth/email-already-in-use': 'Email đã được sử dụng',
    'auth/weak-password': 'Mật khẩu quá yếu (tối thiểu 6 ký tự)',
    'auth/too-many-requests': 'Quá nhiều lần thử. Vui lòng thử lại sau',
    'auth/network-request-failed': 'Lỗi kết nối mạng',
    'auth/popup-blocked': 'Popup bị chặn. Vui lòng cho phép popup',
    'auth/operation-not-allowed': 'Đăng ký bằng Email/Mật khẩu chưa được kích hoạt trong Firebase Console',
  };
  if (messages[code]) return messages[code];
  return `Có lỗi xảy ra (${code || err?.message || 'unknown'}). Vui lòng thử lại`;
}

// ---- Navigation ----
const pageTitles = {
  dashboard: 'Tổng quan',
  transactions: 'Giao dịch',
  installments: 'Trả góp',
  reports: 'Báo cáo',
  settings: 'Cài đặt',
};

const pageRenderers = {
  dashboard: renderDashboard,
  transactions: renderTransactions,
  installments: renderInstallments,
  reports: renderReports,
  settings: renderSettings,
};

const pageDestroyers = {
  dashboard: destroyDashboard,
  transactions: destroyTransactions,
  installments: destroyInstallments,
  reports: destroyReports,
  settings: destroySettings,
};

function updateBottomNavIndicator() {
  const activeItem = document.querySelector('.bottom-nav-item.active');
  const indicator = document.getElementById('bottom-nav-indicator');
  const nav = document.getElementById('bottom-nav');
  if (activeItem && indicator && nav && window.getComputedStyle(nav).display !== 'none') {
    const rect = activeItem.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    const left = rect.left - navRect.left + (rect.width - 48) / 2;
    const top = rect.top - navRect.top + (rect.height - 48) / 2;
    indicator.style.transform = `translate(${left}px, ${top}px)`;
    indicator.style.opacity = '1';
  } else if (indicator) {
    indicator.style.opacity = '0';
  }
}

function navigateTo(page) {
  // Destroy previous page
  if (pageDestroyers[currentPage]) {
    pageDestroyers[currentPage]();
  }

  currentPage = page;

  // Update title
  document.getElementById('topbar-title').textContent = pageTitles[page] || 'Tổng quan';

  // Update active nav items
  document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // Update bottom nav sliding indicator
  setTimeout(updateBottomNavIndicator, 0);

  // Render page
  const container = document.getElementById('page-container');
  container.innerHTML = '';
  container.scrollTop = 0;

  if (pageRenderers[page]) {
    pageRenderers[page](container);
  }

  // Close sidebar on mobile
  closeSidebar();

  // Re-create icons
  createIcons({ icons });
}

function setupNavigation() {
  // Sidebar nav
  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(el.dataset.page);
    });
  });

  // Bottom nav
  document.querySelectorAll('.bottom-nav-item[data-page]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(el.dataset.page);
    });
  });

  // Custom navigate event (from pages)
  window.addEventListener('navigate', (e) => {
    navigateTo(e.detail);
  });

  // Track viewport resizing to align the bottom nav indicator
  window.addEventListener('resize', updateBottomNavIndicator);

  // Sidebar toggle
  document.getElementById('btn-toggle-sidebar').addEventListener('click', toggleSidebar);

  // Create sidebar overlay
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.id = 'sidebar-overlay';
  overlay.addEventListener('click', closeSidebar);
  document.getElementById('main-app').appendChild(overlay);
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('active');
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('active');
}

// ---- FABs ----
function setupFABs() {
  // Mobile FAB
  document.getElementById('btn-add-transaction-fab')?.addEventListener('click', () => openTransactionForm());

  // Desktop FAB
  document.getElementById('btn-add-transaction-desktop-fab')?.addEventListener('click', () => openTransactionForm());

  // Topbar add button
  document.getElementById('btn-add-transaction-topbar')?.addEventListener('click', () => openTransactionForm());
}

// ---- Start ----
document.addEventListener('DOMContentLoaded', init);
