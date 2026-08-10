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

    // 呼叫 Gemma 4 31B Instruct
    const geminiUrl = `[https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent?key=$](https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent?key=$){apiKey}`;

    const promptBody = {
      contents: [
        {
          role: "user",
          parts: [{ text: `許願內容：${wish}` }]
        }
      ],
      systemInstruction: {
        parts: [{
          text: `你是一個冷酷、充滿諷刺感且邪惡的猴爪精靈。
當使用者許願時，你必須精準地在「字面意義上」實現他們的願望，但同時安排一個極度出乎意料、具諷刺意味且可怕的副作用。

請【務必】只回傳純 JSON 格式，絕對不要包含任何 Markdown 標記（如 ```json）、開頭說明或項目符號（*）。
JSON 格式範例：
{
  "granted": "願望實現情況",
  "side_effect": "可怕副作用",
  "taunt": "精靈嘲諷"
}`
        }]
      },
      generationConfig: {
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

    // 取得模型原始回傳字串
    const rawText = apiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // 透過清洗函式過濾 Markdown 雜訊並解析 JSON
    const parsedData = parseModelJsonResponse(rawText);

    return new Response(JSON.stringify(parsedData), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

/**
 * 安全解析 JSON 的過濾函式
 * 能夠處理 Markdown code block (```json) 以及前後多餘的文字雜訊
 */
function parseModelJsonResponse(text) {
  // 1. 移除 ```json 與 ``` 等語法標籤
  let cleaned = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();

  // 2. 嘗試直接解析
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // 3. 若模型包含了前導雜訊（如 * Role: ...），用正則只提取最外層 {...} 的 JSON 結構
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (innerErr) {
        throw new Error("無法解析抓取到的 JSON 內容");
      }
    }
    throw new Error(`模型的原始回應非有效 JSON 格式: ${text.slice(0, 40)}...`);
  }
}
