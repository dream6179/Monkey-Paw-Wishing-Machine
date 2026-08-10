export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { wish, granted, cost, reason } = await request.json();

    if (!wish) {
      return new Response(JSON.stringify({ error: "無效的檢舉內容" }), { status: 400 });
    }

    if (!env.WISHER_KV) {
      return new Response(JSON.stringify({ error: "尚未綁定 WISHER_KV" }), { status: 500 });
    }

    // 建立帶有時間戳記與原許願 Key 的檢舉紀錄
    const timestamp = new Date().toISOString();
    const targetCacheKey = "wish_v4:" + encodeURIComponent(wish.trim().toLowerCase()).substring(0, 150);
    const reportKey = `report:${timestamp}:${encodeURIComponent(wish.trim()).substring(0, 50)}`;

    const reportData = {
      reported_at: timestamp,
      wish: wish,
      granted: granted,
      cost: cost,
      reason: reason || "使用者未說明原因",
      target_cache_key: targetCacheKey // 方便你對照刪除
    };

    // 寫入 KV（資料保存 90 天，TTL: 7776000 秒）
    await env.WISHER_KV.put(reportKey, JSON.stringify(reportData), { expirationTtl: 7776000 });

    return new Response(JSON.stringify({ success: true, message: "檢舉已收到，感謝協助監督猴爪！" }), {
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
