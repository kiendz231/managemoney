// Vay & Nợ page (Installments & Debts Ledger)
import { 
  getInstallments, getCategories, addInstallment, updateInstallment, deleteInstallment, payInstallmentTerm,
  getDebts, addDebt, updateDebt, deleteDebt, settleDebt, on 
} from '../store.js';
import { formatCurrency } from '../utils/format.js';
import { getCategoryById, getCategoriesByType } from '../utils/categories.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

let unsubscribers = [];
let mainTab = 'installments'; // 'installments' | 'debts'
let installmentFilter = 'active'; // 'active' | 'completed'
let debtFilter = 'unpaid'; // 'unpaid' | 'paid'

export function renderInstallments(container) {
  cleanup();

  function render() {
    const list = getInstallments();
    const categories = getCategories();
    const debtList = getDebts();

    // Render main layout shell
    container.innerHTML = `
      <div class="page-enter">
        <!-- Main Tabs Selector -->
        <div class="main-tabs-selector">
          <button class="main-tab-btn ${mainTab === 'installments' ? 'active' : ''}" id="btn-tab-installments">📦 Trả góp</button>
          <button class="main-tab-btn ${mainTab === 'debts' ? 'active' : ''}" id="btn-tab-debts">📒 Sổ ghi nợ</button>
        </div>

        <div id="tab-content-area"></div>
      </div>
    `;

    // Render active tab content
    if (mainTab === 'installments') {
      renderInstallmentsTab(container.querySelector('#tab-content-area'), list, categories);
    } else {
      renderDebtsTab(container.querySelector('#tab-content-area'), debtList, categories);
    }

    // Attach Main Tab Event Listeners
    container.querySelector('#btn-tab-installments').addEventListener('click', () => {
      mainTab = 'installments';
      render();
    });
    container.querySelector('#btn-tab-debts').addEventListener('click', () => {
      mainTab = 'debts';
      render();
    });
  }

  render();
  unsubscribers.push(on('installments', render));
  unsubscribers.push(on('debts', render));
  unsubscribers.push(on('transactions', render));
}

// ==========================================
// 1. RENDER INSTALLMENTS TAB CONTENT
// ==========================================
function renderInstallmentsTab(container, list, categories) {
  const filtered = list.filter(i => (i.status || 'active') === installmentFilter);

  // Compute metrics
  const activeList = list.filter(i => (i.status || 'active') === 'active');
  const totalRemaining = activeList.reduce((sum, i) => {
    const remainingMonths = Math.max(0, i.monthsTotal - i.monthsPaid);
    return sum + (remainingMonths * i.monthlyAmount);
  }, 0);
  const monthlyDue = activeList.reduce((sum, i) => sum + i.monthlyAmount, 0);
  const completedCount = list.filter(i => (i.status || 'active') === 'completed').length;

  container.innerHTML = `
    <div class="installments-header">
      <div class="tabs">
        <button class="tab-btn ${installmentFilter === 'active' ? 'active' : ''}" id="btn-filter-active">Đang trả góp</button>
        <button class="tab-btn ${installmentFilter === 'completed' ? 'active' : ''}" id="btn-filter-completed">Đã trả xong</button>
      </div>
      <button class="btn btn-primary" id="btn-add-installment">
        <span class="logo-icon">+</span>
        <span>Thêm khoản</span>
      </button>
    </div>

    <!-- Overview Cards -->
    <div class="installments-overview">
      <div class="stat-card" style="--stat-color: var(--expense)">
        <div class="stat-icon" style="background: var(--expense-subtle)">💸</div>
        <div class="stat-label">Tổng dư nợ còn lại</div>
        <div class="stat-value" style="color: var(--expense)">${formatCurrency(totalRemaining)}</div>
      </div>
      <div class="stat-card" style="--stat-color: var(--warning)">
        <div class="stat-icon" style="background: var(--warning-subtle)">📅</div>
        <div class="stat-label">Cần đóng tháng này</div>
        <div class="stat-value" style="color: var(--warning)">${formatCurrency(monthlyDue)}</div>
      </div>
      <div class="stat-card" style="--stat-color: var(--income)">
        <div class="stat-icon" style="background: var(--income-subtle)">✅</div>
        <div class="stat-label">Đã hoàn thành</div>
        <div class="stat-value" style="color: var(--income)">${completedCount} / ${list.length}</div>
      </div>
    </div>

    <!-- Installments List -->
    <div class="installments-list">
      ${filtered.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">💳</div>
          <div class="empty-state-title">${installmentFilter === 'active' ? 'Không có khoản trả góp nào đang chạy' : 'Chưa có khoản trả góp nào hoàn thành'}</div>
          <div class="empty-state-text">Thêm các khoản mua sắm trả góp hoặc vay nợ để theo dõi tiến độ dễ dàng</div>
        </div>
      ` : filtered.map(inst => {
        const cat = getCategoryById(categories, inst.categoryId);
        const remaining = Math.max(0, inst.monthsTotal - inst.monthsPaid);
        const remainingAmount = remaining * inst.monthlyAmount;
        const progressPercent = Math.min(100, Math.round((inst.monthsPaid / inst.monthsTotal) * 100)) || 0;
        const isCompleted = (inst.status || 'active') === 'completed';

        return `
          <div class="installment-card" data-id="${inst.id}">
            <div class="installment-card-header">
              <div class="installment-meta">
                <div class="installment-icon" style="background: ${cat.color}20">${cat.icon}</div>
                <div class="installment-info">
                  <h3 class="installment-name">${inst.name}</h3>
                  <p class="installment-desc">${cat.name} • ${inst.wallet === 'cash' ? '💵 Tiền mặt' : '💳 Chuyển khoản'}</p>
                </div>
              </div>
              <div class="installment-actions">
                <button class="installment-action-btn edit" data-id="${inst.id}" title="Sửa">✏️</button>
                <button class="installment-action-btn delete" data-id="${inst.id}" title="Xóa">🗑️</button>
              </div>
            </div>

            <div class="installment-card-body">
              <div class="installment-stats-row">
                <div>
                  <span class="inst-label">Đã trả</span>
                  <strong class="inst-val">${formatCurrency(inst.monthsPaid * inst.monthlyAmount)}</strong>
                </div>
                <div style="text-align: center;">
                  <span class="inst-label">Kỳ hạn</span>
                  <strong class="inst-val" style="color: var(--accent);">${inst.monthsPaid}/${inst.monthsTotal} thg</strong>
                </div>
                <div style="text-align: right;">
                  <span class="inst-label">Mỗi tháng</span>
                  <strong class="inst-val" style="color: var(--text-primary);">${formatCurrency(inst.monthlyAmount)}</strong>
                </div>
              </div>

              <!-- Glass progress bar -->
              <div class="installment-progress-container">
                <div class="installment-progress-bar">
                  <div class="installment-progress-fill" style="width: ${progressPercent}%; background: linear-gradient(90deg, ${cat.color}, var(--accent))"></div>
                </div>
                <div class="installment-progress-labels">
                  <span>Tiến độ: ${progressPercent}%</span>
                  <span>Dư nợ: ${formatCurrency(remainingAmount)}</span>
                </div>
              </div>
            </div>

            ${!isCompleted ? `
              <div class="installment-card-footer">
                <span class="due-badge">📅 Hạn đóng: Ngày ${inst.dueDate} hàng tháng</span>
                <button class="quick-pay-btn" data-id="${inst.id}">
                  <span>💰 Đóng kỳ này</span>
                </button>
              </div>
            ` : `
              <div class="installment-card-footer completed">
                <span class="due-badge completed">🎉 Đã hoàn thành trả góp!</span>
              </div>
            `}
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Attach Installment filter listeners
  container.querySelector('#btn-filter-active').addEventListener('click', () => {
    installmentFilter = 'active';
    window.dispatchEvent(new CustomEvent('navigate', { detail: 'installments' }));
  });
  container.querySelector('#btn-filter-completed').addEventListener('click', () => {
    installmentFilter = 'completed';
    window.dispatchEvent(new CustomEvent('navigate', { detail: 'installments' }));
  });

  // Open installment modal
  container.querySelector('#btn-add-installment').addEventListener('click', () => {
    openInstallmentForm();
  });

  // Edit installment
  container.querySelectorAll('.installment-action-btn.edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const inst = list.find(i => i.id === btn.dataset.id);
      if (inst) openInstallmentForm(inst);
    });
  });

  // Delete installment
  container.querySelectorAll('.installment-action-btn.delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const inst = list.find(i => i.id === btn.dataset.id);
      if (inst && confirm(`Bạn có chắc chắn muốn xóa khoản trả góp "${inst.name}" không?`)) {
        try {
          await deleteInstallment(inst.id);
          showToast('Đã xóa khoản trả góp', 'success');
        } catch (err) {
          showToast('Lỗi: ' + err.message, 'error');
        }
      }
    });
  });

  // Quick Pay installment
  container.querySelectorAll('.quick-pay-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const inst = list.find(i => i.id === btn.dataset.id);
      if (inst) {
        const nextTerm = inst.monthsPaid + 1;
        if (confirm(`Xác nhận thanh toán kỳ thứ ${nextTerm}/${inst.monthsTotal} cho khoản "${inst.name}" trị giá ${formatCurrency(inst.monthlyAmount)}?`)) {
          try {
            btn.disabled = true;
            btn.innerHTML = '<span>⏳ Đang đóng...</span>';
            await payInstallmentTerm(inst.id);
            showToast(`Đã thanh toán kỳ ${nextTerm}/${inst.monthsTotal} cho "${inst.name}"`, 'success');
          } catch (err) {
            btn.disabled = false;
            btn.innerHTML = '<span>💰 Đóng kỳ này</span>';
            showToast('Lỗi: ' + err.message, 'error');
          }
        }
      }
    });
  });
}

// ==========================================
// 2. RENDER DEBTS & LOANS TAB CONTENT
// ==========================================
function renderDebtsTab(container, list, categories) {
  const filtered = list.filter(d => (d.status || 'unpaid') === debtFilter);

  // Compute metrics
  const unpaidList = list.filter(d => (d.status || 'unpaid') === 'unpaid');
  const totalLend = unpaidList.filter(d => d.type === 'lend').reduce((sum, d) => sum + d.amount, 0);
  const totalBorrow = unpaidList.filter(d => d.type === 'borrow').reduce((sum, d) => sum + d.amount, 0);
  const completedCount = list.filter(d => (d.status || 'unpaid') === 'paid').length;

  container.innerHTML = `
    <div class="installments-header">
      <div class="tabs">
        <button class="tab-btn ${debtFilter === 'unpaid' ? 'active' : ''}" id="btn-debt-filter-unpaid">Chưa tất toán</button>
        <button class="tab-btn ${debtFilter === 'paid' ? 'active' : ''}" id="btn-debt-filter-paid">Đã tất toán</button>
      </div>
      <button class="btn btn-primary" id="btn-add-debt">
        <span class="logo-icon">+</span>
        <span>Thêm khoản nợ</span>
      </button>
    </div>

    <!-- Debts Overview Cards -->
    <div class="installments-overview">
      <div class="stat-card" style="--stat-color: var(--income)">
        <div class="stat-icon" style="background: var(--income-subtle)">🤝</div>
        <div class="stat-label">Người khác nợ tôi (Cho vay)</div>
        <div class="stat-value" style="color: var(--income)">${formatCurrency(totalLend)}</div>
      </div>
      <div class="stat-card" style="--stat-color: var(--expense)">
        <div class="stat-icon" style="background: var(--expense-subtle)">💸</div>
        <div class="stat-label">Tôi nợ người khác (Đi vay)</div>
        <div class="stat-value" style="color: var(--expense)">${formatCurrency(totalBorrow)}</div>
      </div>
      <div class="stat-card" style="--stat-color: var(--accent)">
        <div class="stat-icon" style="background: var(--accent-subtle)">✅</div>
        <div class="stat-label">Khoản đã thanh xong</div>
        <div class="stat-value" style="color: var(--accent)">${completedCount} / ${list.length}</div>
      </div>
    </div>

    <!-- Debts List -->
    <div class="installments-list">
      ${filtered.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <div class="empty-state-title">${debtFilter === 'unpaid' ? 'Không có khoản nợ nào chưa trả' : 'Chưa có khoản nợ nào được tất toán'}</div>
          <div class="empty-state-text">Ghi chép các khoản cho vay hoặc đi vay với bạn bè, người thân để theo dõi sổ nợ rõ ràng</div>
        </div>
      ` : filtered.map(debt => {
        const isLend = debt.type === 'lend';
        const cardColor = isLend ? 'var(--income)' : 'var(--expense)';
        const cardBgColor = isLend ? 'var(--income-subtle)' : 'var(--expense-subtle)';
        const d = debt.date?.toDate ? debt.date.toDate() : new Date(debt.date);
        
        return `
          <div class="debt-card ${debt.type}" data-id="${debt.id}">
            <div class="installment-card-header">
              <div class="installment-meta">
                <div class="installment-icon" style="background: ${cardBgColor}; color: ${cardColor};">
                  ${isLend ? '📥' : '📤'}
                </div>
                <div class="installment-info">
                  <h3 class="installment-name">${debt.name}</h3>
                  <p class="installment-desc">${isLend ? '🟢 Tôi cho vay' : '🔴 Tôi đi vay'} • ${debt.wallet === 'cash' ? '💵 Tiền mặt' : '💳 Chuyển khoản'}</p>
                </div>
              </div>
              <div class="installment-actions">
                <button class="installment-action-btn edit-debt" data-id="${debt.id}" title="Sửa">✏️</button>
                <button class="installment-action-btn delete-debt" data-id="${debt.id}" title="Xóa">🗑️</button>
              </div>
            </div>

            <div class="installment-card-body" style="padding: 10px 0;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="inst-label">Số tiền nợ</span>
                <strong class="inst-val" style="font-size: var(--fs-lg); color: ${cardColor};">${formatCurrency(debt.amount)}</strong>
              </div>
              ${debt.note ? `
                <div style="margin-top: 6px; font-size: var(--fs-xs); color: var(--text-secondary); background: var(--bg-input); padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-light);">
                  📝 ${debt.note}
                </div>
              ` : ''}
              <div style="display: flex; justify-content: space-between; font-size: var(--fs-xs); color: var(--text-tertiary); margin-top: 8px;">
                <span>Ngày vay: ${d.toLocaleDateString('vi-VN')}</span>
                ${debt.dueDate ? `<span>Hạn trả: ${new Date(debt.dueDate).toLocaleDateString('vi-VN')}</span>` : ''}
              </div>
            </div>

            ${debt.status !== 'paid' ? `
              <div class="installment-card-footer">
                <span class="due-badge" style="color: ${cardColor}; background: ${cardBgColor};">
                  ${isLend ? '⏳ Chờ thu nợ' : '⏳ Cần trả nợ'}
                </span>
                <button class="settle-btn" data-id="${debt.id}" style="background: ${cardColor}; color: white; border-radius: var(--radius-md); padding: 6px 14px; font-weight: 600; font-size: var(--fs-xs); transition: all 0.2s ease;">
                  <span>✅ Đã trả xong</span>
                </button>
              </div>
            ` : `
              <div class="installment-card-footer completed">
                <span class="due-badge completed">🎉 Đã tất toán ngày ${new Date().toLocaleDateString('vi-VN')}</span>
              </div>
            `}
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Attach Debt filter listeners
  container.querySelector('#btn-debt-filter-unpaid').addEventListener('click', () => {
    debtFilter = 'unpaid';
    window.dispatchEvent(new CustomEvent('navigate', { detail: 'installments' }));
  });
  container.querySelector('#btn-debt-filter-paid').addEventListener('click', () => {
    debtFilter = 'paid';
    window.dispatchEvent(new CustomEvent('navigate', { detail: 'installments' }));
  });

  // Open debt modal
  container.querySelector('#btn-add-debt').addEventListener('click', () => {
    openDebtForm();
  });

  // Edit debt
  container.querySelectorAll('.installment-action-btn.edit-debt').forEach(btn => {
    btn.addEventListener('click', () => {
      const debt = list.find(d => d.id === btn.dataset.id);
      if (debt) openDebtForm(debt);
    });
  });

  // Delete debt
  container.querySelectorAll('.installment-action-btn.delete-debt').forEach(btn => {
    btn.addEventListener('click', async () => {
      const debt = list.find(d => d.id === btn.dataset.id);
      if (debt && confirm(`Bạn có chắc chắn muốn xóa khoản nợ của "${debt.name}" không?`)) {
        try {
          await deleteDebt(debt.id);
          showToast('Đã xóa khoản nợ', 'success');
        } catch (err) {
          showToast('Lỗi: ' + err.message, 'error');
        }
      }
    });
  });

  // Settle Debt (Đã trả xong)
  container.querySelectorAll('.settle-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const debt = list.find(d => d.id === btn.dataset.id);
      if (debt) {
        const confirmMsg = debt.type === 'lend'
          ? `Xác nhận bạn đã THU HỒI đủ số tiền ${formatCurrency(debt.amount)} từ "${debt.name}"? Hệ thống sẽ ghi nhận một giao dịch Thu nhập mới.`
          : `Xác nhận bạn đã TRẢ ĐỦ số tiền ${formatCurrency(debt.amount)} cho "${debt.name}"? Hệ thống sẽ ghi nhận một giao dịch Chi tiêu mới.`;
          
        if (confirm(confirmMsg)) {
          try {
            btn.disabled = true;
            btn.innerHTML = '<span>⏳ Đang xử lý...</span>';
            await settleDebt(debt.id);
            showToast('Đã tất toán và ghi nhận giao dịch thành công!', 'success');
          } catch (err) {
            btn.disabled = false;
            btn.innerHTML = '<span>✅ Đã trả xong</span>';
            showToast('Lỗi: ' + err.message, 'error');
          }
        }
      }
    });
  });
}

// ==========================================
// 3. MODAL FORMS (INSTALLMENTS & DEBTS)
// ==========================================
function openInstallmentForm(existingInst = null) {
  const isEdit = !!existingInst;
  const title = isEdit ? 'Sửa khoản trả góp' : 'Thêm khoản trả góp';
  const categories = getCategoriesByType(getCategories(), 'expense');

  const renderCategoryOptions = () => {
    return categories.map(c =>
      `<option value="${c.id}" ${(existingInst?.categoryId || 'bills') === c.id ? 'selected' : ''}>${c.icon} ${c.name}</option>`
    ).join('');
  };

  const html = `
    <form class="modal-form" id="installment-form">
      <div class="input-group">
        <label for="inst-name">Tên khoản trả góp</label>
        <input type="text" id="inst-name" placeholder="Ví dụ: iPhone 16 Pro Max, Xe máy..." required value="${existingInst?.name || ''}" />
      </div>

      <div class="input-row">
        <div class="input-group">
          <label for="inst-totalAmount">Tổng số tiền (VNĐ)</label>
          <input type="number" id="inst-totalAmount" placeholder="0" required min="1" value="${existingInst?.totalAmount || ''}" inputmode="numeric" />
        </div>
        <div class="input-group">
          <label for="inst-monthlyAmount">Tiền đóng mỗi tháng</label>
          <input type="number" id="inst-monthlyAmount" placeholder="0" required min="1" value="${existingInst?.monthlyAmount || ''}" inputmode="numeric" />
        </div>
      </div>

      <div class="input-row">
        <div class="input-group">
          <label for="inst-monthsTotal">Tổng số tháng</label>
          <input type="number" id="inst-monthsTotal" placeholder="12" required min="1" value="${existingInst?.monthsTotal || ''}" inputmode="numeric" />
        </div>
        <div class="input-group">
          <label for="inst-monthsPaid">Số tháng đã đóng</label>
          <input type="number" id="inst-monthsPaid" placeholder="0" required min="0" value="${existingInst?.monthsPaid ?? 0}" inputmode="numeric" />
        </div>
      </div>

      <div class="input-row">
        <div class="input-group">
          <label for="inst-dueDate">Ngày đóng hàng tháng</label>
          <input type="number" id="inst-dueDate" placeholder="Ngày đóng (e.g. 5)" required min="1" max="31" value="${existingInst?.dueDate || 5}" inputmode="numeric" />
        </div>
        <div class="input-group">
          <label for="inst-wallet">Tài khoản mặc định</label>
          <select id="inst-wallet" required>
            <option value="bank" ${(existingInst?.wallet || 'bank') === 'bank' ? 'selected' : ''}>💳 Tài khoản ngân hàng</option>
            <option value="cash" ${existingInst?.wallet === 'cash' ? 'selected' : ''}>💵 Tiền mặt</option>
          </select>
        </div>
      </div>

      <div class="input-group">
        <label for="inst-category">Danh mục liên kết</label>
        <select id="inst-category" required>
          ${renderCategoryOptions()}
        </select>
      </div>

      <div class="input-group">
        <label for="inst-note">Ghi chú</label>
        <input type="text" id="inst-note" placeholder="Thêm mô tả nếu có..." value="${existingInst?.note || ''}" />
      </div>

      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="inst-cancel">Hủy</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Cập nhật' : 'Thêm'}</button>
      </div>
    </form>
  `;

  openModal(title, html, (body) => {
    const form = body.querySelector('#installment-form');

    body.querySelector('#inst-cancel').addEventListener('click', closeModal);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const totalAmt = Number(body.querySelector('#inst-totalAmount').value) || 0;
      const monthlyAmt = Number(body.querySelector('#inst-monthlyAmount').value) || 0;
      const monthsTotal = Number(body.querySelector('#inst-monthsTotal').value) || 1;
      const monthsPaid = Number(body.querySelector('#inst-monthsPaid').value) || 0;

      const data = {
        name: body.querySelector('#inst-name').value,
        totalAmount: totalAmt,
        monthlyAmount: monthlyAmt,
        monthsTotal: monthsTotal,
        monthsPaid: monthsPaid,
        dueDate: Number(body.querySelector('#inst-dueDate').value) || 5,
        wallet: body.querySelector('#inst-wallet').value,
        categoryId: body.querySelector('#inst-category').value,
        note: body.querySelector('#inst-note').value,
        status: monthsPaid >= monthsTotal ? 'completed' : 'active',
      };

      try {
        if (isEdit) {
          await updateInstallment(existingInst.id, data);
          showToast('Đã cập nhật khoản trả góp', 'success');
        } else {
          await addInstallment(data);
          showToast('Đã thêm khoản trả góp mới', 'success');
        }
        closeModal();
      } catch (err) {
        showToast('Lỗi: ' + err.message, 'error');
      }
    });
  });
}

function openDebtForm(existingDebt = null) {
  const isEdit = !!existingDebt;
  const title = isEdit ? 'Sửa khoản nợ' : 'Thêm khoản nợ mới';
  
  const currentType = existingDebt?.type || 'lend';
  const currentDate = existingDebt?.date?.toDate 
    ? existingDebt.date.toDate().toISOString().split('T')[0]
    : existingDebt?.date
      ? new Date(existingDebt.date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

  const html = `
    <form class="modal-form" id="debt-form">
      <div class="type-toggle">
        <button type="button" class="type-toggle-btn ${currentType === 'lend' ? 'active income' : ''}" data-type="lend" style="flex: 1;">🟢 Tôi cho vay</button>
        <button type="button" class="type-toggle-btn ${currentType === 'borrow' ? 'active expense' : ''}" data-type="borrow" style="flex: 1;">🔴 Tôi đi vay</button>
      </div>

      <div class="input-group">
        <label for="debt-name" id="label-debt-name">Tên người nợ</label>
        <input type="text" id="debt-name" placeholder="Ví dụ: Anh Tuấn, Bạn Linh..." required value="${existingDebt?.name || ''}" />
      </div>

      <div class="input-row">
        <div class="input-group">
          <label for="debt-amount">Số tiền (VNĐ)</label>
          <input type="number" id="debt-amount" placeholder="0" required min="1" value="${existingDebt?.amount || ''}" inputmode="numeric" />
        </div>
        <div class="input-group">
          <label for="debt-wallet">Tài khoản giao dịch</label>
          <select id="debt-wallet" required>
            <option value="bank" ${(existingDebt?.wallet || 'bank') === 'bank' ? 'selected' : ''}>💳 Tài khoản ngân hàng</option>
            <option value="cash" ${existingDebt?.wallet === 'cash' ? 'selected' : ''}>💵 Tiền mặt</option>
          </select>
        </div>
      </div>

      <div class="input-row">
        <div class="input-group">
          <label for="debt-date">Ngày vay</label>
          <input type="date" id="debt-date" required value="${currentDate}" />
        </div>
        <div class="input-group">
          <label for="debt-dueDate">Hạn trả (Không bắt buộc)</label>
          <input type="date" id="debt-dueDate" value="${existingDebt?.dueDate || ''}" />
        </div>
      </div>

      <div class="input-group">
        <label for="debt-note">Nội dung / Ghi chú</label>
        <input type="text" id="debt-note" placeholder="Mượn đóng học phí, mua hộ đồ..." value="${existingDebt?.note || ''}" />
      </div>

      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="debt-cancel">Hủy</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Cập nhật' : 'Thêm'}</button>
      </div>
    </form>
  `;

  openModal(title, html, (body) => {
    const form = body.querySelector('#debt-form');
    const typeToggleBtns = body.querySelectorAll('.type-toggle-btn');
    const nameLabel = body.querySelector('#label-debt-name');
    let selectedType = currentType;

    const updateLabels = (type) => {
      if (type === 'lend') {
        nameLabel.textContent = 'Tên người nợ (Họ nợ mình)';
      } else {
        nameLabel.textContent = 'Tên người cho vay (Mình nợ họ)';
      }
    };
    updateLabels(selectedType);

    // Type toggler
    typeToggleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        typeToggleBtns.forEach(b => b.classList.remove('active', 'income', 'expense'));
        btn.classList.add('active', btn.dataset.type === 'lend' ? 'income' : 'expense');
        selectedType = btn.dataset.type;
        updateLabels(selectedType);
      });
    });

    body.querySelector('#debt-cancel').addEventListener('click', closeModal);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        name: body.querySelector('#debt-name').value,
        amount: Number(body.querySelector('#debt-amount').value) || 0,
        type: selectedType,
        wallet: body.querySelector('#debt-wallet').value,
        date: body.querySelector('#debt-date').value,
        dueDate: body.querySelector('#debt-dueDate').value || '',
        note: body.querySelector('#debt-note').value,
        status: existingDebt?.status || 'unpaid',
      };

      try {
        if (isEdit) {
          await updateDebt(existingDebt.id, data);
          showToast('Đã cập nhật khoản nợ', 'success');
        } else {
          await addDebt(data);
          showToast('Đã thêm khoản nợ mới', 'success');
        }
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

export function destroyInstallments() {
  cleanup();
}
