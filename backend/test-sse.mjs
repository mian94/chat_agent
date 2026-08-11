// 测试 SSE 聊天接口
async function test() {
  console.log('发送请求...');
  const body = JSON.stringify({
    messages: [{ role: 'user', content: '你好' }],
    mode: 'qa'
  });
  
  const response = await fetch('http://localhost:3001/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  });
  
  console.log('status:', response.status);
  console.log('headers:', Object.fromEntries(response.headers.entries()));
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let count = 0;
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      console.log('流结束，共收到', count, '个数据块');
      break;
    }
    
    count++;
    const chunk = decoder.decode(value, { stream: true });
    console.log(`CHUNK #${count} (${chunk.length} bytes):`, chunk.substring(0, 100));
  }
}

test().catch(console.error);
