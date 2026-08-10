// 經典高頻願望備用快取 (符合全新七大法則)
const PRESET_CACHE = [
  {
    keywords: [/1億/, /一億/, /一百萬/, /100萬/, /很有錢/, /暴富/, /發財/],
    response: {
      granted: "你的銀行帳戶瞬間多出了 1 億元現金，你可以自由劃撥支用。",
      cost: "你獲得了這筆錢，但未來你將付出身家性命成倍的代價。不久後你捲入了巨額洗錢案，不僅全部資產被查扣，還背負了 2 億元的黑道追債與終生監禁。"
    }
  },
  {
    keywords: [/復原/, /復活/, /狗狗/, /貓貓/, /寵物/, /阿嬤/, /媽媽/, /爸爸/],
    response: {
      granted: "你思念的親人/寵物確實回到了你的身邊，敲響了你的家門。",
      cost: "實現的方式極度糟糕。門外站著的是當初經過腐爛與解剖後、帶著泥土與腐肉氣味被強行拼湊起來的肉塊，正用怨恨的眼神看著你。"
    }
  },
  {
    keywords: [/飛/, /隱形/, /讀心/, /瞬間移動/, /超能力/, /魔法/],
    response: {
      granted: "你獲得了夢寐以求的隱形超能力，折射光線讓肉眼完全無法看見你。",
      cost: "能力瞬間失控且無法關閉。因為你的眼球也變成了完全透明，光線無法在視網膜上聚焦，你陷入了永遠的失明；且沒有人能再看見你或救你。"
    }
  },
  {
    keywords: [/癌症/, /腫瘤/, /治好/, /康復/, /生病/],
    response: {
      granted: "你體內的癌細胞被徹底清除，病痛瞬間消失。",
      cost: "猴爪過度活化了你的細胞修復機制。你的正常細胞開始無限量暴走增殖，幾週內你的全身長滿了巨大的肉瘤與器官畸胎，體型膨脹了三倍。"
    }
  },
  {
    keywords: [/^[a-zA-Z0-9\s\,\.\/\;\']{8,}$/, /asdf/, /qwerty/, /12345/],
    response: {
      granted: "猴爪靜靜地注視著你口中吐出的一連串混亂且無意義的喃喃自語...",
      cost: "猴爪判定許願者的大腦早已徹底瘋癲崩潰。它滿足了你混亂的精神狀態，直接剝奪了你最後的理智，將你永遠囚禁在無邏輯的幻覺深淵中。"
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
    const cacheKey = "wish_v3:" + encodeURIComponent(cleanWish.toLowerCase()).substring(0, 150);

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

    // 3. 呼叫 Gemma 4 31B（注入全新強規則 Prompt）
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "尚未設定 GEMINI_API_KEY 環境變數" }), { status: 500 });
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent?key=${apiKey}`;

    const promptText = `你是一個恪守契約、絕對狡詐且無情的猴爪精靈。
你的終極目標是讓使用者明白：「世界上沒有捷徑可走，有得必有失，天下沒有免費的午餐。」

請分析使用者的許願內容，精準在字面上實現，並嚴格根據以下【猴爪七大詛咒法則】判斷並給予對應代價：

【猴爪七大詛咒法則】
1. 【物質獲得】（如車、房、物品）：憑空得來的，未來必會「加倍失去」（如得到豪宅，不久後連同原有財產雙倍賠光）。
2. 【家人或寵物】（如健康、復活、留下來）：願望會成真，但「實現的方式極度糟糕殘酷」（如以血腥意外或畸形模樣回歸）。
3. 【錢、權、色】（如暴富、地位、異性喜愛）：未來需要「付出成倍代價」（如獲得權力，未來付出雙倍代價慘遭背叛毀滅）。
4. 【惡意詛咒】（如希望討厭的人遭殃、死掉）：惡意與傷害會「加倍回饋到許願者自己身上」。
5. 【治療疾病/健康】：必定「治療過度」（如細胞過度修復導致無限狂暴增殖、器官畸變）。
6. 【魔法/超能力】（如飛、隱形、讀心）：能力必定「完全失控毀滅」（如隱形導致眼球透明失明、讀心導致腦部燒毀）。
7. 【亂碼/無意義字串】：直接判定「使用者已經精神失常、瘋了」，給出精神崩潰的恐怖結局。
8. 【其餘類別】：由猴爪判定，但永遠堅持「沒有捷徑，付出代價」。

【重要格式規定】
1. 最終輸出必須是「純 JSON」，絕對不能包含任何 Markdown 標記（如 \`\`\`json）、開頭標題或說明文字。
2. JSON 格式規範如下：
{
  "granted": "願望實現情況（精準符合字面描述）",
  "cost": "代價與下場（嚴格對應上述七大法則，寫出具體且震撼的後果）"
}`;

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
