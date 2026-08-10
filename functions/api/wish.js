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

    // 呼叫 Gemma 4 31B
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent?key=${apiKey}`;

    // 將 Prompt 與範例直接組合在 contents 中，避免角色混淆
    const promptText = `你是一個冷酷、充滿諷刺感且邪惡的猴爪精靈。
當使用者許願時，你必須精準地在「字面意義上」實現他們的願望，但同時安排一個極度出乎意料、具諷刺意味且可怕的副作用。

【重要規定】
1. 必須嚴格回傳純 JSON 格式，絕對不能輸出任何 JSON 以外的文字、Markdown 標籤或對話標頭。
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

    // 取得模型原始回傳文字
    const rawText = apiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // 解析與清洗 JSON
    const parsedData = parseModelJsonResponse(rawText);

    return new Response(JSON.stringify(parsedData), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

/**
 * 強效 JSON 提取與容錯解析器
 */
function parseModelJsonResponse(text) {
  if (!text) throw new Error("精靈沒有給予任何回應");

  // 提取第一個 { 到最後一個 } 之間的內容
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("回應格式異常，未能產生有效的許願結果");
  }

  let jsonCandidate = match[0];

  try {
    return JSON.parse(jsonCandidate);
  } catch (e1) {
    // 若因內部字串換行導致解析失敗，進行字串轉義處理
    try {
      const sanitized = jsonCandidate
        .replace(/\r/g, "")
        .replace(/\n/g, "\\n");
      return JSON.parse(sanitized);
    } catch (e2) {
      throw new Error("許願結果格式化失敗，請再試一次");
    }
  }
}
