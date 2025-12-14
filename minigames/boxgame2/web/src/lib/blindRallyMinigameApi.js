export async function sendMinigameResult({ serverUrl, roomCode, won, sessionId }) {
  const payload = { roomCode, won };
  if (sessionId) payload.sessionId = sessionId;
  
  const res = await fetch(`${serverUrl}/minigame/result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  console.log(`✅ [Boxgame2] Result sent: won=${won}, roomCode=${roomCode}, sessionId=${sessionId || 'none'}`);
  return data; // { success:true, result:"won"|"lost" }
}
