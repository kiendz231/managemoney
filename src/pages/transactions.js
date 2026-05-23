// Transactions page
import { getTransactions, getCategories, deleteTransaction, on } from '../store.js';
import { formatCurrency, formatDate, toInputDate } from '../utils/format.js';
import { getCategoryById, getCategoriesByType } from '../utils/categories.js';
import { openTransactionForm } from '../components/transaction-form.js';
import { showToast } from '../components/toast.js';

let unsubscribers = [];

export function renderTransactions(container) {
  cleanup();

  let filterType = 'all';
  let filterCategory = 'all';
  let filterFrom = '';
  let filterTo = '';
  let searchQuery = '';

  function render() {
    const allTransactions = getTransactions();
    const categories = getCategories();

    // Apply filters
    let filtered = allTransactions.filter(tx => {
      if (filterType !== 'all' && tx.type !== filterType) return false;
      if (filterCategory !== 'all' && tx.categoryId !== filterCategory) return false;
      if (filterFrom) {
        const d = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
        if (d < new Date(filterFrom)) return false;
      }
      if (filterTo) {
        const d = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
        const toDate = new Date(filterTo);
        toDate.setHours(23, 59, 59, 999);
        if (d > toDate) return false;
      }
      if (searchQuery) {
        const cat = getCategoryById(categories, tx.categoryId);
        const text = `${tx.note} ${cat.name}`.toLowerCase();
        if (!text.includes(searchQuery.toLowerCase())) return false;
      }
      return true;
    });

    // Summary
    const totalIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    // Group by date
    const grouped = {};
    filtered.forEach(tx => {
      const d = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
      const key = d.toDateString();
      if (!grouped[key]) grouped[key] = { date: d, items: [] };
      grouped[key].items.push(tx);
    });

    const catOptions = categories.map(c =>
      `<option value="${c.id}" ${filterCategory === c.id ? 'selected' : ''}>${c.icon} ${c.name}</option>`
    ).join('');

    container.innerHTML = `
      <div class="page-enter">
        <div class="transactions-header">
          <div class="input-group" style="max-width: 300px; width: 100%;">
            <input type="search" id="tx-search" placeholder="🔍 Tìm kiếm giao dịch..." value="${searchQuery}" />
          </div>
          <button class="btn btn-primary" id="btn-add-tx">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Thêm giao dịch
          </button>
        </div>

        <div class="transactions-filters">
          <div class="input-group">
            <label>Loại</label>
            <select id="filter-type">
              <option value="all" ${filterType === 'all' ? 'selected' : ''}>Tất cả</option>
              <option value="expense" ${filterType === 'expense' ? 'selected' : ''}>Chi tiêu</option>
              <option value="income" ${filterType === 'income' ? 'selected' : ''}>Thu nhập</option>
            </select>
          </div>
          <div class="input-group">
            <label>Danh mục</label>
            <select id="filter-category">
              <option value="all">Tất cả</option>
              ${catOptions}
            </select>
          </div>
          <div class="input-group">
            <label>Từ ngày</label>
            <input type="date" id="filter-from" value="${filterFrom}" />
          </div>
          <div class="input-group">
            <label>Đến ngày</label>
            <input type="date" id="filter-to" value="${filterTo}" />
          </div>
        </div>

        <div class="transactions-summary">
          <div class="transactions-summary-card">
            <div class="transactions-summary-label">Thu nhập</div>
            <div class="transactions-summary-value" style="color: var(--income)">${formatCurrency(totalIncome)}</div>
          </div>
          <div class="transactions-summary-card">
            <div class="transactions-summary-label">Chi tiêu</div>
            <div class="transactions-summary-value" style="color: var(--expense)">${formatCurrency(totalExpense)}</div>
          </div>
          <div class="transactions-summary-card">
            <div class="transactions-summary-label">Chênh lệch</div>
            <div class="transactions-summary-value">${formatCurrency(totalIncome - totalExpense)}</div>
          </div>
        </div>

        <div class="transactions-list">
          ${filtered.length === 0 ? `
            <div class="empty-state">
              <div class="empty-state-icon">🔍</div>
              <div class="empty-state-title">Không tìm thấy giao dịch</div>
              <div class="empty-state-text">Thử thay đổi bộ lọc hoặc thêm giao dịch mới</div>
            </div>
          ` : Object.values(grouped).map(group => `
            <div class="date-divider">${formatDate(group.date)}</div>
            ${group.items.map(tx => {
              const cat = getCategoryById(categories, tx.categoryId);
              return `
                <div class="transaction-item" data-id="${tx.id}">
                  <div class="transaction-icon" style="background: ${cat.color}20">${cat.icon}</div>
                  <div class="transaction-info">
                    <div class="transaction-name">${tx.note || cat.name}</div>
                    <div class="transaction-category">${cat.name}</div>
                  </div>
                  <div style="text-align: right; flex-shrink: 0;">
                    <div class="transaction-amount ${tx.type}">${tx.type === 'income' ? '+' : '-'}${formatCurrency(tx.amount)}</div>
                  </div>
                  <div class="transaction-actions">
                    <button class="transaction-action-btn edit" data-id="${tx.id}" title="Sửa">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="transaction-action-btn delete" data-id="${tx.id}" title="Xóa">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          `).join('')}
        </div>
      </div>
    `;

    // Event bindings
    container.querySelector('#btn-add-tx')?.addEventListener('click', () => openTransactionForm());
    container.querySelector('#tx-search')?.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      render();
    });
    container.querySelector('#filter-type')?.addEventListener('change', (e) => {
      filterType = e.target.value;
      render();
    });
    container.querySelector('#filter-category')?.addEventListener('change', (e) => {
      filterCategory = e.target.value;
      render();
    });
    container.querySelector('#filter-from')?.addEventListener('change', (e) => {
      filterFrom = e.target.value;
      render();
    });
    container.querySelector('#filter-to')?.addEventListener('change', (e) => {
      filterTo = e.target.value;
      render();
    });

    // Edit & Delete
    container.querySelectorAll('.transaction-action-btn.edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tx = allTransactions.find(t => t.id === btn.dataset.id);
        if (tx) openTransactionForm(tx);
      });
    });

    container.querySelectorAll('.transaction-action-btn.delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Bạn chắc chắn muốn xóa giao dịch này?')) {
          try {
            await deleteTransaction(btn.dataset.id);
            showToast('Đã xóa giao dịch', 'success');
          } catch (err) {
            showToast('Lỗi: ' + err.message, 'error');
          }
        }
      });
    });

    // Click to edit
    container.querySelectorAll('.transaction-item[data-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.transaction-action-btn')) return;
        const tx = allTransactions.find(t => t.id === el.dataset.id);
        if (tx) openTransactionForm(tx);
      });
    });
  }

  render();
  unsubscribers.push(on('transactions', render));
  unsubscribers.push(on('categories', render));
}

function cleanup() {
  unsubscribers.forEach(fn => fn());
  unsubscribers = [];
}

export function destroyTransactions() {
  cleanup();
}
