// Budgets page
import { getBudgets, getCategories, getCategorySpending, setBudget, deleteBudget, on } from '../store.js';
import { formatCurrency, getMonthKey } from '../utils/format.js';
import { getCategoryById, getCategoriesByType } from '../utils/categories.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

let unsubscribers = [];

export function renderBudgets(container) {
  cleanup();
  const now = new Date();
  let currentYear = now.getFullYear();
  let currentMonth = now.getMonth();

  function render() {
    const categories = getCategories();
    const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const monthBudgets = getBudgets().filter(b => b.month === monthKey);
    const catSpending = getCategorySpending(currentYear, currentMonth);

    const totalBudget = monthBudgets.reduce((s, b) => s + b.amount, 0);
    const totalSpent = monthBudgets.reduce((s, b) => {
      const spent = catSpending.find(c => c.categoryId === b.categoryId)?.amount || 0;
      return s + spent;
    }, 0);
    const totalRemaining = totalBudget - totalSpent;
    const totalPercent = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;

    const monthLabel = new Date(currentYear, currentMonth).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

    container.innerHTML = `
      <div class="page-enter">
        <div class="budgets-header">
          <div style="display: flex; align-items: center; gap: var(--space-md);">
            <button class="btn btn-ghost btn-sm" id="budget-prev-month">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <h3 style="text-transform: capitalize;">${monthLabel}</h3>
            <button class="btn btn-ghost btn-sm" id="budget-next-month">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </div>
          <button class="btn btn-primary btn-sm" id="btn-add-budget">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Thêm ngân sách
          </button>
        </div>

        <!-- Overview -->
        <div class="budgets-overview">
          <div class="stat-card" style="--stat-color: var(--accent)">
            <div class="stat-label">Tổng ngân sách</div>
            <div class="stat-value">${formatCurrency(totalBudget)}</div>
          </div>
          <div class="stat-card" style="--stat-color: var(--expense)">
            <div class="stat-label">Đã chi</div>
            <div class="stat-value" style="color: var(--expense)">${formatCurrency(totalSpent)}</div>
            <div class="progress-bar" style="margin-top: var(--space-sm);">
              <div class="progress-bar-fill" style="width: ${totalPercent}%; background: ${totalPercent > 90 ? 'var(--expense)' : totalPercent > 70 ? 'var(--warning)' : 'var(--income)'}"></div>
            </div>
          </div>
          <div class="stat-card" style="--stat-color: ${totalRemaining >= 0 ? 'var(--income)' : 'var(--expense)'}">
            <div class="stat-label">Còn lại</div>
            <div class="stat-value" style="color: ${totalRemaining >= 0 ? 'var(--income)' : 'var(--expense)'}">${formatCurrency(totalRemaining)}</div>
          </div>
        </div>

        <!-- Budget items -->
        <div class="budgets-list">
          ${monthBudgets.length === 0 ? `
            <div class="empty-state">
              <div class="empty-state-icon">🎯</div>
              <div class="empty-state-title">Chưa có ngân sách</div>
              <div class="empty-state-text">Đặt ngân sách cho từng danh mục để kiểm soát chi tiêu</div>
            </div>
          ` : monthBudgets.map(b => {
            const cat = getCategoryById(categories, b.categoryId);
            const spent = catSpending.find(c => c.categoryId === b.categoryId)?.amount || 0;
            const percent = b.amount > 0 ? Math.min((spent / b.amount) * 100, 100) : 0;
            const overBudget = spent > b.amount;
            const remaining = b.amount - spent;
            let statusClass = 'safe';
            if (percent > 90) statusClass = 'danger';
            else if (percent > 70) statusClass = 'warning';

            return `
              <div class="budget-item">
                <div class="budget-item-header">
                  <div class="budget-item-left">
                    <div class="budget-item-icon" style="background: ${cat.color}20">${cat.icon}</div>
                    <span class="budget-item-name">${cat.name}</span>
                  </div>
                  <div class="budget-item-amounts">
                    <div class="budget-item-spent">${formatCurrency(spent)}</div>
                    <div class="budget-item-total">/ ${formatCurrency(b.amount)}</div>
                  </div>
                </div>
                <div class="progress-bar">
                  <div class="progress-bar-fill" style="width: ${percent}%; background: ${statusClass === 'danger' ? 'var(--expense)' : statusClass === 'warning' ? 'var(--warning)' : 'var(--income)'}"></div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-sm);">
                  <span class="budget-status ${statusClass}">
                    ${overBudget ? `Vượt ${formatCurrency(Math.abs(remaining))}` : `Còn ${formatCurrency(remaining)} (${Math.round(100 - percent)}%)`}
                  </span>
                  <button class="btn btn-ghost btn-sm budget-delete" data-id="${b.id}" style="padding: 4px 8px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Events
    container.querySelector('#budget-prev-month')?.addEventListener('click', () => {
      currentMonth--;
      if (currentMonth < 0) { currentMonth = 11; currentYear--; }
      render();
    });
    container.querySelector('#budget-next-month')?.addEventListener('click', () => {
      currentMonth++;
      if (currentMonth > 11) { currentMonth = 0; currentYear++; }
      render();
    });
    container.querySelector('#btn-add-budget')?.addEventListener('click', () => openBudgetForm(monthKey, categories));

    container.querySelectorAll('.budget-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('Xóa ngân sách này?')) {
          try {
            await deleteBudget(btn.dataset.id);
            showToast('Đã xóa ngân sách', 'success');
          } catch (err) {
            showToast('Lỗi: ' + err.message, 'error');
          }
        }
      });
    });
  }

  render();
  unsubscribers.push(on('budgets', render));
  unsubscribers.push(on('transactions', render));
}

function openBudgetForm(monthKey, categories) {
  const expenseCats = getCategoriesByType(categories, 'expense');
  const html = `
    <form class="modal-form" id="budget-form">
      <div class="input-group">
        <label for="budget-category">Danh mục</label>
        <select id="budget-category" required>
          ${expenseCats.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="input-group">
        <label for="budget-amount">Ngân sách (VNĐ)</label>
        <input type="number" id="budget-amount" placeholder="0" required min="1" inputmode="numeric" />
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="budget-cancel">Hủy</button>
        <button type="submit" class="btn btn-primary">Lưu</button>
      </div>
    </form>
  `;

  openModal('Thêm ngân sách', html, (body) => {
    body.querySelector('#budget-cancel').addEventListener('click', closeModal);
    body.querySelector('#budget-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await setBudget({
          categoryId: body.querySelector('#budget-category').value,
          amount: body.querySelector('#budget-amount').value,
          month: monthKey,
        });
        showToast('Đã lưu ngân sách', 'success');
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

export function destroyBudgets() { cleanup(); }
