// Simple test - just check if we get a response
fetch('http://localhost:3001/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'say ok' }],
    mode: 'qa',
  }),
}).then(async (r) => {
  console.log('status:', r.status);
  console.log('content-type:', r.headers.get('content-type'));
  
  // Read first chunk only
  const reader = r.body.getReader();
  const { done, value } = await reader.read();
  console.log('first chunk - done:', done, 'bytes:', value?.length);
  if (value) {
    const text = new TextDecoder().decode(value);
    console.log('data:', text.substring(0, 300));
  }
  reader.cancel();
}).catch((e) => console.error('err:', e.message));
