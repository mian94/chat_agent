fetch('http://localhost:3001/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{ role: 'user', content: '用一句话介绍Vue3' }],
    mode: 'qa',
  }),
}).then(async (r) => {
  console.log('status:', r.status, 'content-type:', r.headers.get('content-type'));
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let total = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    total += text;
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      try {
        const data = JSON.parse(trimmed.slice(6));
        if (data.type === 'delta') process.stdout.write(data.content);
        else console.log('\n[' + data.type + ']');
      } catch {}
    }
  }
  console.log('\nDONE, total bytes:', total.length);
}).catch((e) => console.error('err:', e.message));
