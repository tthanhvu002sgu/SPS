export const WORD_TYPES = [
  "Danh từ",
  "Động từ",
  "Tính từ",
  "Trạng từ",
  "Cụm động từ",
  "Thành ngữ",
  "Khác"
];

export const STATUS_TAGS = [
  "Đến hạn",
  "Chưa học",
  "Thành thạo",
  "Tất cả",
  "Mastered",
  "Due",
  "New"
];

export const MAIN_TOPICS = [
  "Đời sống & giao tiếp",
  "Công việc & kinh doanh",
  "Học tập & học thuật",
  "Sức khỏe & cơ thể",
  "Ăn uống & nấu nướng",
  "Du lịch & giao thông",
  "Công nghệ & truyền thông",
  "Nhà cửa, mua sắm & dịch vụ",
  "Xã hội, pháp luật & an toàn",
  "Thiên nhiên, môi trường & nông nghiệp",
  "Văn hóa, nghệ thuật & thể thao",
  "Từ vựng chung & khái niệm trừu tượng"
];

export const DEFAULT_TOPICS = MAIN_TOPICS;

export const isWordType = (str) => {
  if (!str || typeof str !== 'string') return false;
  const lower = str.trim().toLowerCase();
  return WORD_TYPES.some(t => t.toLowerCase() === lower);
};

export const isStatusTag = (str) => {
  if (!str || typeof str !== 'string') return false;
  const lower = str.trim().toLowerCase();
  return STATUS_TAGS.some(s => s.toLowerCase() === lower);
};

export const normalizeTag = (tag) => {
  if (!tag || typeof tag !== 'string') return null;
  const trimmed = tag.trim();
  
  if (isWordType(trimmed) || isStatusTag(trimmed)) return null;

  if (MAIN_TOPICS.includes(trimmed)) return trimmed;

  const lower = trimmed.toLowerCase();

  if (lower.includes('công nghệ') || lower.includes('truyền thông') || lower.includes('tech')) {
    return "Công nghệ & truyền thông";
  }
  if (lower.includes('kinh doanh') || lower.includes('công việc') || lower.includes('làm việc') || lower.includes('work') || lower.includes('business')) {
    return "Công việc & kinh doanh";
  }
  if (lower.includes('học') || lower.includes('giáo dục') || lower.includes('education') || lower.includes('academic')) {
    return "Học tập & học thuật";
  }
  if (lower.includes('sức khỏe') || lower.includes('cơ thể') || lower.includes('y tế') || lower.includes('health') || lower.includes('bệnh')) {
    return "Sức khỏe & cơ thể";
  }
  if (lower.includes('ăn') || lower.includes('uống') || lower.includes('ẩm thực') || lower.includes('nấu') || lower.includes('food') || lower.includes('cook')) {
    return "Ăn uống & nấu nướng";
  }
  if (lower.includes('du lịch') || lower.includes('giao thông') || lower.includes('xe') || lower.includes('travel') || lower.includes('transport')) {
    return "Du lịch & giao thông";
  }
  if (lower.includes('nhà') || lower.includes('mua sắm') || lower.includes('dịch vụ') || lower.includes('home') || lower.includes('shopping') || lower.includes('service')) {
    return "Nhà cửa, mua sắm & dịch vụ";
  }
  if (lower.includes('xã hội') || lower.includes('pháp luật') || lower.includes('an toàn') || lower.includes('society') || lower.includes('law') || lower.includes('safety')) {
    return "Xã hội, pháp luật & an toàn";
  }
  if (lower.includes('thiên nhiên') || lower.includes('môi trường') || lower.includes('nông nghiệp') || lower.includes('nature') || lower.includes('environment') || lower.includes('agriculture')) {
    return "Thiên nhiên, môi trường & nông nghiệp";
  }
  if (lower.includes('văn hóa') || lower.includes('nghệ thuật') || lower.includes('thể thao') || lower.includes('sport') || lower.includes('art') || lower.includes('culture')) {
    return "Văn hóa, nghệ thuật & thể thao";
  }
  if (lower.includes('đời sống') || lower.includes('giao tiếp') || lower.includes('hàng ngày') || lower.includes('life') || lower.includes('communication')) {
    return "Đời sống & giao tiếp";
  }

  return "Từ vựng chung & khái niệm trừu tượng";
};

export const normalizeCollocations = (collocations) => {
  if (!collocations) return [];
  if (Array.isArray(collocations)) {
    return collocations.map(c => String(c).trim()).filter(Boolean);
  }
  if (typeof collocations === 'string') {
    return collocations
      .split(/[\n,;•·|]+/)
      .map(c => c.trim())
      .filter(Boolean);
  }
  return [];
};

export const normalizeWordTags = (word) => {
  if (!word) return word;
  const rawTags = Array.isArray(word.tags) ? word.tags : [];
  let extractedWordType = word.wordType || '';
  const normalizedTopicSet = new Set();
  
  rawTags.forEach(t => {
    if (!t || typeof t !== 'string') return;
    const trimmed = t.trim();

    if (isWordType(trimmed)) {
      if (!extractedWordType) {
        const match = WORD_TYPES.find(wt => wt.toLowerCase() === trimmed.toLowerCase());
        if (match) extractedWordType = match;
      }
      return;
    }

    if (isStatusTag(trimmed)) {
      return;
    }

    const norm = normalizeTag(trimmed);
    if (norm) normalizedTopicSet.add(norm);
  });
  
  if (normalizedTopicSet.size === 0) {
    normalizedTopicSet.add("Từ vựng chung & khái niệm trừu tượng");
  }

  return {
    ...word,
    collocations: normalizeCollocations(word.collocations),
    wordType: extractedWordType,
    tags: Array.from(normalizedTopicSet)
  };
};
