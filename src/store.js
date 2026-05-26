// State management store - Firestore CRUD operations
import { db } from './firebase.js';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  setDoc,
  getDoc,
} from 'firebase/firestore';
import { DEFAULT_CATEGORIES } from './utils/categories.js';

let currentUserId = null;
let unsubscribers = [];

// Cached data
let transactions = [];
let categories = [...DEFAULT_CATEGORIES];
let budgets = [];
let installments = [];
let debts = [];
let userProfile = {};
let listeners = {};

export function setUserId(uid) {
  // Clean up previous listeners
  unsubscribers.forEach(unsub => unsub());
  unsubscribers = [];
  transactions = [];
  categories = [...DEFAULT_CATEGORIES];
  budgets = [];
  installments = [];
  debts = [];
  userProfile = {};

  currentUserId = uid;
  if (uid) {
    subscribeToData();
  }
}

function userRef() {
  return doc(db, 'users', currentUserId);
}

function transactionsRef() {
  return collection(db, 'users', currentUserId, 'transactions');
}

function categoriesRef() {
  return collection(db, 'users', currentUserId, 'categories');
}

function budgetsRef() {
  return collection(db, 'users', currentUserId, 'budgets');
}

function installmentsRef() {
  return collection(db, 'users', currentUserId, 'installments');
}

function debtsRef() {
  return collection(db, 'users', currentUserId, 'debts');
}

// ------ Subscribe to realtime updates ------
function subscribeToData() {
  // Transactions
  const qTx = query(transactionsRef(), orderBy('date', 'desc'));
  const unsubTx = onSnapshot(qTx, (snapshot) => {
    transactions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    emit('transactions');
  });
  unsubscribers.push(unsubTx);

  // Custom categories
  const unsubCat = onSnapshot(categoriesRef(), (snapshot) => {
    const custom = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Custom active (not deleted)
    const customActive = custom.filter(c => !c.deleted);
    // Custom deleted IDs (default categories soft-deleted)
    const deletedIds = new Set(custom.filter(c => c.deleted).map(c => c.id));
    // Custom active IDs
    const activeIds = new Set(customActive.map(c => c.id));

    categories = [
      ...DEFAULT_CATEGORIES.filter(c => !activeIds.has(c.id) && !deletedIds.has(c.id)),
      ...customActive,
    ];
    emit('categories');
  });
  unsubscribers.push(unsubCat);

  // Budgets
  const unsubBudget = onSnapshot(budgetsRef(), (snapshot) => {
    budgets = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    emit('budgets');
  });
  unsubscribers.push(unsubBudget);

  // Installments
  const unsubInstallments = onSnapshot(installmentsRef(), (snapshot) => {
    installments = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    emit('installments');
  });
  unsubscribers.push(unsubInstallments);

  // Debts
  const unsubDebts = onSnapshot(debtsRef(), (snapshot) => {
    debts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    emit('debts');
  });
  unsubscribers.push(unsubDebts);

  // User profile
  const unsubProfile = onSnapshot(userRef(), (docSnap) => {
    if (docSnap.exists()) {
      userProfile = docSnap.data();
    }
    emit('profile');
  });
  unsubscribers.push(unsubProfile);
}

// ------ Event system ------
function emit(event) {
  if (listeners[event]) {
    listeners[event].forEach(fn => fn());
  }
}

export function on(event, fn) {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(fn);
  return () => {
    listeners[event] = listeners[event].filter(f => f !== fn);
  };
}

// ------ Getters ------
export function getTransactions() { return transactions; }
export function getCategories() { return categories; }
export function getBudgets() { return budgets; }
export function getInstallments() { return installments; }
export function getDebts() { return debts; }
export function getUserProfile() { return userProfile; }

// ------ Transaction CRUD ------
export async function addTransaction(data) {
  let dateObj;
  try {
    dateObj = data.date ? new Date(data.date) : new Date();
    if (isNaN(dateObj.getTime())) {
      dateObj = new Date();
    }
  } catch (e) {
    dateObj = new Date();
  }

  const txData = {
    type: data.type,
    amount: Number(data.amount) || 0,
    categoryId: data.categoryId || (data.type === 'income' ? 'other_income' : 'other_expense'),
    wallet: data.wallet || 'cash',
    note: data.note || '',
    date: Timestamp.fromDate(dateObj),
    isRecurring: data.isRecurring || false,
    recurringPattern: data.recurringPattern || null,
    createdAt: Timestamp.now(),
  };
  return addDoc(transactionsRef(), txData);
}

export async function updateTransaction(id, data) {
  const updateData = {};
  if (data.type !== undefined) updateData.type = data.type;
  if (data.amount !== undefined) updateData.amount = Number(data.amount) || 0;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId || (data.type === 'income' ? 'other_income' : 'other_expense');
  if (data.wallet !== undefined) updateData.wallet = data.wallet;
  if (data.note !== undefined) updateData.note = data.note;
  if (data.date !== undefined) {
    let dateObj = new Date(data.date);
    if (isNaN(dateObj.getTime())) dateObj = new Date();
    updateData.date = Timestamp.fromDate(dateObj);
  }
  if (data.isRecurring !== undefined) updateData.isRecurring = data.isRecurring;
  if (data.recurringPattern !== undefined) updateData.recurringPattern = data.recurringPattern;
  return updateDoc(doc(transactionsRef(), id), updateData);
}

export async function deleteTransaction(id) {
  return deleteDoc(doc(transactionsRef(), id));
}

// ------ Category CRUD ------
export async function addCategory(data) {
  const docId = data.id || data.name.toLowerCase().trim().replace(/[\/\s\.]+/g, '_');
  return setDoc(doc(categoriesRef(), docId), {
    name: data.name,
    icon: data.icon,
    color: data.color,
    type: data.type,
  });
}

export async function deleteCategory(id) {
  const defaultIds = new Set([
    'food', 'transport', 'shopping', 'bills', 'entertainment', 'health', 'education', 
    'rent', 'phone', 'gift', 'coffee', 'other_expense', 'salary', 'freelance', 
    'investment', 'bonus', 'other_income'
  ]);
  
  if (defaultIds.has(id)) {
    // If it's a default category, soft-delete it by setting deleted: true in Firestore
    return setDoc(doc(categoriesRef(), id), { deleted: true });
  } else {
    // If it's a custom category, delete it from Firestore
    return deleteDoc(doc(categoriesRef(), id));
  }
}

// ------ Budget CRUD ------
export async function setBudget(data) {
  const budgetId = `${data.categoryId}_${data.month}`;
  return setDoc(doc(budgetsRef(), budgetId), {
    categoryId: data.categoryId,
    amount: Number(data.amount),
    month: data.month,
    createdAt: Timestamp.now(),
  });
}

export async function deleteBudget(id) {
  return deleteDoc(doc(budgetsRef(), id));
}

// ------ Installments CRUD ------
export async function addInstallment(data) {
  const instData = {
    name: data.name || '',
    totalAmount: Number(data.totalAmount) || 0,
    monthlyAmount: Number(data.monthlyAmount) || 0,
    monthsTotal: Number(data.monthsTotal) || 1,
    monthsPaid: Number(data.monthsPaid) || 0,
    dueDate: Number(data.dueDate) || 1,
    categoryId: data.categoryId || 'bills',
    wallet: data.wallet || 'bank',
    note: data.note || '',
    status: data.status || 'active',
    createdAt: Timestamp.now(),
  };
  return addDoc(installmentsRef(), instData);
}

export async function updateInstallment(id, data) {
  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.totalAmount !== undefined) updateData.totalAmount = Number(data.totalAmount) || 0;
  if (data.monthlyAmount !== undefined) updateData.monthlyAmount = Number(data.monthlyAmount) || 0;
  if (data.monthsTotal !== undefined) updateData.monthsTotal = Number(data.monthsTotal) || 1;
  if (data.monthsPaid !== undefined) updateData.monthsPaid = Number(data.monthsPaid) || 0;
  if (data.dueDate !== undefined) updateData.dueDate = Number(data.dueDate) || 1;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
  if (data.wallet !== undefined) updateData.wallet = data.wallet;
  if (data.note !== undefined) updateData.note = data.note;
  if (data.status !== undefined) updateData.status = data.status;
  return updateDoc(doc(installmentsRef(), id), updateData);
}

export async function deleteInstallment(id) {
  return deleteDoc(doc(installmentsRef(), id));
}

export async function payInstallmentTerm(id) {
  const inst = installments.find(i => i.id === id);
  if (!inst) return;

  const newMonthsPaid = inst.monthsPaid + 1;
  const isCompleted = newMonthsPaid >= inst.monthsTotal;

  // 1. Update term and status
  await updateDoc(doc(installmentsRef(), id), {
    monthsPaid: newMonthsPaid,
    status: isCompleted ? 'completed' : 'active'
  });

  // 2. Automatically record main expense transaction
  await addTransaction({
    type: 'expense',
    amount: inst.monthlyAmount,
    categoryId: inst.categoryId || 'bills',
    wallet: inst.wallet || 'bank',
    note: `Thanh toán trả góp: ${inst.name} (Kỳ ${newMonthsPaid}/${inst.monthsTotal})`,
    date: new Date()
  });
}

// ------ Debts CRUD ------
export async function addDebt(data) {
  const debtData = {
    name: data.name || '',
    amount: Number(data.amount) || 0,
    type: data.type || 'lend', // 'lend' | 'borrow'
    note: data.note || '',
    date: data.date ? Timestamp.fromDate(new Date(data.date)) : Timestamp.now(),
    dueDate: data.dueDate || '',
    wallet: data.wallet || 'bank',
    status: data.status || 'unpaid', // 'unpaid' | 'paid'
    createdAt: Timestamp.now(),
  };
  return addDoc(debtsRef(), debtData);
}

export async function updateDebt(id, data) {
  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.amount !== undefined) updateData.amount = Number(data.amount) || 0;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.note !== undefined) updateData.note = data.note;
  if (data.date !== undefined) {
    updateData.date = Timestamp.fromDate(new Date(data.date));
  }
  if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
  if (data.wallet !== undefined) updateData.wallet = data.wallet;
  if (data.status !== undefined) updateData.status = data.status;
  return updateDoc(doc(debtsRef(), id), updateData);
}

export async function deleteDebt(id) {
  return deleteDoc(doc(debtsRef(), id));
}

export async function settleDebt(id) {
  const debt = debts.find(d => d.id === id);
  if (!debt) return;

  // 1. Update status to 'paid'
  await updateDoc(doc(debtsRef(), id), {
    status: 'paid'
  });

  // 2. Automatically record corresponding transaction
  const isLend = debt.type === 'lend';
  const d = debt.date?.toDate ? debt.date.toDate() : new Date(debt.date);
  
  await addTransaction({
    type: isLend ? 'income' : 'expense',
    amount: debt.amount,
    categoryId: isLend ? 'other_income' : 'other_expense',
    wallet: debt.wallet || 'bank',
    note: isLend 
      ? `Thu nợ từ: ${debt.name} ${debt.note ? `- ${debt.note}` : ''}`
      : `Trả nợ cho: ${debt.name} ${debt.note ? `- ${debt.note}` : ''}`,
    date: new Date()
  });
}

// ------ User Profile ------
export async function updateUserProfile(data) {
  return setDoc(userRef(), data, { merge: true });
}

// ------ Computed helpers ------
export function getCashBalance() {
  const initialCash = Number(userProfile.initialCash || 0);
  const cashIncome = transactions.filter(t => t.type === 'income' && (t.wallet || 'cash') === 'cash').reduce((s, t) => s + t.amount, 0);
  const cashExpense = transactions.filter(t => t.type === 'expense' && (t.wallet || 'cash') === 'cash').reduce((s, t) => s + t.amount, 0);
  return initialCash + cashIncome - cashExpense;
}

export function getBankBalance() {
  const initialBank = Number(userProfile.initialBank || 0);
  const bankIncome = transactions.filter(t => t.type === 'income' && t.wallet === 'bank').reduce((s, t) => s + t.amount, 0);
  const bankExpense = transactions.filter(t => t.type === 'expense' && t.wallet === 'bank').reduce((s, t) => s + t.amount, 0);
  return initialBank + bankIncome - bankExpense;
}

export function getOverallBalance() {
  return getCashBalance() + getBankBalance();
}

export function getTransactionsForMonth(year, month) {
  return transactions.filter(t => {
    const d = t.date?.toDate ? t.date.toDate() : new Date(t.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

export function getMonthSummary(year, month) {
  const monthTx = getTransactionsForMonth(year, month);
  const income = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  return { income, expense, balance: income - expense, count: monthTx.length };
}

export function getCategorySpending(year, month) {
  const monthTx = getTransactionsForMonth(year, month).filter(t => t.type === 'expense');
  const map = {};
  monthTx.forEach(t => {
    if (!map[t.categoryId]) map[t.categoryId] = 0;
    map[t.categoryId] += t.amount;
  });
  return Object.entries(map)
    .map(([categoryId, amount]) => ({ categoryId, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function getDailySpending(days) {
  const now = new Date();
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);

    const dayTx = transactions.filter(t => {
      const td = t.date?.toDate ? t.date.toDate() : new Date(t.date);
      return td >= d && td < next;
    });

    result.push({
      date: new Date(d),
      income: dayTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      expense: dayTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    });
  }
  return result;
}

export function getBudgetStatus(year, month) {
  const spending = getCategorySpending(year, month);
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthBudgets = budgets.filter(b => b.month === monthKey);

  return monthBudgets.map(b => {
    const spent = spending.find(s => s.categoryId === b.categoryId)?.amount || 0;
    const percent = b.amount > 0 ? (spent / b.amount) * 100 : 0;
    return {
      ...b,
      spent,
      percent: Math.min(percent, 100),
      overBudget: spent > b.amount,
      remaining: b.amount - spent,
    };
  });
}

export function getMonthlyTrend(months) {
  const now = new Date();
  const result = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const summary = getMonthSummary(d.getFullYear(), d.getMonth());
    result.push({
      month: d,
      ...summary,
    });
  }
  return result;
}
