import http from 'node:http';
import net from 'node:net';

const TARGET_PORT = 5173;
const PROXY_PORT = 5174;

const server = http.createServer((req, res) => {
  const options = {
    hostname: '127.0.0.1',
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: `127.0.0.1:${TARGET_PORT}`
    }
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Dev server forwarder error: ' + err.message);
  });

  req.pipe(proxyReq, { end: true });
});

server.on('upgrade', (req, clientSocket, head) => {
  const targetSocket = net.connect(TARGET_PORT, '127.0.0.1', () => {
    clientSocket.write('HTTP/1.1 101 Switching Protocols\r\n' +
                       'Upgrade: websocket\r\n' +
                       'Connection: Upgrade\r\n\r\n');
    targetSocket.write(head);
    targetSocket.pipe(clientSocket);
    clientSocket.pipe(targetSocket);
  });

  targetSocket.on('error', () => {
    clientSocket.destroy();
  });
});

server.listen(PROXY_PORT, '127.0.0.1', () => {
  console.log(`Port forwarder listening on http://127.0.0.1:${PROXY_PORT} -> http://127.0.0.1:${TARGET_PORT}`);
});
