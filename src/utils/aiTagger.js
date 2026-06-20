import axios from 'axios';
import { WORD_TYPES, DEFAULT_TOPICS } from './tags';

export const autoTagWords = async (wordsToTag, apiKey, topics = DEFAULT_TOPICS, model = 'gemini-2.5-flash-lite') => {
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

2. **tags**: Nếu có chủ đề phù hợp trong danh sách có sẵn dưới đây, hãy chọn tối đa 2 chủ đề và điền vào mảng \`tags\`. ĐỂ TRỐNG \`suggestedNewTag\`.
Danh sách chủ đề có sẵn:
${topics.map(t => `- "${t}"`).join('\n')}

3. **Đề xuất Tag mới (Rất Quan Trọng)**: Nếu KHÔNG CÓ chủ đề nào trong danh sách trên thực sự phù hợp (ví dụ: từ chuyên ngành hẹp, khái niệm mới), hãy:
   - ĐỂ TRỐNG mảng \`tags\` ([]).
   - Điền một chủ đề ngắn gọn mới vào \`suggestedNewTag\` (VD: "Tiền điện tử").
   - Điền chủ đề có sẵn gần giống nhất vào \`bestExistingTag\` (VD: "Công nghệ").
   - Giải thích lý do vào \`reasoning\`.

**Danh sách từ vựng cần phân tích:**
${wordsContext}

**Yêu cầu đầu ra:**
TRẢ VỀ DUY NHẤT MỘT MẢNG JSON HỢP LỆ (không dùng markdown codeblock, không kèm text giải thích), với định dạng mỗi phần tử như sau:
[
  {
    "word": "từ vựng gốc",
    "wordType": "Danh từ",
    "tags": ["Công nghệ"],
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
    if (textResponse.startsWith('\`\`\`json')) {
      textResponse = textResponse.replace(/^\`\`\`json\n?/, '').replace(/\n?\`\`\`$/, '');
    } else if (textResponse.startsWith('\`\`\`')) {
      textResponse = textResponse.replace(/^\`\`\`\n?/, '').replace(/\n?\`\`\`$/, '');
    }

    const parsedJson = JSON.parse(textResponse);
    return parsedJson;

  } catch (error) {
    console.error('Error auto-tagging words:', error);
    if (error.response) {
      throw new Error(`Lỗi từ Gemini API: ${error.response.data.error?.message || error.response.statusText}`);
    }
    throw new Error('Lỗi không thể phân loại từ vựng tự động. Định dạng JSON không hợp lệ hoặc lỗi mạng.');
  }
};
