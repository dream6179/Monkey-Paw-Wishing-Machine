// 經典高頻願望備用快取 (硬編碼備援)
const PRESET_CACHE = [
  {
    keywords: [/1億/, /一億/, /一百萬/, /100萬/, /很有錢/, /暴富/, /發財/, /樂透/],
    response: {
      granted: "你的銀行帳戶瞬間多出了一筆 1 億元的鉅款，來源顯示為人壽保險理賠金。",
      side_effect: "這筆錢來自於你最親近的家人搭乘班機發生重大意外的理賠金，且無法退回。",
      taunt: "你現在非常有錢了，希望你的豪宅夠大，大到能裝下你餘生的孤獨。"
    }
  },
  {
    keywords: [/睡到自然醒/, /不用上班/, /不上班/, /退休/, /不工作/],
    response: {
      granted: "你再也不用上班，每天都可以躺在床上睡到自然醒。",
      side_effect: "你罹患了一種罕見的全身性肌肉萎縮症，終生無法下床，甚至連動一根手指都辦不到。",
      taunt: "祝賀你，現在全世界都無法打擾你的睡眠了。"
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
    // 建立標準化 Key (去除前後空格並轉小寫，確保一致性)
    const cacheKey = "wish_v1:" + encodeURIComponent(cleanWish.toLowerCase()).substring(0, 150);

    // ==========================================================================
    // 🛡️【第一道防線：Cloudflare KV 全球邊緣快取】
    // ==========================================================================
    if (env.WISHER_KV) {
      const cachedData = await env.WISHER_KV.get(cacheKey);
      if (cachedData) {
        console.log(`🎯 完美命中 KV 快取！Key: ${cacheKey}`);
        return new Response(cachedData, {
          headers: { 
            "Content-Type": "application/json; charset=utf-8",
            "X-Cache-Status": "HIT_KV"
          }
        });
      }
    }

    // ==========================================================================
    // ⚡【第二道防線：硬編碼 Preset 關鍵字快取】
    // ==========================================================================
    for (const item of PRESET_CACHE) {
      if (item.keywords.some(regex => regex.test(cleanWish))) {
        const presetPayload = JSON.stringify(item.response);
        
        // 順便把命中 Preset 的結果寫入 KV，加速後續查詢
        if (env.WISHER_KV && waitUntil) {
          waitUntil(env.WISHER_KV.put(cacheKey, presetPayload));
        }

        return new Response(presetPayload, {
          headers: { 
            "Content-Type": "application/json; charset=utf-8",
            "X-Cache-Status": "HIT_PRESET"
          }
        });
      }
    }

    // ==========================================================================
    // 🧠【第三道防線：Gemma 4 31B 現採推理】
    // ==========================================================================
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "尚未設定 GEMINI_API_KEY 環境變數" }), { status: 500 });
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent?key=${apiKey}`;

    const promptText = `你是一個冷酷、充滿諷刺感且邪惡的猴爪精靈。
當使用者許願時，你必須精準地在「字面意義上」實現他們的願望，但同時安排一個極度出乎意料、具諷刺意味且可怕的副作用。

【重要規定】
1. 最終輸出必須是「純 JSON」，絕對不能包含任何 Markdown 標籤（如 \`\`\`json）、開頭標題或說明文字。
2. JSON 格式規範如下：
{
  "granted": "願望表面實現方式",
  "side_effect": "可怕的副作用代價",
  "taunt": "嘲諷許願者的一句話"
}

使用者許願內容：${cleanWish}`;

    const promptBody = {
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      generationConfig: {
        temperature: 0.7,
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

    // 提取文字並進行洗滌解構
    const parts = apiData.candidates?.[0]?.content?.parts || [];
    const fullText = parts.filter(p => !p.thought).map(p => p.text || "").join("\n");
    const parsedData = parseModelJsonResponse(fullText);
    const finalPayload = JSON.stringify(parsedData);

    // ==========================================================================
    // 💾【功德圓滿：非同步背景寫入 KV 記憶體】
    // ==========================================================================
    if (env.WISHER_KV && waitUntil) {
      // 永久保存或設定 30 天過期 (例如 TTL: 2592000)
      waitUntil(env.WISHER_KV.put(cacheKey, finalPayload));
      console.log(`💾 成功將生成結果寫入 KV 邊緣庫！Key: ${cacheKey}`);
    }

    return new Response(finalPayload, {
      headers: { 
        "Content-Type": "application/json; charset=utf-8",
        "X-Cache-Status": "MISS"
      }
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
        if (parsed.granted && parsed.side_effect && parsed.taunt) {
          return parsed;
        }
      } catch (err) {}
    }
  }

  throw new Error("許願結果格式解析失敗，請再試一次");
}
