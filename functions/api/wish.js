export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { wish } = await request.json();

    if (!wish) {
      return new Response(JSON.stringify({ error: "許願內容不能為空" }), { status: 400 });
    }

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

使用者許願內容：${wish}`;

    const promptBody = {
      contents: [
        {
          role: "user",
          parts: [{ text: promptText }]
        }
      ],
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
      console.error("Gemma API Error:", apiData);
      return new Response(JSON.stringify({ error: apiData.error?.message || "精靈拒絕回應許願" }), { status: 500 });
    }

    // 1. 處理 parts 陣列：過濾掉明確標記為思考過程的 part，並將其餘文字合併
    const parts = apiData.candidates?.[0]?.content?.parts || [];
    const fullText = parts
      .filter(p => !p.thought) // 忽略 API 自動標記為 thought 的區塊
      .map(p => p.text || "")
      .join("\n");

    // 2. 進行多重清洗與 JSON 解析
    const parsedData = parseModelJsonResponse(fullText);

    return new Response(JSON.stringify(parsedData), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

/**
 * 專為帶有思考過程 (Reasoning/CoT) 的模型設計的 JSON 解析器
 */
function parseModelJsonResponse(text) {
  if (!text) throw new Error("精靈沒有給予任何回應");

  // 1. 移除 <think>...</think> 或 <thought>...</thought> 思考區塊
  let cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();

  // 2. 先嘗試直接解析
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // 繼續向下處置
  }

  // 3. 找出所有像是 JSON 的 `{...}` 區塊（從後往前解析，因為真正的回答通常在思考過程之後）
  const matches = [...cleaned.matchAll(/\{[\s\S]*?\}/g)];
  if (matches.length > 0) {
    // 從最後一個匹配到的區塊開始倒著試
    for (let i = matches.length - 1; i >= 0; i--) {
      try {
        const candidate = matches[i][0];
        const parsed = JSON.parse(candidate);
        // 確保抓到的 JSON 含有我們需要的 key
        if (parsed.granted && parsed.side_effect && parsed.taunt) {
          return parsed;
        }
      } catch (err) {
        // 解析失敗則繼續試前一個
      }
    }
  }

  // 4. 救援處理：若因換行符號問題導致解析失敗
  const fallbackMatch = cleaned.match(/\{[\s\S]*\}/);
  if (fallbackMatch) {
    try {
      const sanitized = fallbackMatch[0]
        .replace(/\r/g, "")
        .replace(/\n/g, "\\n");
      return JSON.parse(sanitized);
    } catch (e) {
      // 救援失敗
    }
  }

  throw new Error("許願結果格式解析失敗，請再試一次");
}
