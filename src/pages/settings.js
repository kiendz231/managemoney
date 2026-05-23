// Settings page
import { getCategories, addCategory, deleteCategory, updateUserProfile, getUserProfile, on, getTransactions, addTransaction, deleteTransaction } from '../store.js';
import { getCategoriesByType } from '../utils/categories.js';
import { exportToCSV } from '../utils/export.js';
import { parseTransactionsCSV } from '../utils/import.js';
import { formatCurrency } from '../utils/format.js';
import { logOut } from '../auth.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

let unsubscribers = [];

async function loadSheetJS() {
  if (window.XLSX) return window.XLSX;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    script.onload = () => resolve(window.XLSX);
    script.onerror = () => reject(new Error('Không thể tải thư viện đọc file Excel XLSX từ CDN.'));
    document.head.appendChild(script);
  });
}

export function renderSettings(container) {
  cleanup();

  function render() {
    const categories = getCategories();
    const profile = getUserProfile();
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const expenseCats = getCategoriesByType(categories, 'expense');
    const incomeCats = getCategoriesByType(categories, 'income');

    container.innerHTML = `
      <div class="page-enter">
        <!-- Theme -->
        <div class="settings-section">
          <div class="settings-section-title">Giao diện</div>
          <div class="settings-group">
            <div class="settings-item" id="settings-theme">
              <div class="settings-item-left">
                <div class="settings-item-icon" style="background: var(--accent-subtle)">🌙</div>
                <div class="settings-item-info">
                  <h4>Chế độ tối</h4>
                  <p>Giao diện Dark mode</p>
                </div>
              </div>
              <div class="toggle-switch ${isDark ? 'active' : ''}" id="theme-toggle"></div>
            </div>
          </div>
        </div>

        <!-- Categories -->
        <div class="settings-section">
          <div class="settings-section-title">Danh mục chi tiêu</div>
          <div class="categories-grid" id="expense-categories">
            ${expenseCats.map(c => `
              <div class="category-card" data-id="${c.id}">
                <button class="category-card-delete" data-delete="${c.id}" title="Xóa">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
                <div class="category-card-icon">${c.icon}</div>
                <div class="category-card-name">${c.name}</div>
              </div>
            `).join('')}
            <div class="category-card" id="add-expense-cat" style="border-style: dashed; opacity: 0.6;">
              <div class="category-card-icon">➕</div>
              <div class="category-card-name">Thêm</div>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-section-title">Danh mục thu nhập</div>
          <div class="categories-grid" id="income-categories">
            ${incomeCats.map(c => `
              <div class="category-card" data-id="${c.id}">
                <button class="category-card-delete" data-delete="${c.id}" title="Xóa">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
                <div class="category-card-icon">${c.icon}</div>
                <div class="category-card-name">${c.name}</div>
              </div>
            `).join('')}
            <div class="category-card" id="add-income-cat" style="border-style: dashed; opacity: 0.6;">
              <div class="category-card-icon">➕</div>
              <div class="category-card-name">Thêm</div>
            </div>
          </div>
        </div>

        <!-- Data -->
        <div class="settings-section">
          <div class="settings-section-title">Dữ liệu</div>
          <div class="settings-group">
            <div class="settings-item" id="settings-export">
              <div class="settings-item-left">
                <div class="settings-item-icon" style="background: var(--income-subtle)">📤</div>
                <div class="settings-item-info">
                  <h4>Xuất dữ liệu CSV</h4>
                  <p>Tải về file Excel</p>
                </div>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
            <div class="settings-item" id="settings-import">
              <div class="settings-item-left">
                <div class="settings-item-icon" style="background: var(--accent-subtle)">📥</div>
                <div class="settings-item-info">
                  <h4>Nhập dữ liệu Excel/CSV</h4>
                  <p>Tải lên tệp sao lưu hoặc thống kê</p>
                </div>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
              <input type="file" id="csv-import-file" accept=".csv,.xlsx,.xls" style="display: none;">
            </div>
          </div>
        </div>

        <!-- Account -->
        <div class="settings-section">
          <div class="settings-section-title">Tài khoản</div>
          <div class="settings-group">
            <div class="settings-item" id="settings-initial-balance">
              <div class="settings-item-left">
                <div class="settings-item-icon" style="background: var(--accent-subtle)">💵</div>
                <div class="settings-item-info">
                  <h4>Số dư ban đầu</h4>
                  <p style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
                    <span>💵 Tiền mặt: <strong style="color: var(--accent); font-weight: 600;">${formatCurrency(profile.initialCash || 0)}</strong></span>
                    <span>💳 Tài khoản: <strong style="color: var(--accent); font-weight: 600;">${formatCurrency(profile.initialBank || 0)}</strong></span>
                  </p>
                </div>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
            <div class="settings-item" id="settings-signout">
              <div class="settings-item-left">
                <div class="settings-item-icon" style="background: var(--expense-subtle)">🚪</div>
                <div class="settings-item-info">
                  <h4>Đăng xuất</h4>
                  <p>Thoát khỏi tài khoản</p>
                </div>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          </div>
        </div>

        <!-- Danger Zone -->
        <div class="settings-section">
          <div class="settings-section-title" style="color: var(--expense)">Vùng nguy hiểm</div>
          <div class="settings-group" style="border-color: hsla(0, 72%, 58%, 0.2)">
            <div class="settings-item" id="settings-clear-txs">
              <div class="settings-item-left">
                <div class="settings-item-icon" style="background: var(--expense-subtle)">🗑️</div>
                <div class="settings-item-info">
                  <h4 style="color: var(--expense)">Xóa tất cả giao dịch</h4>
                  <p>Xóa toàn bộ lịch sử chi tiêu của bạn</p>
                </div>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
            <div class="settings-item" id="settings-clear-cats">
              <div class="settings-item-left">
                <div class="settings-item-icon" style="background: var(--expense-subtle)">📦</div>
                <div class="settings-item-info">
                  <h4 style="color: var(--expense)">Xóa danh mục tự tạo</h4>
                  <p>Xóa tất cả các danh mục bạn đã thêm</p>
                </div>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          </div>
        </div>
      </div>
    `;

    // Theme toggle
    container.querySelector('#settings-theme')?.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      render();
    });

    // Initial balance modal click handler
    container.querySelector('#settings-initial-balance')?.addEventListener('click', () => {
      const html = `
        <form class="modal-form" id="initial-balance-form">
          <div class="input-group">
            <label for="initial-cash-input">Tiền mặt ban đầu (VND)</label>
            <input type="number" id="initial-cash-input" value="${profile.initialCash || 0}" min="0" placeholder="Ví dụ: 1000000" required style="width: 100%;" />
          </div>
          <div class="input-group">
            <label for="initial-bank-input">Tài khoản ngân hàng ban đầu (VND)</label>
            <input type="number" id="initial-bank-input" value="${profile.initialBank || 0}" min="0" placeholder="Ví dụ: 5000000" required style="width: 100%;" />
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" id="balance-cancel">Hủy</button>
            <button type="submit" class="btn btn-primary">Lưu</button>
          </div>
        </form>
      `;

      openModal('Số dư ban đầu', html, (body) => {
        body.querySelector('#balance-cancel').addEventListener('click', closeModal);
        body.querySelector('#initial-balance-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const cashVal = Number(body.querySelector('#initial-cash-input').value);
          const bankVal = Number(body.querySelector('#initial-bank-input').value);
          try {
            await updateUserProfile({
              initialCash: cashVal,
              initialBank: bankVal
            });
            showToast('Đã cập nhật số dư ban đầu', 'success');
            closeModal();
          } catch (err) {
            showToast('Lỗi: ' + err.message, 'error');
          }
        });
      });
    });

    // Add category
    container.querySelector('#add-expense-cat')?.addEventListener('click', () => openCategoryForm('expense'));
    container.querySelector('#add-income-cat')?.addEventListener('click', () => openCategoryForm('income'));

    // Delete category
    container.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Xóa danh mục này?')) {
          try {
            await deleteCategory(btn.dataset.delete);
            showToast('Đã xóa danh mục', 'success');
          } catch (err) {
            showToast('Lỗi: ' + err.message, 'error');
          }
        }
      });
    });

    // Export
    container.querySelector('#settings-export')?.addEventListener('click', () => {
      const txs = getTransactions();
      if (txs.length === 0) {
        showToast('Chưa có giao dịch để xuất', 'warning');
        return;
      }
      exportToCSV(txs, categories);
      showToast('Đã xuất file CSV', 'success');
    });

    // Import
    const importItem = container.querySelector('#settings-import');
    const importInput = container.querySelector('#csv-import-file');

    importItem?.addEventListener('click', () => {
      importInput?.click();
    });

    importInput?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      showToast(isExcel ? 'Đang tải thư viện xử lý Excel...' : 'Đang đọc tệp CSV...', 'info');

      const reader = new FileReader();
      reader.onload = async (evt) => {
        let text = '';
        try {
          if (isExcel) {
            // Dynamically load SheetJS
            const XLSX = await loadSheetJS();
            const data = new Uint8Array(evt.target?.result);
            
            let workbook;
            try {
              workbook = XLSX.read(data, { type: 'array' });
            } catch (err) {
              const errMsg = err.message || '';
              const isEncrypted = errMsg.toLowerCase().includes('password') || 
                                  errMsg.toLowerCase().includes('decrypt') || 
                                  errMsg.toLowerCase().includes('encrypt') || 
                                  errMsg.toLowerCase().includes('crypto') || 
                                  err.code === 'DEC' ||
                                  errMsg.includes('zip') || errMsg.includes('corrupt');
                                  
              if (isEncrypted) {
                const password = prompt('File Excel này đã bị khóa bằng mật khẩu. Vui lòng nhập mật khẩu để giải mã:');
                if (password === null) {
                  showToast('Đã hủy nhập tệp.', 'warning');
                  return;
                }
                try {
                  workbook = XLSX.read(data, { type: 'array', password: password });
                } catch (decryptErr) {
                  const decMsg = decryptErr.message || '';
                  if (decMsg.toLowerCase().includes('agile') || decMsg.toLowerCase().includes('encrypt') || decMsg.toLowerCase().includes('support')) {
                    throw new Error('Thư viện trình duyệt miễn phí không hỗ trợ chuẩn mã hóa Agile AES-256 của Microsoft. Vui lòng gỡ mật khẩu file Excel hoặc lưu thành file CSV rồi tải lại nhé!');
                  }
                  throw new Error('Mật khẩu giải mã không chính xác hoặc tệp Excel không thể mở.');
                }
              } else {
                throw err;
              }
            }

            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            text = XLSX.utils.sheet_to_csv(worksheet);
          } else {
            text = evt.target?.result;
          }

          if (typeof text !== 'string' || !text) {
            showToast('Không thể đọc dữ liệu tệp', 'error');
            return;
          }

          const parsed = await parseTransactionsCSV(text, categories, async (catName, type) => {
            // Callback to dynamically add new category in Firestore
            const computedId = catName.toLowerCase().trim().replace(/[\/\s\.]+/g, '_');
            await addCategory({
              name: catName,
              icon: type === 'income' ? '💰' : '📦',
              color: type === 'income' ? '#55EFC4' : '#B2BEC3',
              type: type
            });
            return computedId;
          });

          if (parsed.length === 0) {
            showToast('Không tìm thấy giao dịch nào trong tệp', 'warning');
            return;
          }

          if (confirm(`Tìm thấy ${parsed.length} giao dịch. Bạn có muốn nhập các giao dịch này vào lịch sử quản lý chi tiêu?`)) {
            showToast('Đang nhập dữ liệu...', 'info');
            let count = 0;
            for (const tx of parsed) {
              await addTransaction(tx);
              count++;
            }
            showToast(`Nhập dữ liệu thành công! Đã thêm ${count} giao dịch.`, 'success');
          }
        } catch (err) {
          console.error(err);
          showToast('Lỗi: ' + err.message, 'error');
        } finally {
          if (importInput) importInput.value = '';
        }
      };

      reader.onerror = () => {
        showToast('Lỗi khi đọc tệp', 'error');
        if (importInput) importInput.value = '';
      };

      if (isExcel) {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file, 'UTF-8');
      }
    });

    // Sign out
    container.querySelector('#settings-signout')?.addEventListener('click', async () => {
      if (confirm('Bạn muốn đăng xuất?')) {
        await logOut();
      }
    });

    // Clear transactions
    container.querySelector('#settings-clear-txs')?.addEventListener('click', async () => {
      const txs = getTransactions();
      if (txs.length === 0) {
        showToast('Không có giao dịch nào để xóa', 'warning');
        return;
      }
      if (confirm(`CẢNH BÁO: Bạn có chắc chắn muốn xóa TOÀN BỘ ${txs.length} giao dịch? Hành động này không thể hoàn tác.`)) {
        if (confirm('XÁC NHẬN CUỐI CÙNG: Bạn thực sự muốn xóa sạch toàn bộ lịch sử giao dịch?')) {
          showToast('Đang dọn dẹp giao dịch...', 'info');
          let count = 0;
          try {
            for (const tx of txs) {
              await deleteTransaction(tx.id);
              count++;
            }
            showToast(`Đã xóa sạch thành công ${count} giao dịch!`, 'success');
          } catch (err) {
            showToast('Lỗi: ' + err.message, 'error');
          }
        }
      }
    });

    // Clear custom categories
    container.querySelector('#settings-clear-cats')?.addEventListener('click', async () => {
      const allCats = getCategories();
      const defaultIds = ['food', 'transport', 'shopping', 'bills', 'entertainment', 'health', 'education', 'rent', 'phone', 'gift', 'coffee', 'other_expense', 'salary', 'freelance', 'investment', 'bonus', 'other_income'];
      const customCats = allCats.filter(c => !defaultIds.includes(c.id));

      if (customCats.length === 0) {
        showToast('Không có danh mục tự tạo nào để xóa', 'warning');
        return;
      }

      if (confirm(`Bạn có chắc chắn muốn xóa ${customCats.length} danh mục tự tạo? Các danh mục mặc định ban đầu sẽ được giữ nguyên.`)) {
        showToast('Đang dọn dẹp danh mục...', 'info');
        let count = 0;
        try {
          for (const cat of customCats) {
            await deleteCategory(cat.id);
            count++;
          }
          showToast(`Đã xóa thành công ${count} danh mục tự tạo!`, 'success');
        } catch (err) {
          showToast('Lỗi: ' + err.message, 'error');
        }
      }
    });
  }

  render();
  unsubscribers.push(on('categories', render));
  unsubscribers.push(on('profile', render));
}

function openCategoryForm(type) {
  const emojis = ['🍕', '🎮', '🏋️', '✈️', '📖', '🎵', '🎨', '🐱', '🌱', '🔧', '💄', '🎓', '🏪', '🍰', '🚌', '💊'];

  const html = `
    <form class="modal-form" id="category-form">
      <div class="input-group">
        <label>Icon</label>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${emojis.map((e, i) => `
            <button type="button" class="category-chip emoji-pick ${i === 0 ? 'active' : ''}" data-emoji="${e}" style="padding: 8px 12px; font-size: 1.2rem;">${e}</button>
          `).join('')}
        </div>
        <input type="hidden" id="cat-icon" value="${emojis[0]}" />
      </div>
      <div class="input-group">
        <label for="cat-name">Tên danh mục</label>
        <input type="text" id="cat-name" placeholder="Ví dụ: Thú cưng" required />
      </div>
      <div class="input-group">
        <label for="cat-color">Màu sắc</label>
        <input type="color" id="cat-color" value="#6C5CE7" style="width: 60px; height: 40px; padding: 2px; border-radius: 8px;" />
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="cat-cancel">Hủy</button>
        <button type="submit" class="btn btn-primary">Lưu</button>
      </div>
    </form>
  `;

  openModal(`Thêm danh mục ${type === 'expense' ? 'chi tiêu' : 'thu nhập'}`, html, (body) => {
    const iconInput = body.querySelector('#cat-icon');
    body.querySelectorAll('.emoji-pick').forEach(btn => {
      btn.addEventListener('click', () => {
        body.querySelectorAll('.emoji-pick').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        iconInput.value = btn.dataset.emoji;
      });
    });

    body.querySelector('#cat-cancel').addEventListener('click', closeModal);
    body.querySelector('#category-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await addCategory({
          name: body.querySelector('#cat-name').value,
          icon: iconInput.value,
          color: body.querySelector('#cat-color').value,
          type,
        });
        showToast('Đã thêm danh mục', 'success');
        closeModal();
      } catch (err) {
        showToast('Lỗi: ' + err.message, 'error');
      }
    });
  });
}

function cleanup() {
  unsubscribers.forEach(fn => fn());
  unsubscribers = [];
}

export function destroySettings() { cleanup(); }
