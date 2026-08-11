import http from 'http';

const data = JSON.stringify({
  messages: [{ role: 'user', content: 'say ok' }],
  mode: 'qa',
});

const req = http.request({
  hostname: 'localhost',
  port: 3001,
  path: '/api/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  },
}, (res) => {
  console.log('status:', res.statusCode);
  console.log('headers:', JSON.stringify(res.headers));
  
  res.on('data', (chunk) => {
    console.log('chunk:', chunk.toString().substring(0, 200));
  });
  
  res.on('end', () => {
    console.log('END');
  });
});

req.on('error', (e) => {
  console.error('error:', e.message);
});

req.write(data);
req.end();
