export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API 키가 서버에 설정되지 않았습니다. Vercel 환경변수를 확인해주세요.' });
  }

  try {
    const { model, system, messages, max_tokens } = req.body;

    // Anthropic 포맷 → Gemini 포맷 변환
    const userMessage = messages?.[0]?.content;

    let parts = [];
    if (Array.isArray(userMessage)) {
      // 이미지 + 텍스트 혼합
      for (const block of userMessage) {
        if (block.type === 'text') {
          parts.push({ text: block.text });
        } else if (block.type === 'image') {
          parts.push({
            inlineData: {
              mimeType: block.source.media_type,
              data: block.source.data,
            },
          });
        }
      }
    } else {
      parts.push({ text: userMessage });
    }

    const geminiBody = {
      system_instruction: { parts: [{ text: system || '' }] },
      contents: [{ role: 'user', parts }],
      generationConfig: {
        maxOutputTokens: max_tokens || 4096,
        temperature: 0.7,
      },
    };

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody),
      }
    );

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      return res.status(geminiRes.status).json({ error: data.error?.message || 'Gemini API 오류' });
    }

    // Anthropic 응답 포맷으로 변환 (index.html이 그대로 작동하도록)
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.status(200).json({
      content: [{ type: 'text', text }],
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
