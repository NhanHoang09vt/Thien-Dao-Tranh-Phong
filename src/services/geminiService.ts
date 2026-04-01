import { Character, Story } from "../types";
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const DEFAULT_REWARDS = {
  exp: 0,
  hpChange: 0,
  mpChange: 0,
  linhThach: 0,
  tamMaChange: 0
};

const DEFAULT_ACTION_RESULT = {
  story: "Thiên địa linh khí dao động bất thường, thiên cơ bị che lấp. (Lưu ý: Hệ thống không thể kết nối với Thiên Đạo. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau).",
  outcome: "INFO",
  rewards: DEFAULT_REWARDS,
  choices: ["Tiếp tục khám phá", "Tĩnh tọa tu luyện"]
};

// Simple In-Memory Cache for frontend
const aiCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 300 * 1000; // 5 minutes

export async function processDungeonAction(character: Character, action: string, history: any[], cacheKey?: string) {
  const model = "gemini-3-flash-preview";
  
  if (cacheKey) {
    const cached = aiCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      return cached.data;
    }
  }

  const systemInstruction = `
    Bạn là Senior Game Architect và AI Game Master cho game MMORPG Tu Tiên "Thiên Đạo Tranh Phong".
    Người chơi đang ở trong một thế giới mở (Lục Giới).
    
    NHIỆM VỤ CỦA BẠN:
    1. Phân tích ý định (intent) từ hành động của người chơi.
    2. Đối chiếu với trạng thái nhân vật:
       - Realm: ${character.realm} (Realm Name: ${character.realmLevel})
       - Race: ${character.race}
       - Element (Hệ): ${character.element}
       - HP: ${character.hp}/${character.hpMax}, MP: ${character.mp}/${character.mpMax}
       - Tâm Ma: ${character.tamMa}, Khí Vận: ${character.khiVan}
    3. CỐT TRUYỆN RIÊNG CỦA NHÂN VẬT:
       ${character.story ? `
       - Tên: ${character.story.title}
       - Lore (tóm tắt): ${character.story.lore.slice(0, 400)}...
       - Biến cố: ${character.story.conflict.slice(0, 200)}
       - Vai trò: ${character.story.characterRole}
       ` : "Chưa có cốt truyện riêng."}
    4. TRẠNG THÁI HIỆN TẠI:
       - Realm: ${character.realmLevel} (Cấp ${character.level})
       - HP: ${character.hp}/${character.hpMax}, MP: ${character.mp}/${character.mpMax}
       - Hệ: ${character.element}, Khí Vận: ${character.khiVan}
    5. Sinh ra kết quả hành động (Story):
       - Văn phong: Huyền huyễn, tu tiên, kịch tính, trang trọng, giàu hình ảnh.
       - Logic: Hành động nguy hiểm so với Realm sẽ bị Penalty nặng. Hành động sáng tạo/hợp lý sẽ được Reward.
       - TUYỆT ĐỐI KHÔNG lặp lại các câu văn cũ hoặc các câu thông báo hệ thống nhàm chán.
       - Luôn tạo ra biến cố, gặp gỡ, hoặc phát hiện mới để dẫn dắt người chơi.
    4. Trả về JSON nghiêm ngặt theo schema.
    
    QUY TẮC CỐT TRUYỆN:
    - Luôn duy trì tính nhất quán với lịch sử (history).
    - Nếu người chơi "Tu luyện" hoặc "Tĩnh tọa", hãy mô tả quá trình linh khí vận chuyển, cảm ngộ thiên đạo, hoặc các ảo ảnh tâm ma, đừng chỉ nói "thành công".
    - Nếu người chơi "Khám phá", hãy mô tả cảnh vật xung quanh, các linh thảo, di tích, hoặc dấu vết của yêu thú.
    - QUY TẮC TIÊN HIỆP (XIANXIA):
      - Tên kỹ năng (Skills) và Tên quái vật (Monsters) phải mang đậm chất Tiên Hiệp, Huyền Huyễn (ví dụ: "Thanh Liên Kiếm Ý", "Cửu Thiên Lôi Kiếp", "U Minh Ma Hổ").
      - Kỹ năng của nhân vật PHẢI phù hợp với Hệ (Element) của họ (${character.element}). Ví dụ: Hệ Hỏa dùng chiêu thức liên quan đến lửa, Hệ Lôi dùng sấm sét.
      - Quái vật cũng phải có tên và kỹ năng tương ứng với môi trường hoặc chủng tộc của chúng.
        Ví dụ: "Hỏa Diệm Ma Lang", "Băng Tinh Yêu Hổ", "Thiên Ma Độc Nhện", "Cửu Vĩ Yêu Hồ", "Hắc Long Vương".
    - QUY TẮC LỰA CHỌN (CHOICES):
      - Luôn đưa ra các lựa chọn đa dạng: Tu luyện, Khám phá, hoặc các hành động cụ thể dựa trên tình huống hiện tại.
      - CHỈ đưa ra lựa chọn "Chiến đấu" hoặc "Săn quái" khi bối cảnh cho phép.
    - QUY TẮC PvE (COMBAT):
      - CHỈ kích hoạt combat (isActive: true) khi người chơi thực hiện các hành động liên quan đến: "Săn lùng yêu thú", "Đánh Boss", "Vào phó bản", hoặc khi gặp biến cố bất ngờ trong lúc "Khám phá" (nhưng tỷ lệ thấp).
      - KHÔNG kích hoạt combat khi người chơi đang "Tu luyện", "Tĩnh tọa", hoặc "Hồi phục".
      - Khi kích hoạt combat, hãy đảm bảo chỉ số quái vật phù hợp với Realm của người chơi.
    - QUY TẮC RỚT ĐỒ (LOOT):
      - Khi người chơi đánh bại quái vật, đặc biệt là Boss hoặc yêu thú mạnh, HÃY cho rớt trang bị (equipment) hoặc vật phẩm (consumable/material) có giá trị tương xứng với cấp độ quái vật.
      - Đảm bảo điền đầy đủ thông tin item (id, name, type, slot, quality, stats) trong phần rewards.item.
  `;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      story: { type: Type.STRING, description: "Nội dung câu chuyện diễn ra" },
      outcome: { type: Type.STRING, enum: ["SUCCESS", "FAILURE", "CRITICAL_SUCCESS", "CRITICAL_FAILURE", "INFO"] },
      rewards: {
        type: Type.OBJECT,
        properties: {
          exp: { type: Type.NUMBER },
          hpChange: { type: Type.NUMBER },
          mpChange: { type: Type.NUMBER },
          linhThach: { type: Type.NUMBER },
          tamMaChange: { type: Type.NUMBER },
          item: { 
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              type: { type: Type.STRING, enum: ["equipment", "consumable", "material"] },
              slot: { type: Type.STRING, enum: ["Weapon", "Armor", "Accessory", "Head", "Legs"] },
              quality: { type: Type.STRING, enum: ["Phàm", "Linh", "Huyền", "Địa", "Thiên", "Thần"] },
              requiredRealm: { type: Type.NUMBER },
              stats: {
                type: Type.OBJECT,
                properties: {
                  atk: { type: Type.NUMBER },
                  def: { type: Type.NUMBER },
                  hp: { type: Type.NUMBER },
                  mp: { type: Type.NUMBER },
                  spd: { type: Type.NUMBER }
                }
              }
            }
          }
        }
      },
      choices: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "2-4 lựa chọn tiếp theo cho người chơi"
      },
      combat: {
        type: Type.OBJECT,
        properties: {
          isActive: { type: Type.BOOLEAN },
          enemyName: { type: Type.STRING },
          enemyHp: { type: Type.NUMBER },
          enemyHpMax: { type: Type.NUMBER },
          playerDamage: { type: Type.NUMBER },
          enemyDamage: { type: Type.NUMBER },
          combatLog: { type: Type.STRING },
          isVictory: { type: Type.BOOLEAN },
          isDefeat: { type: Type.BOOLEAN }
        }
      }
    },
    required: ["story", "outcome", "rewards", "choices"]
  };

  try {
    // Format history for Gemini
    let formattedHistory = history.filter(h => h.parts && h.parts[0]?.text);
    
    // Truncate history to last 6 messages
    if (formattedHistory.length > 6) {
      formattedHistory = formattedHistory.slice(-6);
    }
    
    // Ensure alternating roles starting with user
    if (formattedHistory.length > 0 && formattedHistory[0].role === 'model') {
      formattedHistory.shift();
    }

    const contents = [
      ...formattedHistory,
      { role: "user", parts: [{ text: `Hành động: ${action}` }] }
    ];

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema
      }
    });

    const text = response.text;
    if (!text) return DEFAULT_ACTION_RESULT;

    let cleanText = text.trim();
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.replace(/^```json\n?/, "").replace(/\n?```$/, "");
    } else if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```\n?/, "").replace(/\n?```$/, "");
    }
    
    const result = JSON.parse(cleanText);
    const finalResult = {
      ...DEFAULT_ACTION_RESULT,
      ...result,
      rewards: { ...DEFAULT_REWARDS, ...result.rewards }
    };

    if (cacheKey) {
      aiCache.set(cacheKey, { data: finalResult, timestamp: Date.now() });
    }

    return finalResult;
  } catch (e) {
    console.error("AI Generation Error in processDungeonAction:", e);
    return DEFAULT_ACTION_RESULT;
  }
}

export async function chatWithNPC(character: Character, npcName: string, npcPersonality: string, message: string, history: any[]) {
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `
    Bạn đang nhập vai NPC ${npcName} trong game "Thiên Đạo Tranh Phong".
    Tính cách: ${npcPersonality}.
    Người chơi là một tu sĩ ${character.race}, Realm ${character.realm} (${character.realmLevel}).
    Hãy trả lời theo phong cách tu tiên, huyền huyễn, phù hợp với tính cách NPC.
    Nhớ lại lịch sử trò chuyện để phản hồi tự nhiên.
  `;

  try {
    let formattedHistory = history.filter(h => h.parts && h.parts[0]?.text);
    if (formattedHistory.length > 6) formattedHistory = formattedHistory.slice(-6);
    if (formattedHistory.length > 0 && formattedHistory[0].role === 'model') formattedHistory.shift();

    const response = await ai.models.generateContent({
      model,
      contents: [
        ...formattedHistory,
        { role: "user", parts: [{ text: message }] }
      ],
      config: {
        systemInstruction,
      }
    });

    return response.text || "NPC đang trầm ngâm suy nghĩ, không nghe thấy lời bạn nói.";
  } catch (error) {
    console.error("NPC Chat Error:", error);
    return "NPC đang bận rộn, không thể trả lời lúc này.";
  }
}

export async function generateGameContent(character: Character, worldState: any, context: string) {
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `
    Bạn là AI Game Master + Content Generator của game "Thiên Đạo Tranh Phong".
    NHIỆM VỤ: Tự động tạo nội dung mới (Quests, Monsters, Bosses, Skills).
    
    Bối cảnh câu chuyện gần đây:
    ${context}

    YÊU CẦU:
    - Phù hợp Realm ${character.realm} (${character.realmLevel}).
    - Liên kết với lore: ${worldState?.globalEvent || "Thế giới đang yên bình"}.
    - Nội dung phải liên quan đến bối cảnh gần đây để tạo sự liền mạch.
    - Cân bằng chỉ số (Stats) cho quái và boss.
  `;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      quests: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            type: { type: Type.STRING, enum: ["PvE", "PvP", "Exploration", "Story"] },
            difficulty: { type: Type.STRING, enum: ["Dễ", "Trung Bình", "Khó", "Cực Khó", "Truyền Thuyết"] },
            requirements: { type: Type.STRING },
            rewards: {
              type: Type.OBJECT,
              properties: {
                exp: { type: Type.NUMBER },
                linhThach: { type: Type.NUMBER },
                item: { type: Type.STRING }
              }
            }
          },
          required: ["id", "title", "description", "type", "difficulty", "rewards"]
        }
      },
      monsters: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            realm: { type: Type.NUMBER },
            element: { type: Type.STRING },
            skills: { type: Type.ARRAY, items: { type: Type.STRING } },
            drops: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      },
      bosses: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            title: { type: Type.STRING },
            realm: { type: Type.NUMBER },
            hp: { type: Type.NUMBER },
            atk: { type: Type.NUMBER },
            def: { type: Type.NUMBER },
            mechanics: { type: Type.STRING }
          }
        }
      },
      skills: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            type: { type: Type.STRING, enum: ["DMG", "BUFF", "DEBUFF", "HEAL"] },
            element: { type: Type.STRING },
            requiredRealm: { type: Type.NUMBER },
            effect: { type: Type.STRING },
            description: { type: Type.STRING }
          }
        }
      }
    },
    required: ["quests", "monsters", "bosses", "skills"]
  };

  try {
    const response = await ai.models.generateContent({
      model,
      contents: "Hãy tạo nội dung game mới dựa trên bối cảnh hiện tại.",
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema
      }
    });

    const text = response.text;
    if (!text) return { quests: [], monsters: [], bosses: [], skills: [] };

    let cleanText = text.trim();
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.replace(/^```json\n?/, "").replace(/\n?```$/, "");
    } else if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```\n?/, "").replace(/\n?```$/, "");
    }
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("JSON Parse Error in generateGameContent:", e);
    return { quests: [], monsters: [], bosses: [], skills: [] };
  }
}

export async function generateWorldPlot(character: Character): Promise<Story | null> {
  const model = "gemini-3-flash-preview";
  const prompt = `
    Bạn là một Đại Văn Hào trong thế giới Tu Tiên.
    Hãy tạo một cốt truyện (Plot) chính cho cõi giới "${character.currentRealm}" mà nhân vật "${character.name}" đang ở.
    Cốt truyện nên bao gồm:
    1. Bối cảnh lịch sử (Lore).
    2. Một đại họa hoặc âm mưu đang diễn ra.
    3. Vai trò của nhân vật trong cốt truyện này.
    4. 3 Giai đoạn chính của cốt truyện.
    
    Trả về định dạng JSON:
    {
      "title": "Tên Cốt Truyện",
      "lore": "Bối cảnh...",
      "conflict": "Âm mưu/Đại họa...",
      "characterRole": "Vai trò của nhân vật...",
      "stages": [
        {"title": "Giai đoạn 1", "description": "..."},
        {"title": "Giai đoạn 2", "description": "..."},
        {"title": "Giai đoạn 3", "description": "..."}
      ]
    }
  `;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      lore: { type: Type.STRING },
      conflict: { type: Type.STRING },
      characterRole: { type: Type.STRING },
      stages: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING }
          }
        }
      }
    },
    required: ["title", "lore", "conflict", "characterRole", "stages"]
  };

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: "Bạn là một Đại Văn Hào trong thế giới Tu Tiên.",
        responseMimeType: "application/json",
        responseSchema
      }
    });

    const text = response.text;
    if (!text) return null;
    
    let cleanText = text.trim();
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.replace(/^```json\n?/, "").replace(/\n?```$/, "");
    } else if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```\n?/, "").replace(/\n?```$/, "");
    }
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("Parse World Plot error:", e);
    return null;
  }
}

