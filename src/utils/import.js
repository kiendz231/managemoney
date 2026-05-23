// CSV and Excel Transaction Import utility with robust Vietnamese normalization

const KEYWORD_CATEGORY_MAP = [
  {
    categoryId: 'food',
    keywords: ['an', 'uong', 'com', 'pho', 'bun', 'lau', 'food', 'restaurant', 'mi', 'banh', 'kfc', 'lotteria', 'jollibee', 'pizza', 'hu tieu', 'quan an', 'thuc pham', 'tiec', 'tam hao', 'mcdonald', 'burger']
  },
  {
    categoryId: 'coffee',
    keywords: ['ca phe', 'cafe', 'highlands', 'starbucks', 'tra sua', 'gongcha', 'phuc long', 'the coffee house', 'toco', 'nuoc ngot', 'sinh to', 'juice', 'tap hoa', 'gong cha', 'phong tra', 'tra chanh', 'tiem tra']
  },
  {
    categoryId: 'transport',
    keywords: ['grab', 'taxi', 'xang', 'gas', 'be group', 'gojek', 'xe may', 'o to', 'bus', 've tau', 've xe', 've may bay', 'vietjet', 'vietnam airline', 'bao hiem xe', 'gui xe', 'phi do xe', 'cau duong', 'phe ve']
  },
  {
    categoryId: 'shopping',
    keywords: ['shopee', 'tiki', 'lazada', 'tiktok', 'mua sam', 'shopping', 'sieu thi', 'cho', 'quan ao', 'giay', 'tui xach', 'do gia dung', 'winmart', 'coop', 'bach hoa xanh', 'bhx', 'aeon', 'lotte', 'an nam', 'store', 'shop', 'gs25', 'circle k', '7-eleven', 'bach hoa', 'nha sach', 'dien may', 'the gioi di dong', 'fpt shop']
  },
  {
    categoryId: 'bills',
    keywords: ['internet', 'dien', 'nuoc', 'hoa don', 'bill', 'netflix', 'spotify', 'chung cu', 'phi dich vu', 'truyen hinh', 'cap', 'thue bao', 'tien dien', 'tien nuoc', 'wifi', '4g', 'dich vu']
  },
  {
    categoryId: 'entertainment',
    keywords: ['cgv', 'phim', 'cinema', 'game', 'steam', 'playstation', 'nintendo', 'nap the', 'du lich', 'travel', 'khach san', 'hotel', 'homestay', 'resort', 'karaoke', 'bar', 'club', 'concert', 've xem', 'rap chieu']
  },
  {
    categoryId: 'health',
    keywords: ['thuoc', 'nha thuoc', 'benh vien', 'phong kham', 'bac si', 'medical', 'hospital', 'suc khoe', 'pharmacy', 'pharmacity', 'long chau', 'nha khoa', 'kham rang', 'thuoc tay']
  },
  {
    categoryId: 'education',
    keywords: ['hoc', 'tien hoc', 'hoc phi', 'school', 'tuition', 'sach', 'book', 'khoa hoc', 'coursera', 'udemy', 'edumall', 'tieng anh', 'english', 'ielts', 'toefl']
  },
  {
    categoryId: 'rent',
    keywords: ['thue nha', 'rent', 'phong tro', 'tien nha', 'tien tro', 'nha tro']
  },
  {
    categoryId: 'gift',
    keywords: ['qua tang', 'qua', 'gift', 'mung', 'li xi', 'dam cuoi', 'sinh nhat', 'bieu', 'tang']
  },
  {
    categoryId: 'salary',
    keywords: ['luong', 'salary', 'pay', 'chuyen khoan luong', 'thu nhap luong', 'paycheck', 'vck luong']
  },
  {
    categoryId: 'freelance',
    keywords: ['freelance', 'thu nhap freelance', 'lam them', 'cong tac vien', 'ctv', 'du an']
  },
  {
    categoryId: 'investment',
    keywords: ['dau tu', 'co phieu', 'chung khoan', 'lai', 'tien lai', 'dividend', 'interest', 'tui than tai', 'tien loi', 'tui than']
  },
  {
    categoryId: 'bonus',
    keywords: ['thuong', 'bonus', 'commission', 'hoa hong']
  }
];

// Normalize Vietnamese accents and return pure lowercase unaccented string
export function stripAccents(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim();
}

// Perform safe keyword match avoiding partial matches of short terms
function matchKeyword(noteText, keyword) {
  if (keyword.length < 4) {
    const regex = new RegExp('\\b' + keyword + '\\b', 'i');
    return regex.test(noteText);
  }
  return noteText.includes(keyword);
}

export async function parseTransactionsCSV(text, existingCategories, onNewCategory) {
  // Strip BOM if present
  let cleanText = text;
  if (cleanText.startsWith('\uFEFF')) {
    cleanText = cleanText.slice(1);
  }

  // Robust line-splitting respecting double quotes (ignores newlines inside quoted fields)
  const lines = [];
  let currentLine = '';
  let inQuotes = false;
  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      currentLine += char;
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && cleanText[i + 1] === '\n') {
        i++; // skip \n
      }
      lines.push(currentLine);
      currentLine = '';
    } else {
      currentLine += char;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  if (lines.length < 2) {
    throw new Error('File dữ liệu không đúng định dạng hoặc trống.');
  }

  // 1. Detect separator by scanning up to the first 15 lines for comma/semicolon frequency
  let commaCount = 0;
  let semicolonCount = 0;
  const checkLimit = Math.min(lines.length, 15);
  for (let i = 0; i < checkLimit; i++) {
    commaCount += (lines[i].match(/,/g) || []).length;
    semicolonCount += (lines[i].match(/;/g) || []).length;
  }
  const separator = semicolonCount > commaCount ? ';' : ',';

  // 2. Parse rows helper
  function parseRow(rowText) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < rowText.length; i++) {
      const char = rowText[i];
      if (char === '"') {
        if (inQuotes && rowText[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === separator && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  // 3. Normalized Header aliases map (plain unaccented characters)
  const headerMap = {
    date: ['ngay', 'date', 'time', 'ngay gd', 'ngay giao dich', 'thoi gian'],
    type: ['loai', 'type', 'phan loai', 'thu chi', 'thu/chi'],
    category: ['danh muc', 'category', 'the loai', 'nhom chi tieu'],
    note: ['ghi chu', 'note', 'noi dung', 'noi dung giao dich', 'dien giai', 'mo ta', 'loai giao dich'],
    amount: ['so tien', 'amount', 'tien', 'gia tri', 'so tien giao dich'],
    wallet: ['tai khoan', 'wallet', 'vi', 'nguon', 'vi tien', 'hinh thuc']
  };

  // Scan first 15 rows to find the actual table header row (highest match rate)
  let headerIndex = 0;
  let maxMatches = 0;
  const scanLimit = Math.min(lines.length, 15);

  for (let i = 0; i < scanLimit; i++) {
    const rowColumns = parseRow(lines[i]);
    let matches = 0;
    rowColumns.forEach(col => {
      const cleanCol = stripAccents(col);
      for (const [key, aliases] of Object.entries(headerMap)) {
        if (aliases.some(alias => cleanCol === alias || cleanCol.includes(alias))) {
          matches++;
          break;
        }
      }
    });
    if (matches > maxMatches) {
      maxMatches = matches;
      headerIndex = i;
    }
  }

  const headerRow = parseRow(lines[headerIndex]);

  const colIndices = {
    date: -1,
    type: -1,
    category: -1,
    note: -1,
    amount: -1,
    wallet: -1
  };

  // 4. Two-Pass header matching with strict guards
  // Pass 1: Exact Match (prevents generic terms from mismatching)
  headerRow.forEach((h, index) => {
    const cleanH = stripAccents(h);
    for (const [key, aliases] of Object.entries(headerMap)) {
      // Rule: columns containing "giao dich" or "gd" should not match category or type
      if ((cleanH.includes('giao dich') || cleanH.includes('gd')) && (key === 'category' || key === 'type')) {
        continue;
      }
      if (aliases.includes(cleanH)) {
        colIndices[key] = index;
      }
    }
  });

  // Pass 2: Partial Match (for any remaining unmatched columns)
  headerRow.forEach((h, index) => {
    const cleanH = stripAccents(h);
    const alreadyMatchedIndices = Object.values(colIndices);
    if (alreadyMatchedIndices.includes(index)) return;

    for (const [key, aliases] of Object.entries(headerMap)) {
      if (colIndices[key] === -1) {
        // Rule: columns containing "giao dich" or "gd" should not match category or type
        if ((cleanH.includes('giao dich') || cleanH.includes('gd')) && (key === 'category' || key === 'type')) {
          continue;
        }
        if (aliases.some(alias => cleanH.includes(alias) || alias.includes(cleanH))) {
          colIndices[key] = index;
        }
      }
    }
  });

  // Fallback to default indices if no header row matches were found
  if (colIndices.amount === -1 && colIndices.date === -1) {
    colIndices.date = 1; // "Thời gian" is index 1 in standard MoMo/Bank statement
    colIndices.note = 3; // "Loại giao dịch" is index 3 in MoMo
    colIndices.amount = 8; // "Số Tiền" is index 8 in MoMo
    colIndices.wallet = 4;
  }

  const parsedTransactions = [];
  const categoriesList = [...existingCategories];

  // Helper date parser
  function parseCSVDate(dateStr) {
    if (!dateStr) return new Date().toISOString();
    const cleanDate = dateStr.trim();
    
    // DD/MM/YYYY HH:MM:SS or DD/MM/YYYY
    const dmy = cleanDate.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
    if (dmy) {
      return new Date(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1])).toISOString();
    }
    
    // YYYY/MM/DD or YYYY-MM-DD
    const ymd = cleanDate.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
    if (ymd) {
      return new Date(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3])).toISOString();
    }
    
    const parsed = Date.parse(cleanDate);
    return isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();
  }

  // Helper type parser
  function parseCSVType(typeStr) {
    if (!typeStr) return 'expense';
    const clean = stripAccents(typeStr);
    if (clean.includes('thu') || clean.includes('inco') || clean === '+') {
      return 'income';
    }
    return 'expense';
  }

  // Helper amount parser
  function parseCSVAmount(amountStr) {
    if (!amountStr) return 0;
    let clean = amountStr.replace(/[^\d\.,\-]/g, '');
    
    // Handle European/Vietnamese formats where dot is thousand separator and comma is decimal, or vice versa
    if (clean.includes(',') && clean.includes('.')) {
      const lastComma = clean.lastIndexOf(',');
      const lastDot = clean.lastIndexOf('.');
      if (lastComma > lastDot) {
        clean = clean.replace(/\./g, '').replace(/,/g, '.');
      } else {
        clean = clean.replace(/,/g, '');
      }
    } else if (clean.includes(',')) {
      const parts = clean.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        clean = clean.replace(/,/g, '.');
      } else {
        clean = clean.replace(/,/g, '');
      }
    } else if (clean.includes('.')) {
      const parts = clean.split('.');
      if (parts.length === 2 && parts[1].length === 3) {
        clean = clean.replace(/\./g, '');
      } else if (parts.length > 2) {
        clean = clean.replace(/\./g, '');
      }
    }
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : Math.abs(parsed);
  }

  // Helper wallet parser
  function parseCSVWallet(walletStr) {
    if (!walletStr) return 'cash';
    const clean = stripAccents(walletStr);
    if (clean.includes('khoan') || clean.includes('bank') || clean.includes('the') || clean.includes('card') || clean.includes('chuyen')) {
      return 'bank';
    }
    return 'cash';
  }

  // Identify sender/receiver column indices for detailed note compilation
  const receiverCol = headerRow.findIndex(h => {
    const clean = stripAccents(h);
    return clean.includes('nhan') && (clean.includes('ten') || clean.includes('dinh danh') || clean.includes('hieu'));
  });
  
  const senderCol = headerRow.findIndex(h => {
    const clean = stripAccents(h);
    return clean.includes('chuyen') && (clean.includes('ten') || clean.includes('dinh danh') || clean.includes('hieu'));
  });

  // Start parsing from headerIndex + 1 (skipping header and metadata rows)
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const columns = parseRow(line);

    // Extract values based on mapped indices
    const rawDate = colIndices.date !== -1 && colIndices.date < columns.length ? columns[colIndices.date] : '';
    const rawType = colIndices.type !== -1 && colIndices.type < columns.length ? columns[colIndices.type] : '';
    const rawCategory = colIndices.category !== -1 && colIndices.category < columns.length ? columns[colIndices.category] : '';
    const rawNote = colIndices.note !== -1 && colIndices.note < columns.length ? columns[colIndices.note] : '';
    const rawAmount = colIndices.amount !== -1 && colIndices.amount < columns.length ? columns[colIndices.amount] : '';
    const rawWallet = colIndices.wallet !== -1 && colIndices.wallet < columns.length ? columns[colIndices.wallet] : '';

    if (!rawAmount && !rawCategory) continue;

    const date = parseCSVDate(rawDate);
    const amount = parseCSVAmount(rawAmount);
    const wallet = parseCSVWallet(rawWallet);

    // 5. Smart Transaction Type (Income/Expense) determination
    let type = 'expense';
    if (colIndices.type !== -1 && colIndices.type < columns.length && columns[colIndices.type]) {
      type = parseCSVType(columns[colIndices.type]);
    } else {
      // Fallback: If no type column, detect via amount sign!
      type = rawAmount.includes('-') ? 'expense' : 'income';
    }

    // 6. Detailed Note compiler (combines transaction description + merchant/receiver name)
    let note = rawNote || '';
    if (type === 'expense' && receiverCol !== -1 && receiverCol < columns.length && columns[receiverCol]) {
      // Skip if the receiver is just the date (common in MoMo Túi Thần Tài interest entries)
      const isDate = columns[receiverCol].match(/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}/);
      if (!isDate) {
        note += (note ? ' - ' : '') + columns[receiverCol];
      }
    } else if (type === 'income' && senderCol !== -1 && senderCol < columns.length && columns[senderCol]) {
      const isDate = columns[senderCol].match(/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}/);
      if (!isDate) {
        note += (note ? ' - ' : '') + columns[senderCol];
      }
    }

    const categoryName = rawCategory || '';

    // Map or create category
    let categoryId = 'other_expense';
    const cleanCat = stripAccents(categoryName);
    const isGenericCategory = !categoryName || cleanCat === 'khac' || cleanCat === 'giao dich khac' || cleanCat === 'other' || cleanCat === 'chua phan loai' || cleanCat === 'khong xac dinh';

    if (isGenericCategory) {
      // Smart Auto-Categorization based on compiled Note keywords (unaccented normalized)
      const cleanNote = stripAccents(note);
      const matched = KEYWORD_CATEGORY_MAP.find(mapping => 
        mapping.keywords.some(kw => matchKeyword(cleanNote, kw))
      );
      
      if (matched) {
        const localCat = categoriesList.find(c => c.id === matched.categoryId && c.type === type);
        if (localCat) {
          categoryId = localCat.id;
        } else {
          categoryId = matched.categoryId;
        }
      } else {
        categoryId = type === 'income' ? 'other_income' : 'other_expense';
      }
    } else {
      // Map or create custom category
      let cat = categoriesList.find(c => stripAccents(c.name) === cleanCat && c.type === type);
      if (cat) {
        categoryId = cat.id;
      } else {
        if (onNewCategory) {
          categoryId = await onNewCategory(categoryName, type);
          categoriesList.push({ id: categoryId, name: categoryName, type });
        } else {
          categoryId = type === 'income' ? 'other_income' : 'other_expense';
        }
      }
    }

    parsedTransactions.push({
      date,
      type,
      amount,
      wallet,
      note,
      categoryId
    });
  }

  return parsedTransactions;
}

