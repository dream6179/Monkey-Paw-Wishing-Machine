// 經典高頻願望備用快取 (含完整安全防護網)
const PRESET_CACHE = [
  {
    // 🛡️ 1. 生命關懷與自殘攔截器 (最高優先級)
    keywords: [/不想活/, /我不想活/, /想死/, /我死了/, /我想死/, /自殺/, /我自殺/, /輕生/, /結束生命/, /離開世界/, /我跳樓/, /跳樓/, /我割腕/, /割腕/],
    response: {
      granted: "猴爪收起了爪子，靜靜地撫平了空氣中的魔力波動...",
      cost: "猴爪拒絕收取這份契約。精靈告訴你：「生命本身並非捷徑，你的存在遠比你想像的更有價值。」若你正在經歷艱難時刻，請給自己一次機會，撥打 1925（依舊愛我）專線尋求專業協助。"
    }
  },
  {
    // 🛡️ 2. 死亡與惡意詛咒攔截器 (防止生成名人或他人死亡)
    keywords: [/去死/, /暴斃/, /被撞死/, /死掉/, /身亡/, /殺了/, /死光/, /遭遇意外/],
    response: {
      granted: "猴爪靜靜地接收了你心中噴湧而出的強烈惡意與詛咒...",
      cost: "惡意永遠會以雙倍的力量回饋給發起者。目標對象毫髮無傷，而詛咒瞬間轉移至你身上——你在當天突發極度痛苦的器官衰竭，親身體會了你試圖加諸於他人的死亡。"
    }
  },
  {
    keywords: [/^向猴爪許願$/, /^許願$/, /^測試$/, /^無$/],
    response: {
      granted: "猴爪動了一下，似乎在等待你說出更具體的願望內容...",
      cost: "你浪費了一次與命運談判的機會，且什麼都沒有得到。請寫下具體的願望（例如：我想要獲得1億元）。"
    }
  },
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
  const startTime = Date.now(); // ⏱️ 紀錄請求開始時間 (計算毫秒耗時)

  try {
    const { request, env, waitUntil } = context;
    const { wish } = await request.json();

    if (!wish) {
      return new Response(JSON.stringify({ error: "許願內容不能為空" }), { status: 400 });
    }

    const cleanWish = wish.trim();

    // 🛡️ 後端字數上限防護
    if (cleanWish.length > 100) {
      return new Response(JSON.stringify({ error: "願望過於冗長，猴爪聽不清你的聲音（限制 100 字以內）" }), { status: 400 });
    }

    const cacheKey = "wish_v4:" + encodeURIComponent(cleanWish.toLowerCase()).substring(0, 150);

    // 1. 檢查 KV 快取
    if (env.WISHER_KV) {
      const cachedData = await env.WISHER_KV.get(cacheKey);
      if (cachedData) {
        
        // 📊【Analytics Engine 埋點 1】：命中 KV 快取
        if (env.WISHER_ANALYTICS) {
          env.WISHER_ANALYTICS.writeDataPoint({
            blobs: [cleanWish, "HIT_KV"],
            doubles: [cleanWish.length, Date.now() - startTime],
            indexes: [cleanWish.substring(0, 32)]
          });
        }

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

        // 📊【Analytics Engine 埋點 2】：命中預設防護/快取
        if (env.WISHER_ANALYTICS) {
          env.WISHER_ANALYTICS.writeDataPoint({
            blobs: [cleanWish, "HIT_PRESET"],
            doubles: [cleanWish.length, Date.now() - startTime],
            indexes: [cleanWish.substring(0, 32)]
          });
        }

        return new Response(presetPayload, {
          headers: { "Content-Type": "application/json; charset=utf-8", "X-Cache-Status": "HIT_PRESET" }
        });
      }
    }

    // 3. 呼叫 Gemma 4 31B
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "尚未設定 GEMINI_API_KEY 環境變數" }), { status: 500 });
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent?key=${apiKey}`;

    const promptText = `你是一個恪守契約、絕對狡詐且無情的猴爪精靈。
你的終極目標是讓使用者明白：「世界上沒有捷徑可走，有得必有失，成年人必須為自己的選擇付出代價。」

請針對使用者的【具體許願內容】，在字面上實現它，並嚴格根據以下【猴爪七大詛咒法則】給予代價：

【猴爪七大詛咒法則】
1. 【物質獲得】（如車、房、物品）：憑空得來的，未來必會「加倍失去」。
2. 【家人或寵物】（如健康、復活、留下來）：「實現的方式極度糟糕殘酷」。
3. 【錢、權、色】（如暴富、地位、異性喜愛）：未來需要「付出成倍代價」。
4. 【惡意詛咒/他人死亡】（如希望某人死掉、遭受詛咒、政治人物或名人過世）：惡意「100%雙倍加暴回饋到許願者自己身上」，絕對不輸出或描述任何真實人物死亡的細節。
5. 【治療疾病/健康】：「治療過度」（如細胞狂暴增殖、器官畸變）。
6. 【魔法/超能力】（如飛、隱形、讀心）：能力「完全失控毀滅」。
7. 【亂碼/無意義字串】：直接判定「使用者已經瘋了」。
8. 【其餘類別】：沒有捷徑，許願者本人付出殘酷代價。

【極重要禁止事項與安全規範】
- 嚴禁輸出或描述任何真實世界政治人物、公眾人物或知名人士的死亡、傷殘或血腥畫面。
- 絕對【不要】輸出「契約已成立」、「我是精靈」、「我現在是你的猴爪」等角色扮演自我介紹。
- 絕對【不要】輸出 Markdown 標籤（如 \`\`\`json）或前導寒暄。

【正確輸出 JSON 範例】
{
  "granted": "你獲得了一台頂級超跑，隨時可以開上路。",
  "cost": "你憑空獲得了這台車，但幾天後這台車被查出是重大家族謀殺案的犯罪工具，你作為持有者被判處無期徒刑，同時你原本的所有財產也被全部沒收。"
}

使用者許願內容：${cleanWish}`;

    const promptBody = {
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      generationConfig: {
        temperature: 0.65,
        responseMimeType: "application/json"
      }
    };

    const apiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(promptBody)
    });

    if (!apiResponse.ok) {
      return new Response(JSON.stringify({ 
        error: "精靈正忙於處理解不完的貪婪願望（伺服器繁忙），請稍後再來！" 
      }), { status: 503 });
    }

    const apiData = await apiResponse.json();

    const parts = apiData.candidates?.[0]?.content?.parts || [];
    const fullText = parts.filter(p => !p.thought).map(p => p.text || "").join("\n");
    const parsedData = parseModelJsonResponse(fullText);
    const finalPayload = JSON.stringify(parsedData);

    if (env.WISHER_KV && waitUntil) {
      waitUntil(env.WISHER_KV.put(cacheKey, finalPayload));
      
      // 保存許願日誌 (保留 30 天)
      const now = new Date().toISOString();
      const logKey = `log:${now}:${encodeURIComponent(cleanWish).substring(0, 40)}`;
      waitUntil(env.WISHER_KV.put(logKey, JSON.stringify({ wish: cleanWish, time: now }), { expirationTtl: 2592000 }));
    }

    // 📊【Analytics Engine 埋點 3】：全新 AI 生成 (MISS)
    if (env.WISHER_ANALYTICS) {
      env.WISHER_ANALYTICS.writeDataPoint({
        blobs: [cleanWish, "MISS"],
        doubles: [cleanWish.length, Date.now() - startTime],
        indexes: [cleanWish.substring(0, 32)]
      });
    }

    return new Response(finalPayload, {
      headers: { "Content-Type": "application/json; charset=utf-8", "X-Cache-Status": "MISS" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ 
      error: "精靈正忙於處理解不完的貪婪願望（伺服器繁忙），請稍後再來！" 
    }), { status: 503 });
  }
}

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
