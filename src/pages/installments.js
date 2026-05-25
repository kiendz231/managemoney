// Installments page
import { getInstallments, getCategories, addInstallment, updateInstallment, deleteInstallment, payInstallmentTerm, on } from '../store.js';
import { formatCurrency, formatCompact } from '../utils/format.js';
import { getCategoryById, getCategoriesByType } from '../utils/categories.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

let unsubscribers = [];
let currentFilter = 'active'; // 'active' | 'completed'

export function renderInstallments(container) {
  cleanup();

  function render() {
    const list = getInstallments();
    const categories = getCategories();

    // Filter list
    const filtered = list.filter(i => (i.status || 'active') === currentFilter);

    // Compute metrics
    const activeList = list.filter(i => (i.status || 'active') === 'active');
    const totalRemaining = activeList.reduce((sum, i) => {
      const remainingMonths = Math.max(0, i.monthsTotal - i.monthsPaid);
      return sum + (remainingMonths * i.monthlyAmount);
    }, 0);
    const monthlyDue = activeList.reduce((sum, i) => sum + i.monthlyAmount, 0);
    const completedCount = list.filter(i => (i.status || 'active') === 'completed').length;

    container.innerHTML = `
      <div class="page-enter">
        <div class="installments-header">
          <div class="tabs">
            <button class="tab-btn ${currentFilter === 'active' ? 'active' : ''}" id="btn-filter-active">Đang trả góp</button>
            <button class="tab-btn ${currentFilter === 'completed' ? 'active' : ''}" id="btn-filter-completed">Đã trả xong</button>
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
              <div class="empty-state-title">${currentFilter === 'active' ? 'Không có khoản trả góp nào đang chạy' : 'Chưa có khoản trả góp nào hoàn thành'}</div>
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
                    <button class="installment-action-btn edit" data-id="${inst.id}" aria-label="Sửa">✏️</button>
                    <button class="installment-action-btn delete" data-id="${inst.id}" aria-label="Xóa">🗑️</button>
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
      </div>
    `;

    // Add filter event listeners
    container.querySelector('#btn-filter-active').addEventListener('click', () => {
      currentFilter = 'active';
      render();
    });
    container.querySelector('#btn-filter-completed').addEventListener('click', () => {
      currentFilter = 'completed';
      render();
    });

    // Add new installment handler
    container.querySelector('#btn-add-installment').addEventListener('click', () => {
      openInstallmentForm();
    });

    // Edit and Delete handler
    container.querySelectorAll('.installment-action-btn.edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const inst = list.find(i => i.id === btn.dataset.id);
        if (inst) openInstallmentForm(inst);
      });
    });

    container.querySelectorAll('.installment-action-btn.delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
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

    // Quick pay handler
    container.querySelectorAll('.quick-pay-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
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

  render();
  unsubscribers.push(on('installments', render));
  unsubscribers.push(on('transactions', render));
}

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

function cleanup() {
  unsubscribers.forEach(fn => fn());
  unsubscribers = [];
}

export function destroyInstallments() {
  cleanup();
}
