// 测试聊天 SSE 接口
const body = JSON.stringify({
  messages: [{ role: 'user', content: '你好，请简短回答' }],
  mode: 'qa'
});

console.log('发送请求...');
const response = await fetch('http://localhost:3001/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body
});

console.log('status:', response.status);
console.log('headers:', Object.fromEntries(response.headers.entries()));

const reader = response.body.getReader();
const decoder = new TextDecoder();
let count = 0;

while (true) {
  const { done, value } = await reader.read();
  if (done) {
    console.log('流结束，共收到', count, '个数据块');
    break;
  }
  count++;
  const chunk = decoder.decode(value, { stream: true });
  // 只显示前 100 个字符
  const preview = chunk.length > 100 ? chunk.substring(0, 100) + '...' : chunk;
  console.log(`CHUNK #${count}:`, preview);
}
