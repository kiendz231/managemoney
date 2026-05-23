// Transaction form component
import { getCategories, addTransaction, updateTransaction } from '../store.js';
import { getCategoriesByType } from '../utils/categories.js';
import { toInputDate } from '../utils/format.js';
import { openModal, closeModal } from './modal.js';
import { showToast } from './toast.js';

export function openTransactionForm(existingTx = null) {
  const isEdit = !!existingTx;
  const title = isEdit ? 'Sửa giao dịch' : 'Thêm giao dịch';

  const currentType = existingTx?.type || 'expense';
  const categories = getCategories();
  const expenseCats = getCategoriesByType(categories, 'expense');
  const incomeCats = getCategoriesByType(categories, 'income');

  const currentDate = existingTx?.date?.toDate
    ? toInputDate(existingTx.date.toDate())
    : existingTx?.date
      ? toInputDate(new Date(existingTx.date))
      : toInputDate(new Date());

  const renderCategoryOptions = (type) => {
    const cats = type === 'expense' ? expenseCats : incomeCats;
    return cats.map(c =>
      `<option value="${c.id}" ${existingTx?.categoryId === c.id ? 'selected' : ''}>${c.icon} ${c.name}</option>`
    ).join('');
  };

  const html = `
    <form class="modal-form" id="transaction-form">
      <div class="type-toggle">
        <button type="button" class="type-toggle-btn ${currentType === 'expense' ? 'active expense' : ''}" data-type="expense">Chi tiêu</button>
        <button type="button" class="type-toggle-btn ${currentType === 'income' ? 'active income' : ''}" data-type="income">Thu nhập</button>
      </div>

      <div class="input-group">
        <label for="tx-amount">Số tiền (VNĐ)</label>
        <input type="number" id="tx-amount" placeholder="0" required min="1" value="${existingTx?.amount || ''}" inputmode="numeric" />
      </div>

      <div class="input-group">
        <label for="tx-category">Danh mục</label>
        <select id="tx-category" required>
          ${renderCategoryOptions(currentType)}
        </select>
      </div>

      <div class="input-group">
        <label for="tx-wallet">Tài khoản thanh toán</label>
        <select id="tx-wallet" required>
          <option value="cash" ${(existingTx?.wallet || 'cash') === 'cash' ? 'selected' : ''}>💵 Tiền mặt</option>
          <option value="bank" ${existingTx?.wallet === 'bank' ? 'selected' : ''}>💳 Tài khoản ngân hàng</option>
        </select>
      </div>

      <div class="input-group">
        <label for="tx-note">Ghi chú</label>
        <input type="text" id="tx-note" placeholder="Mô tả giao dịch..." value="${existingTx?.note || ''}" />
      </div>

      <div class="input-group">
        <label for="tx-date">Ngày</label>
        <input type="date" id="tx-date" required value="${currentDate}" />
      </div>

      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="tx-cancel">Hủy</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Cập nhật' : 'Thêm'}</button>
      </div>
    </form>
  `;

  openModal(title, html, (body) => {
    const form = body.querySelector('#transaction-form');
    const typeToggleBtns = body.querySelectorAll('.type-toggle-btn');
    const categorySelect = body.querySelector('#tx-category');
    let selectedType = currentType;

    // Type toggle
    typeToggleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        typeToggleBtns.forEach(b => b.classList.remove('active', 'expense', 'income'));
        btn.classList.add('active', btn.dataset.type);
        selectedType = btn.dataset.type;
        categorySelect.innerHTML = renderCategoryOptions(selectedType);
      });
    });

    // Cancel
    body.querySelector('#tx-cancel').addEventListener('click', closeModal);

    // Submit
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        type: selectedType,
        amount: body.querySelector('#tx-amount').value,
        categoryId: categorySelect.value,
        wallet: body.querySelector('#tx-wallet').value,
        note: body.querySelector('#tx-note').value,
        date: body.querySelector('#tx-date').value,
      };

      try {
        if (isEdit) {
          await updateTransaction(existingTx.id, data);
          showToast('Đã cập nhật giao dịch', 'success');
        } else {
          await addTransaction(data);
          showToast('Đã thêm giao dịch mới', 'success');
        }
        closeModal();
      } catch (err) {
        console.error(err);
        showToast('Có lỗi xảy ra: ' + err.message, 'error');
      }
    });
  });
}
