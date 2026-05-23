// Default expense categories with icons and colors
export const DEFAULT_CATEGORIES = [
  // Expenses
  { id: 'food', name: 'Ăn uống', icon: '🍜', color: '#FF6B6B', type: 'expense' },
  { id: 'transport', name: 'Di chuyển', icon: '🚗', color: '#4ECDC4', type: 'expense' },
  { id: 'shopping', name: 'Mua sắm', icon: '🛍️', color: '#FFE66D', type: 'expense' },
  { id: 'bills', name: 'Hóa đơn', icon: '📄', color: '#A8E6CF', type: 'expense' },
  { id: 'entertainment', name: 'Giải trí', icon: '🎬', color: '#FF8A5C', type: 'expense' },
  { id: 'health', name: 'Sức khỏe', icon: '💊', color: '#6C5CE7', type: 'expense' },
  { id: 'education', name: 'Học tập', icon: '📚', color: '#00B894', type: 'expense' },
  { id: 'rent', name: 'Thuê nhà', icon: '🏠', color: '#FDCB6E', type: 'expense' },
  { id: 'phone', name: 'Điện thoại', icon: '📱', color: '#74B9FF', type: 'expense' },
  { id: 'gift', name: 'Quà tặng', icon: '🎁', color: '#E17055', type: 'expense' },
  { id: 'coffee', name: 'Cà phê', icon: '☕', color: '#D4A574', type: 'expense' },
  { id: 'other_expense', name: 'Khác', icon: '📦', color: '#B2BEC3', type: 'expense' },
  // Income
  { id: 'salary', name: 'Lương', icon: '💼', color: '#00B894', type: 'income' },
  { id: 'freelance', name: 'Freelance', icon: '💻', color: '#00CEC9', type: 'income' },
  { id: 'investment', name: 'Đầu tư', icon: '📈', color: '#6C5CE7', type: 'income' },
  { id: 'bonus', name: 'Thưởng', icon: '🏆', color: '#FDCB6E', type: 'income' },
  { id: 'other_income', name: 'Thu nhập khác', icon: '💰', color: '#55EFC4', type: 'income' },
];

export function getCategoryById(categories, id) {
  return categories.find(c => c.id === id) || { id: 'unknown', name: 'Không xác định', icon: '❓', color: '#B2BEC3', type: 'expense' };
}

export function getCategoriesByType(categories, type) {
  return categories.filter(c => c.type === type);
}
