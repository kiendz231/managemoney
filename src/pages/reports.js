// Reports page
import { getMonthlyTrend, getCategorySpending, getCategories, getDailySpending, on } from '../store.js';
import { formatCurrency, formatCompact } from '../utils/format.js';
import { getCategoryById } from '../utils/categories.js';
import Chart from 'chart.js/auto';

let trendChart = null;
let categoryChart = null;
let unsubscribers = [];

export function renderReports(container) {
  cleanup();
  let period = 'month'; // week, month, year

  function render() {
    const categories = getCategories();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    // Data based on period
    let trendData, catSpending;
    if (period === 'week') {
      trendData = getDailySpending(7);
      catSpending = getCategorySpending(year, month);
    } else if (period === 'month') {
      trendData = getDailySpending(30);
      catSpending = getCategorySpending(year, month);
    } else {
      trendData = null; // Use monthly trend
      catSpending = getCategorySpending(year, month);
    }

    const monthlyTrend = getMonthlyTrend(6);
    const totalExpense = catSpending.reduce((s, c) => s + c.amount, 0);

    container.innerHTML = `
      <div class="page-enter">
        <div class="reports-header">
          <h3>Báo cáo & Thống kê</h3>
          <div class="reports-period-selector tabs">
            <button class="tab-btn ${period === 'week' ? 'active' : ''}" data-period="week">Tuần</button>
            <button class="tab-btn ${period === 'month' ? 'active' : ''}" data-period="month">Tháng</button>
            <button class="tab-btn ${period === 'year' ? 'active' : ''}" data-period="year">Năm</button>
          </div>
        </div>

        <!-- Charts -->
        <div class="reports-grid">
          <div class="card">
            <div class="card-header">
              <span class="card-title">${period === 'year' ? 'Xu hướng 6 tháng' : period === 'month' ? 'Chi tiêu 30 ngày' : 'Chi tiêu 7 ngày'}</span>
            </div>
            <div class="chart-container" style="height: 280px;">
              <canvas id="trend-chart"></canvas>
            </div>
          </div>
          <div class="card">
            <div class="card-header">
              <span class="card-title">Tỷ lệ danh mục</span>
            </div>
            <div class="chart-container" style="height: 280px;">
              <canvas id="category-report-chart"></canvas>
            </div>
          </div>
        </div>

        <!-- Top categories -->
        <div class="reports-top-categories">
          <div class="card">
            <div class="card-header">
              <span class="card-title">Top chi tiêu</span>
            </div>
            ${catSpending.length === 0 ? `
              <div class="empty-state" style="padding: var(--space-lg);">
                <div class="empty-state-icon">📊</div>
                <div class="empty-state-title">Chưa có dữ liệu</div>
              </div>
            ` : catSpending.slice(0, 8).map((item, index) => {
              const cat = getCategoryById(categories, item.categoryId);
              const percent = totalExpense > 0 ? (item.amount / totalExpense) * 100 : 0;
              return `
                <div class="top-category-item">
                  <span class="top-category-rank">${index + 1}</span>
                  <div class="top-category-icon" style="background: ${cat.color}20">${cat.icon}</div>
                  <div class="top-category-info">
                    <div class="top-category-name">${cat.name}</div>
                    <div class="top-category-bar">
                      <div class="top-category-bar-fill" style="width: ${percent}%; background: ${cat.color}"></div>
                    </div>
                  </div>
                  <div style="text-align: right;">
                    <div class="top-category-amount">${formatCurrency(item.amount)}</div>
                    <div class="top-category-percent">${percent.toFixed(1)}%</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Monthly comparison -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">So sánh theo tháng</span>
          </div>
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: var(--fs-sm);">
              <thead>
                <tr style="border-bottom: 1px solid var(--border);">
                  <th style="text-align: left; padding: var(--space-sm) var(--space-md); color: var(--text-tertiary); font-weight: var(--fw-medium);">Tháng</th>
                  <th style="text-align: right; padding: var(--space-sm) var(--space-md); color: var(--text-tertiary); font-weight: var(--fw-medium);">Thu nhập</th>
                  <th style="text-align: right; padding: var(--space-sm) var(--space-md); color: var(--text-tertiary); font-weight: var(--fw-medium);">Chi tiêu</th>
                  <th style="text-align: right; padding: var(--space-sm) var(--space-md); color: var(--text-tertiary); font-weight: var(--fw-medium);">Chênh lệch</th>
                </tr>
              </thead>
              <tbody>
                ${monthlyTrend.map(m => `
                  <tr style="border-bottom: 1px solid var(--divider);">
                    <td style="padding: var(--space-sm) var(--space-md); text-transform: capitalize;">${m.month.toLocaleDateString('vi-VN', { month: 'short', year: 'numeric' })}</td>
                    <td style="padding: var(--space-sm) var(--space-md); text-align: right; color: var(--income);">${formatCurrency(m.income)}</td>
                    <td style="padding: var(--space-sm) var(--space-md); text-align: right; color: var(--expense);">${formatCurrency(m.expense)}</td>
                    <td style="padding: var(--space-sm) var(--space-md); text-align: right; color: ${m.balance >= 0 ? 'var(--income)' : 'var(--expense)'};">${formatCurrency(m.balance)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Period selector
    container.querySelectorAll('[data-period]').forEach(btn => {
      btn.addEventListener('click', () => {
        period = btn.dataset.period;
        render();
      });
    });

    // Render charts
    renderTrendChart(period, trendData, monthlyTrend);
    renderCategoryChart(catSpending, categories);
  }

  render();
  unsubscribers.push(on('transactions', render));
}

function renderTrendChart(period, dailyData, monthlyTrend) {
  const canvas = document.getElementById('trend-chart');
  if (!canvas) return;
  if (trendChart) trendChart.destroy();

  const style = getComputedStyle(document.body);

  if (period === 'year') {
    trendChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: monthlyTrend.map(m => m.month.toLocaleDateString('vi-VN', { month: 'short' })),
        datasets: [
          {
            label: 'Thu nhập',
            data: monthlyTrend.map(m => m.income),
            backgroundColor: style.getPropertyValue('--income'),
            borderRadius: 6,
            borderSkipped: false,
          },
          {
            label: 'Chi tiêu',
            data: monthlyTrend.map(m => m.expense),
            backgroundColor: style.getPropertyValue('--expense'),
            borderRadius: 6,
            borderSkipped: false,
          },
        ],
      },
      options: chartOptions(style),
    });
  } else {
    trendChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: dailyData.map(d => d.date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })),
        datasets: [{
          label: 'Chi tiêu',
          data: dailyData.map(d => d.expense),
          borderColor: style.getPropertyValue('--expense'),
          backgroundColor: style.getPropertyValue('--expense') + '20',
          fill: true,
          tension: 0.4,
          pointRadius: period === 'week' ? 4 : 0,
          pointHoverRadius: 6,
          borderWidth: 2,
        }],
      },
      options: {
        ...chartOptions(style),
        elements: { point: { borderWidth: 0 } },
      },
    });
  }
}

function renderCategoryChart(catSpending, categories) {
  const canvas = document.getElementById('category-report-chart');
  if (!canvas) return;
  if (categoryChart) categoryChart.destroy();

  if (catSpending.length === 0) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-tertiary');
    ctx.font = '14px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('Chưa có dữ liệu', canvas.width / 2, canvas.height / 2);
    return;
  }

  const style = getComputedStyle(document.body);
  categoryChart = new Chart(canvas, {
    type: 'polarArea',
    data: {
      labels: catSpending.map(s => getCategoryById(categories, s.categoryId).name),
      datasets: [{
        data: catSpending.map(s => s.amount),
        backgroundColor: catSpending.map(s => getCategoryById(categories, s.categoryId).color + '80'),
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: style.getPropertyValue('--text-secondary'),
            font: { family: 'Inter', size: 10 },
            usePointStyle: true,
            padding: 8,
          },
        },
        tooltip: {
          backgroundColor: 'rgba(15,17,25,0.9)',
          titleFont: { family: 'Inter' },
          bodyFont: { family: 'Inter' },
          callbacks: {
            label: (ctx) => ` ${formatCurrency(ctx.raw)}`,
          },
        },
      },
      scales: {
        r: {
          ticks: { display: false },
          grid: { color: style.getPropertyValue('--border') },
        },
      },
    },
  });
}

function chartOptions(style) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: style.getPropertyValue('--text-tertiary'),
          font: { family: 'Inter', size: 10 },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 10,
        },
      },
      y: {
        grid: { color: style.getPropertyValue('--border') },
        ticks: {
          color: style.getPropertyValue('--text-tertiary'),
          font: { family: 'Inter', size: 10 },
          callback: (v) => formatCompact(v),
        },
      },
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: style.getPropertyValue('--text-secondary'),
          font: { family: 'Inter', size: 11 },
          usePointStyle: true,
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
  };
}

function cleanup() {
  unsubscribers.forEach(fn => fn());
  unsubscribers = [];
  if (trendChart) { trendChart.destroy(); trendChart = null; }
  if (categoryChart) { categoryChart.destroy(); categoryChart = null; }
}

export function destroyReports() { cleanup(); }
