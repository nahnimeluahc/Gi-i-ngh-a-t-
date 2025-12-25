import { GoogleGenAI, Type } from "@google/genai";
import { DefinitionData } from '../types';

const getAiClient = () => {
  // Accessing process.env.API_KEY directly as required
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please set process.env.API_KEY.");
  }
  return new GoogleGenAI({ apiKey });
};

// 1. OCR Function: Extracts text from an image
export const extractTextFromImage = async (base64Image: string): Promise<string> => {
  const ai = getAiClient();
  
  // Using gemini-2.5-flash-image for vision tasks
  const model = "gemini-2.5-flash-image";

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg", // Assuming generic image type, usually works for PNG too
              data: base64Image,
            },
          },
          {
            text: "Hãy đóng vai một chuyên gia OCR (nhận diện quang học). Nhiệm vụ của bạn là trích xuất toàn bộ văn bản tiếng Việt có trong bức ảnh này. Giữ nguyên cấu trúc đoạn văn. Chỉ trả về văn bản, không thêm bất kỳ lời dẫn nào.",
          },
        ],
      },
    });

    return response.text?.trim() || "Không tìm thấy văn bản nào trong ảnh.";
  } catch (error) {
    console.error("OCR Error:", error);
    throw new Error("Không thể nhận diện văn bản. Vui lòng thử lại.");
  }
};

// 2. Definition Function: Explains the word for kids
export const explainForKids = async (word: string): Promise<DefinitionData> => {
  const ai = getAiClient();
  // Using gemini-3-flash-preview for fast text processing
  const model = "gemini-3-flash-preview";

  const systemInstruction = `Bạn là một giáo viên tiểu học thân thiện, vui tính. 
  Nhiệm vụ của bạn là giải thích nghĩa của các từ vựng tiếng Việt cho học sinh từ 6-10 tuổi.
  - Định nghĩa phải cực kỳ đơn giản, dễ hiểu, dùng từ ngữ trong sáng.
  - Luôn kèm theo một câu ví dụ minh họa gần gũi.
  - Tạo một mô tả ngắn gọn bằng tiếng Anh (imagePrompt) để vẽ hình minh họa cho từ này theo phong cách hoạt hình (cartoon style), dễ thương.`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: `Giải thích từ: "${word}"`,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            definition: { type: Type.STRING },
            exampleSentence: { type: Type.STRING },
            imagePrompt: { type: Type.STRING, description: "A cute, cartoon-style prompt to generate an image describing this word" },
          },
          required: ["word", "definition", "exampleSentence", "imagePrompt"],
        },
      },
    });

    const jsonText = response.text || "{}";
    return JSON.parse(jsonText) as DefinitionData;
  } catch (error) {
    console.error("Definition Error:", error);
    throw new Error("Không thể giải nghĩa từ này.");
  }
};

// 3. Image Generation Function: Creates an illustration based on the prompt
export const generateIllustration = async (prompt: string): Promise<string | null> => {
  const ai = getAiClient();
  // Using gemini-2.5-flash-image for image generation as per guidelines for general tasks
  const model = "gemini-2.5-flash-image";

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
            { text: prompt }
        ]
      },
      config: {
        // We rely on the model to return an image part
      }
    });

    // Extract image from parts
    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Image Gen Error:", error);
    return null; // Fail silently for image, we show definition at least
  }
};
