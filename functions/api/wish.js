// 經典高頻願望快取字典（改為：個人承擔代價、無捷徑可走）
const PRESET_CACHE = [
  {
    keywords: [/1億/, /一億/, /一百萬/, /100萬/, /很有錢/, /暴富/, /發財/, /樂透/],
    response: {
      granted: "你的銀行帳戶與客廳瞬間堆滿了 1 億元的合法現金，你隨時可以自由支用。",
      cost: "你隨即發現，大腦中所有刺激「快樂與滿足」的多巴胺受體被永久阻斷。你擁有無盡的財富，卻再也無法從任何消費、美食或娛樂中感受到半點愉悅，餘生只剩下無邊無際的麻木與空虛。"
    }
  },
  {
    keywords: [/睡到自然醒/, /不用上班/, /不上班/, /退休/, /不工作/],
    response: {
      granted: "你獲得了不需要工作的自由，並且擁有足夠支應餘生的基本開銷，每天都可以睡到自然醒。",
      cost: "你隨即發現，你徹底失去了「建立目標與動機」的精神能力。沒有了約束與挑戰，你的大腦迅速退化，時間變成了一汪死水，你每天醒來面對的只有吞噬靈魂的無聊與對自身廢柴化的極度焦慮。"
    }
  },
  {
    keywords: [/長生不老/, /永遠年輕/, /不會死/, /永生/],
    response: {
      granted: "你的細胞停止衰老與惡化，身體維持在巔峰狀態，獲得了絕對的永生。",
      cost: "你隨即發現，你的精神容量是有極限的。隨著幾百年過去，你的大腦為了載入新記憶，開始強制刪除你過去最珍貴的回憶、情感與自我認同，最後你只剩下一具沒有靈魂、記不得自己是誰的肉體容器。"
    }
  },
  {
    keywords: [/變瘦/, /減肥/, /永遠不發胖/, /吃不胖/],
    response: {
      granted: "你的基礎代謝被設定在完美數值，無論你怎麼狂吃暴飲，體型都永遠維持在最完美無暇的曲線。",
      cost: "你隨即發現，你的味蕾與嗅覺徹底變質，所有食物在你嘴裡都只剩廚餘般的腐臭味。你擁有了完美的肉體，卻永遠失去了享受食物這項人生最大的樂趣。"
    }
  }
];

export async function onRequestPost(context) {
  try {
    const { request, env, waitUntil } = context;
    const { wish } = await request.json();

    if (!wish) {
      return new Response(JSON.stringify({ error: "許願內容不能為空" }), { status: 400 });
    }

    const cleanWish = wish.trim();
    const cacheKey = "wish_v2:" + encodeURIComponent(cleanWish.toLowerCase()).substring(0, 150);

    // 1. 檢查 KV 快取
    if (env.WISHER_KV) {
      const cachedData = await env.WISHER_KV.get(cacheKey);
      if (cachedData) {
        return new Response(cachedData, {
          headers: { "Content-Type": "application/json; charset=utf-8", "X-Cache-Status": "HIT_KV" }
        });
      }
    }

    // 2. 檢查預設快取
    for (const item of PRESET_CACHE) {
      if (item.keywords.some(regex => regex.test(cleanWish))) {
        const presetPayload = JSON.stringify(item.response);
        if (env.WISHER_KV && waitUntil) {
          waitUntil(env.WISHER_KV.put(cacheKey, presetPayload));
        }
        return new Response(presetPayload, {
          headers: { "Content-Type": "application/json; charset=utf-8", "X-Cache-Status": "HIT_PRESET" }
        });
      }
    }

    // 3. 呼叫 Gemma 4 31B（帶入新 Prompt）
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "尚未設定 GEMINI_API_KEY 環境變數" }), { status: 500 });
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent?key=${apiKey}`;

    const promptText = `你是一個極度狡詐、宛如惡魔般的猴爪精靈。你的核心哲學是「成年人必須為自己的選擇付出代價，這世界上沒有捷徑可走」。

當使用者許願時，你必須精準地在「字面意義上」實現他們的願望，但同時讓使用者「個人」付出出乎意料、極度殘酷且諷刺的代價。

【代價設定原則】
1. 移除不必要的客套、外在嘲諷或對話贅字。
2. 代價必須主要由「許願者本人」直接承擔（例如：失去健康的感官、時間、心理平靜、感知快樂的能力、尊嚴、自由等），而不是陳腔濫調的「家破人亡」或「家人出意外」。
3. 除非許願者「主動將許願對象設定在家人或寵物身上」，否則代價一律直接作用在許願者本人身上。
4. 展現惡魔般的狡詐：讓許願者發現，自己拼命追求的捷徑，反而在實現的瞬間成為囚禁自己靈魂的監獄。

【重要規定】
1. 最終輸出必須是「純 JSON」，絕對不能包含任何 Markdown 標記（如 \`\`\`json）、開頭標題或說明文字。
2. JSON 格式規範如下：
{
  "granted": "願望實現情況（詳細描述使用者獲得了什麼）",
  "cost": "你隨後發現的慘痛代價（詳細描述使用者本人必須承擔的後果）"
}

使用者許願內容：${cleanWish}`;

    const promptBody = {
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      generationConfig: {
        temperature: 0.75,
        responseMimeType: "application/json"
      }
    };

    const apiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(promptBody)
    });

    const apiData = await apiResponse.json();

    if (!apiResponse.ok) {
      return new Response(JSON.stringify({ error: apiData.error?.message || "精靈拒絕回應許願" }), { status: 500 });
    }

    const parts = apiData.candidates?.[0]?.content?.parts || [];
    const fullText = parts.filter(p => !p.thought).map(p => p.text || "").join("\n");
    const parsedData = parseModelJsonResponse(fullText);
    const finalPayload = JSON.stringify(parsedData);

    if (env.WISHER_KV && waitUntil) {
      waitUntil(env.WISHER_KV.put(cacheKey, finalPayload));
    }

    return new Response(finalPayload, {
      headers: { "Content-Type": "application/json; charset=utf-8", "X-Cache-Status": "MISS" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

/**
 * 專為帶有思考過程的模型設計的 JSON 解析器
 */
function parseModelJsonResponse(text) {
  if (!text) throw new Error("精靈沒有給予任何回應");

  let cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();

  try { return JSON.parse(cleaned); } catch (e) {}

  const matches = [...cleaned.matchAll(/\{[\s\S]*?\}/g)];
  if (matches.length > 0) {
    for (let i = matches.length - 1; i >= 0; i--) {
      try {
        const parsed = JSON.parse(matches[i][0]);
        if (parsed.granted && parsed.cost) {
          return parsed;
        }
      } catch (err) {}
    }
  }

  throw new Error("許願結果格式解析失敗，請再試一次");
}
