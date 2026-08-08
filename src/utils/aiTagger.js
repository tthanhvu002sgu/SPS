import axios from 'axios';
import { WORD_TYPES, MAIN_TOPICS, normalizeTag } from './tags';

export const autoTagWords = async (wordsToTag, apiKey, topics = MAIN_TOPICS, model = 'gemini-2.5-flash-lite') => {
  if (!apiKey) {
    throw new Error('Thiếu API Key của Gemini. Vui lòng cập nhật trong Settings.');
  }

  // Nếu đầu vào là một chuỗi hoặc một object duy nhất, bọc nó vào mảng
  const wordsList = Array.isArray(wordsToTag) ? wordsToTag : [wordsToTag];
  if (wordsList.length === 0) return [];

  // Tạo danh sách các từ vựng cần phân tích (để đưa vào prompt)
  const wordsContext = wordsList.map((w, idx) => `[${idx}] ${w.word}${w.meaning ? ` (nghĩa: ${w.meaning})` : ''}${w.viMeaning ? ` (tiếng Việt: ${w.viMeaning})` : ''}`).join('\n');

  const prompt = `
Bạn là một chuyên gia ngôn ngữ học. Nhiệm vụ của bạn là phân loại các từ vựng sau đây vào đúng Từ Loại (wordType) và Chủ Đề (tags).

**RÀNG BUỘC QUAN TRỌNG:**
1. **wordType**: CHỈ ĐƯỢC CHỌN 1 TRONG CÁC GIÁ TRỊ SAU:
${WORD_TYPES.map(t => `- "${t}"`).join('\n')}

2. **tags**: BẮT BUỘC CHỈ ĐƯỢC CHỌN TỐI ĐA 2 CHỦ ĐỀ TRONG ĐÚNG 12 CHỦ ĐỀ CHÍNH SAU ĐÂY:
${MAIN_TOPICS.map(t => `- "${t}"`).join('\n')}

KHÔNG TỰ TẠO TAG MỚI HOẶC SỬA TÊN TAG. ĐỂ TRỐNG \`suggestedNewTag\`, \`bestExistingTag\`, và \`reasoning\`.

**Danh sách từ vựng cần phân tích:**
${wordsContext}

**Yêu cầu đầu ra:**
TRẢ VỀ DUY NHẤT MỘT MẢNG JSON HỢP LỆ (không dùng markdown codeblock, không kèm text giải thích), với định dạng mỗi phần tử như sau:
[
  {
    "word": "từ vựng gốc",
    "wordType": "Danh từ",
    "tags": ["Công nghệ & truyền thông"],
    "suggestedNewTag": "",
    "bestExistingTag": "",
    "reasoning": ""
  }
]
`;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1, // Cực thấp để tránh ảo giác
        }
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    let textResponse = response.data.candidates[0].content.parts[0].text.trim();
    // Loại bỏ markdown JSON block nếu AI có trả về
    if (textResponse.startsWith('```json')) {
      textResponse = textResponse.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (textResponse.startsWith('```')) {
      textResponse = textResponse.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    const parsedJson = JSON.parse(textResponse);
    return (parsedJson || []).map(item => ({
      ...item,
      tags: (item.tags || []).map(t => normalizeTag(t)).filter(Boolean)
    }));

  } catch (error) {
    console.error('Error auto-tagging words:', error);
    if (error.response) {
      throw new Error(`Lỗi từ Gemini API: ${error.response.data.error?.message || error.response.statusText}`);
    }
    throw new Error('Lỗi không thể phân loại từ vựng tự động. Định dạng JSON không hợp lệ hoặc lỗi mạng.');
  }
};
