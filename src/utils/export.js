// CSV Export utility
import { formatDate, formatCurrency } from './format.js';
import { getCategoryById } from './categories.js';

export function exportToCSV(transactions, categories) {
  const headers = ['Ngày', 'Loại', 'Danh mục', 'Ghi chú', 'Số tiền'];

  const rows = transactions.map(t => {
    const cat = getCategoryById(categories, t.categoryId);
    const date = t.date?.toDate ? t.date.toDate() : new Date(t.date);
    return [
      formatDate(date),
      t.type === 'income' ? 'Thu nhập' : 'Chi tiêu',
      cat.name,
      `"${(t.note || '').replace(/"/g, '""')}"`,
      t.amount,
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `managemoney_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
