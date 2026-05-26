// Dashboard page
import { getMonthSummary, getCategorySpending, getDailySpending, getTransactions, getCategories, on, getOverallBalance, getCashBalance, getBankBalance, getInstallments, getStreakStatus } from '../store.js';
import { formatCurrency, formatDateRelative, formatCompact } from '../utils/format.js';
import { getCategoryById } from '../utils/categories.js';
import { openTransactionForm } from '../components/transaction-form.js';
import Chart from 'chart.js/auto';

let pieChart = null;
let barChart = null;
let unsubscribers = [];

export function renderDashboard(container) {
  cleanup();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  function render() {
    const summary = getMonthSummary(year, month);
    const overallBalance = getOverallBalance();
    const cashBalance = getCashBalance();
    const bankBalance = getBankBalance();
    const catSpending = getCategorySpending(year, month);
    const dailyData = getDailySpending(7);
    const transactions = getTransactions();
    const categories = getCategories();
    const recent = transactions.slice(0, 5);
    const streak = getStreakStatus();

    // Compute installments stats
    const instList = getInstallments();
    const activeInst = instList.filter(i => (i.status || 'active') === 'active');
    const totalRemaining = activeInst.reduce((sum, i) => {
      const remainingMonths = Math.max(0, i.monthsTotal - i.monthsPaid);
      return sum + (remainingMonths * i.monthlyAmount);
    }, 0);
    const monthlyDue = activeInst.reduce((sum, i) => sum + i.monthlyAmount, 0);

    container.innerHTML = `
      <div class="page-enter">
        <!-- Streak Banner -->
        <div class="streak-banner ${streak.isTodayActive ? 'active' : 'inactive'}">
          <div class="streak-main">
            <div class="streak-fire-wrapper">
              <div class="streak-fire-glow"></div>
              <span class="streak-fire-icon ${streak.isTodayActive ? 'burning' : 'cold'}">🔥</span>
              <span class="streak-count-value">${streak.currentStreak}</span>
            </div>
            <div class="streak-details">
              <h3 class="streak-title">Chuỗi giữ lửa hàng ngày</h3>
              <p class="streak-message">
                ${streak.isTodayActive 
                  ? 'Tuyệt vời! Bạn đã ghi chép giao dịch hôm nay để giữ lửa. Hãy tiếp tục nhé! 🎉' 
                  : 'Hôm nay bạn chưa thêm giao dịch. Hãy thêm ngay 1 giao dịch để giữ lửa nhé! 💪'}
              </p>
              <div class="streak-sub-info">
                <span>🏆 Kỷ lục: <strong>${streak.longestStreak} ngày</strong></span>
              </div>
            </div>
          </div>
          <div class="streak-weekly">
            <div class="streak-weekly-title">Tiến độ 7 ngày qua</div>
            <div class="streak-days-list">
              ${streak.streakDays.map(day => `
                <div class="streak-day-item ${day.isActive ? 'active' : ''} ${day.isToday ? 'today' : ''}">
                  <span class="streak-day-label">${day.dayLabel}</span>
                  <div class="streak-day-circle">
                    ${day.isActive ? '🔥' : '•'}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Stat Cards -->
        <div class="dashboard-stats">
          <div class="stat-card" style="--stat-color: var(--income)">
            <div class="stat-icon" style="background: var(--income-subtle)">📥</div>
            <div class="stat-label">Thu nhập</div>
            <div class="stat-value" style="color: var(--income)">${formatCurrency(summary.income)}</div>
          </div>
          <div class="stat-card" style="--stat-color: var(--expense)">
            <div class="stat-icon" style="background: var(--expense-subtle)">📤</div>
            <div class="stat-label">Chi tiêu</div>
            <div class="stat-value" style="color: var(--expense)">${formatCurrency(summary.expense)}</div>
          </div>
          <div class="stat-card" style="--stat-color: var(--accent)">
            <div class="stat-icon" style="background: var(--accent-subtle)">💎</div>
            <div class="stat-label">Số dư</div>
            <div class="stat-value">${formatCurrency(overallBalance)}</div>
            <div class="stat-subtext-container">
              <span class="stat-subtext-item">💵 Tiền mặt: <strong>${formatCurrency(cashBalance)}</strong></span>
              <span class="stat-divider">|</span>
              <span class="stat-subtext-item">💳 Tài khoản: <strong>${formatCurrency(bankBalance)}</strong></span>
            </div>
          </div>
          <div class="stat-card" style="--stat-color: var(--warning)">
            <div class="stat-icon" style="background: var(--warning-subtle)">💳</div>
            <div class="stat-label">Trả góp tháng này</div>
            <div class="stat-value" style="color: var(--warning)">${formatCurrency(monthlyDue)}</div>
            <div class="stat-subtext-container">
              <span class="stat-subtext-item">💸 Dư nợ còn lại: <strong>${formatCurrency(totalRemaining)}</strong></span>
            </div>
          </div>
        </div>

        <!-- Charts -->
        <div class="dashboard-charts">
          <div class="card">
            <div class="card-header">
              <span class="card-title">Chi tiêu theo danh mục</span>
            </div>
            <div class="chart-container" style="height: 260px;">
              <canvas id="pie-chart"></canvas>
            </div>
          </div>
          <div class="card">
            <div class="card-header">
              <span class="card-title">7 ngày gần nhất</span>
            </div>
            <div class="chart-container" style="height: 260px;">
              <canvas id="bar-chart"></canvas>
            </div>
          </div>
        </div>

        <!-- Recent transactions -->
        <div class="dashboard-recent">
          <div class="card">
            <div class="card-header">
              <span class="card-title">Giao dịch gần đây</span>
              <a href="#transactions" class="btn btn-ghost btn-sm" data-nav="transactions">Xem tất cả</a>
            </div>
            <div class="list-group">
              ${recent.length === 0 ? `
                <div class="empty-state">
                  <div class="empty-state-icon">📝</div>
                  <div class="empty-state-title">Chưa có giao dịch</div>
                  <div class="empty-state-text">Nhấn nút + để thêm giao dịch đầu tiên</div>
                </div>
              ` : recent.map(tx => {
                const cat = getCategoryById(categories, tx.categoryId);
                const d = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
                return `
                  <div class="transaction-item" data-id="${tx.id}">
                    <div class="transaction-icon" style="background: ${cat.color}20">${cat.icon}</div>
                    <div class="transaction-info">
                      <div class="transaction-name">${tx.note || cat.name}</div>
                      <div class="transaction-category">${cat.name}</div>
                    </div>
                    <div style="text-align: right;">
                      <div class="transaction-amount ${tx.type}">${tx.type === 'income' ? '+' : '-'}${formatCurrency(tx.amount)}</div>
                      <div class="transaction-date">${formatDateRelative(d)}</div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    // Render charts
    renderPieChart(catSpending, categories);
    renderBarChart(dailyData);

    // Click handler for recent transactions
    container.querySelectorAll('.transaction-item[data-id]').forEach(el => {
      el.addEventListener('click', () => {
        const tx = transactions.find(t => t.id === el.dataset.id);
        if (tx) openTransactionForm(tx);
      });
    });

    // Nav link
    container.querySelectorAll('[data-nav]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('navigate', { detail: el.dataset.nav }));
      });
    });
  }

  render();
  unsubscribers.push(on('transactions', render));
  unsubscribers.push(on('installments', render));
  unsubscribers.push(on('profile', render));
}

function renderPieChart(catSpending, categories) {
  const canvas = document.getElementById('pie-chart');
  if (!canvas) return;

  if (pieChart) pieChart.destroy();

  if (catSpending.length === 0) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-tertiary');
    ctx.font = '14px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('Chưa có dữ liệu', canvas.width / 2, canvas.height / 2);
    return;
  }

  const labels = catSpending.map(s => getCategoryById(categories, s.categoryId).name);
  const data = catSpending.map(s => s.amount);
  const colors = catSpending.map(s => getCategoryById(categories, s.categoryId).color);

  pieChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 0,
        hoverBorderWidth: 2,
        hoverBorderColor: '#fff',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: getComputedStyle(document.body).getPropertyValue('--text-secondary'),
            font: { family: 'Inter', size: 11 },
            padding: 12,
            usePointStyle: true,
            pointStyleWidth: 10,
          },
        },
        tooltip: {
          backgroundColor: 'rgba(15,17,25,0.9)',
          titleFont: { family: 'Inter' },
          bodyFont: { family: 'Inter' },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (ctx) => ` ${formatCurrency(ctx.raw)}`,
          },
        },
      },
    },
  });
}

function renderBarChart(dailyData) {
  const canvas = document.getElementById('bar-chart');
  if (!canvas) return;

  if (barChart) barChart.destroy();

  const labels = dailyData.map(d => d.date.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit' }));

  barChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Thu nhập',
          data: dailyData.map(d => d.income),
          backgroundColor: getComputedStyle(document.body).getPropertyValue('--income'),
          borderRadius: 6,
          borderSkipped: false,
          barPercentage: 0.7,
        },
        {
          label: 'Chi tiêu',
          data: dailyData.map(d => d.expense),
          backgroundColor: getComputedStyle(document.body).getPropertyValue('--expense'),
          borderRadius: 6,
          borderSkipped: false,
          barPercentage: 0.7,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: getComputedStyle(document.body).getPropertyValue('--text-tertiary'),
            font: { family: 'Inter', size: 10 },
          },
        },
        y: {
          grid: {
            color: getComputedStyle(document.body).getPropertyValue('--border'),
          },
          ticks: {
            color: getComputedStyle(document.body).getPropertyValue('--text-tertiary'),
            font: { family: 'Inter', size: 10 },
            callback: (v) => formatCompact(v),
          },
        },
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: getComputedStyle(document.body).getPropertyValue('--text-secondary'),
            font: { family: 'Inter', size: 11 },
            usePointStyle: true,
            pointStyleWidth: 10,
            padding: 12,
          },
        },
        tooltip: {
          backgroundColor: 'rgba(15,17,25,0.9)',
          titleFont: { family: 'Inter' },
          bodyFont: { family: 'Inter' },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`,
          },
        },
      },
    },
  });
}

function cleanup() {
  unsubscribers.forEach(fn => fn());
  unsubscribers = [];
  if (pieChart) { pieChart.destroy(); pieChart = null; }
  if (barChart) { barChart.destroy(); barChart = null; }
}

export function destroyDashboard() {
  cleanup();
}
