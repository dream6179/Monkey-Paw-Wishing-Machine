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

    // 呼叫 Gemini API (使用最新的 gemini-2.5-flash)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

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

你必須回傳 JSON 格式，且絕對不能輸出任何 JSON 之外的贅字或 Markdown 標籤。
格式必須嚴格包含以下三個 key：
1. "granted": 願望表面上是如何實現的（精準符合字面意思）。
2. "side_effect": 伴隨而來的可怕代價、詛咒或副作用。
3. "taunt": 一句冷酷、幽默且嘲諷許願者貪婪或愚蠢的結語。`
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
      console.error("Gemini API Error:", apiData);
      return new Response(JSON.stringify({ error: "Gemini 拒絕回應許願" }), { status: 500 });
    }

    // 解析 Gemini 回傳的 JSON 字串
    const rawText = apiData.candidates[0].content.parts[0].text;
    const parsedData = JSON.parse(rawText);

    return new Response(JSON.stringify(parsedData), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
