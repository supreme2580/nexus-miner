import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { exec, spawn } from 'child_process';
import * as pty from 'node-pty';

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024; // 10MB
let terminalOutputBuffer = '';

const app = express();
const PORT = process.env.PORT || 3000;

// Memory monitoring for 512MB limit
const logMemoryUsage = () => {
  const memUsage = process.memoryUsage();
  const memMB = {
    rss: Math.round(memUsage.rss / 1024 / 1024),
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024)
  };
  console.log(`Memory usage: RSS=${memMB.rss}MB, Heap=${memMB.heapUsed}/${memMB.heapTotal}MB`);
  
  // Warn if approaching 512MB limit
  if (memMB.rss > 400) {
    console.warn(`⚠️ High memory usage: ${memMB.rss}MB`);
  }
};

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Nexus Network CLI Setup</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .status { margin: 10px 0; padding: 10px; border-radius: 5px; }
        .status.info { background: #e3f2fd; }
        .status.error { background: #ffebee; color: #c62828; }
        .status.success { background: #e8f5e8; color: #2e7d32; }
        button { padding: 15px 30px; font-size: 18px; background: #2196f3; color: white; border: none; border-radius: 5px; cursor: pointer; }
        button:hover { background: #1976d2; }
        #output { margin-top: 20px; max-height: 400px; overflow-y: auto; border: 1px solid #ddd; padding: 20px; }
      </style>
    </head>
    <body>
      <h1>🚀 Nexus Network CLI Setup</h1>
      <p>Click the button below to automatically install and configure the Nexus CLI for contributing to the network.</p>
      <button onclick="startSetup()">Start Nexus Setup</button>
      <div id="output"></div>
      
      <script>
        function startSetup() {
          const output = document.getElementById('output');
          output.innerHTML = '<div class="status info">🔄 Connecting to server...</div>';
          
          const eventSource = new EventSource('/run');
          
          eventSource.onmessage = function(event) {
            const data = JSON.parse(event.data);
            
            if (data.type === 'terminal') {
              // Handle terminal output with colors
              const pre = document.createElement('pre');
              pre.style.cssText = 'margin: 0; padding: 5px; background: #000; color: #fff; font-family: monospace; font-size: 12px; white-space: pre-wrap;';
              pre.textContent = data.output;
              output.appendChild(pre);
            } else {
              // Handle regular status messages
              const div = document.createElement('div');
              div.className = 'status ' + (data.type === 'error' ? 'error' : data.type === 'complete' ? 'success' : 'info');
              div.textContent = data.message;
              output.appendChild(div);
            }
            
            output.scrollTop = output.scrollHeight;
            
            if (data.type === 'complete' || data.type === 'error') {
              eventSource.close();
            }
          };
          
          eventSource.onerror = function() {
            output.innerHTML += '<div class="status error">❌ Connection lost</div>';
            eventSource.close();
          };
        }
      </script>
    </body>
    </html>
  `);
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Nexus node service is active.' });
});

  // Global variable to store the last server output (limited size for memory efficiency)
  let lastServerOutput = '🚀 Nexus Network CLI Setup Server is running...';
  const MAX_OUTPUT_SIZE = 1024; // Limit output to 1KB to prevent memory bloat

app.get('/keep-alive', (req, res) => {
  // Set headers for Server-Sent Events to keep connection alive
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const sendKeepAlive = () => {
    res.write(`data: ${JSON.stringify({ 
      type: 'keep-alive', 
      message: lastServerOutput,
      timestamp: new Date().toISOString()
    })}\n\n`);
  };

  // Send initial message
  sendKeepAlive();

  // Send keep-alive message every 30 seconds (memory efficient)
  const keepAliveInterval = setInterval(() => {
    sendKeepAlive();
    // Hint to garbage collector
    if (global.gc) global.gc();
  }, 30000);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(keepAliveInterval);
  });
});

// Simple ping endpoint for cron jobs
app.get('/ping', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: lastServerOutput,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/run', (req, res) => {
  // Set headers for Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    lastServerOutput = data.message || lastServerOutput;
  };

  sendEvent({ type: 'status', message: '🚀 Starting Nexus CLI setup...' });
  logMemoryUsage();
  
  // Simple Nexus CLI installation
  sendEvent({ type: 'status', message: '📦 Installing Nexus CLI...' });
  console.log('📦 Installing Nexus CLI...');
  
  const installProcess = spawn('sh', ['-c', 'curl https://cli.nexus.xyz/ | sh'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Stream all output to terminal console only (max 10MB)
  installProcess.stdout.on('data', (data: Buffer) => {
    const output = data.toString();
    terminalOutputBuffer += output;
    if (terminalOutputBuffer.length > MAX_OUTPUT_BYTES) {
      terminalOutputBuffer = terminalOutputBuffer.slice(-MAX_OUTPUT_BYTES);
    }
    process.stdout.write(output);
  });

  installProcess.stderr.on('data', (data: Buffer) => {
    const output = data.toString();
    terminalOutputBuffer += output;
    if (terminalOutputBuffer.length > MAX_OUTPUT_BYTES) {
      terminalOutputBuffer = terminalOutputBuffer.slice(-MAX_OUTPUT_BYTES);
    }
    process.stderr.write(output);
  });

  // Send Y for any prompts
  installProcess.stdin.write('Y\n');
  
  installProcess.on('close', (code) => {
    if (code === 0) {
      sendEvent({ type: 'status', message: '✅ Nexus CLI installed successfully' });
      console.log('✅ Nexus CLI installed successfully');
      
      // Update PATH
      process.env.PATH = `${process.env.HOME}/.nexus/bin:${process.env.PATH}`;
      console.log('Updated PATH:', process.env.PATH);
      
      sendEvent({ type: 'status', message: '✅ Setup completed successfully!' });
      sendEvent({ type: 'complete', message: 'Nexus CLI is ready to use!' });
    } else {
      sendEvent({ type: 'error', message: '❌ Installation failed with code: ' + code });
      console.error('❌ Installation failed with code:', code);
    }
    res.end();
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  logMemoryUsage();
  
  // Log memory usage every 5 minutes
  setInterval(logMemoryUsage, 5 * 60 * 1000);
}); 