// Modal component
let currentModalCleanup = null;

export function openModal(title, contentHTML, onMount) {
  const overlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');

  modalTitle.textContent = title;
  modalBody.innerHTML = contentHTML;
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  if (onMount) {
    currentModalCleanup = onMount(modalBody);
  }

  // Close on overlay click
  const handleOverlayClick = (e) => {
    if (e.target === overlay) closeModal();
  };
  overlay.addEventListener('click', handleOverlayClick);

  // Close on Escape
  const handleEsc = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  document.addEventListener('keydown', handleEsc);

  // Store cleanup
  overlay._cleanup = () => {
    overlay.removeEventListener('click', handleOverlayClick);
    document.removeEventListener('keydown', handleEsc);
  };
}

export function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.add('hidden');
  document.body.style.overflow = '';

  if (overlay._cleanup) {
    overlay._cleanup();
    overlay._cleanup = null;
  }

  if (currentModalCleanup && typeof currentModalCleanup === 'function') {
    currentModalCleanup();
    currentModalCleanup = null;
  }
}

// Init modal close button
export function initModal() {
  document.getElementById('modal-close').addEventListener('click', closeModal);
}
