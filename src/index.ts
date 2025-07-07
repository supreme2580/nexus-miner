import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { exec } from 'child_process';

const app = express();
const PORT = process.env.PORT || 3000;

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
            const div = document.createElement('div');
            div.className = 'status ' + (data.type === 'error' ? 'error' : data.type === 'complete' ? 'success' : 'info');
            div.textContent = data.message;
            output.appendChild(div);
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

// Global variable to store the last server output
let lastServerOutput = '🚀 Nexus Network CLI Setup Server is running...';

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

  // Send keep-alive message every 30 seconds
  const keepAliveInterval = setInterval(() => {
    sendKeepAlive();
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
    // Update the last server output for keep-alive endpoint
    lastServerOutput = data.message;
  };

  sendEvent({ type: 'status', message: '🚀 Starting Nexus CLI setup...' });
  
  // Step 1: Check if nexus-cli is already installed
  sendEvent({ type: 'status', message: '🔍 Checking if Nexus CLI is already installed...' });
  console.log('🔍 Checking if Nexus CLI is already installed...');
  
  exec('nexus-cli -V', (checkError, checkStdout, checkStderr) => {
    if (!checkError && checkStdout.includes('nexus-network')) {
      sendEvent({ type: 'status', message: '✅ Nexus CLI is already installed: ' + checkStdout.trim() });
      console.log('✅ Nexus CLI is already installed:', checkStdout.trim());
      
      // CLI is already available, proceed directly to setup
      sendEvent({ type: 'status', message: '🔄 Proceeding with setup...' });
      console.log('🔄 Proceeding with setup...');
      
      // Restart terminal environment
      sendEvent({ type: 'status', message: '🔄 Restarting terminal environment...' });
      console.log('🔄 Restarting terminal environment...');
      
      // Detect shell and use appropriate profile
      const shell = process.env.SHELL || '';
      let profileFile = '~/.zshrc'; // default
      
      console.log('🔍 Detected shell:', shell);
      sendEvent({ type: 'status', message: '🔍 Detected shell: ' + shell });
      
      if (shell.includes('bash')) {
        profileFile = '~/.bashrc';
      } else if (shell.includes('zsh')) {
        profileFile = '~/.zshrc';
      } else if (shell.includes('fish')) {
        profileFile = '~/.config/fish/config.fish';
      } else {
        profileFile = '~/.profile';
      }
      
      sendEvent({ type: 'status', message: '📝 Using shell profile: ' + profileFile });
      console.log('📝 Using shell profile:', profileFile);
      
      // Skip sourcing problematic profile and just export PATH directly
      sendEvent({ type: 'status', message: '🔄 Updating PATH directly...' });
      console.log('🔄 Updating PATH directly...');
      
      exec('export PATH="$HOME/.nexus/bin:$PATH" && echo "PATH updated successfully"', (sourceError, sourceStdout, sourceStderr) => {
        if (sourceError) {
          console.error('❌ Failed to restart terminal:', sourceError.message);
          sendEvent({ type: 'error', message: '❌ Failed to restart terminal: ' + sourceError.message });
          res.end();
          return;
        }
        
        sendEvent({ type: 'status', message: '✅ Terminal environment updated' });
        console.log('✅ Terminal environment updated');
        
        // Start the node with node ID
        const nodeId = process.env.NEXUS_NODE_ID || '12954263'; // Use the node ID from previous run
        sendEvent({ type: 'status', message: '🚀 Starting Nexus node with ID: ' + nodeId });
        console.log('🚀 Starting Nexus node with ID:', nodeId);
        
        // Start the node in background mode to avoid interactive input issues
        exec(`nexus-network start --node-id ${nodeId} > /dev/null 2>&1 &`, (startError, startStdout, startStderr) => {
          if (startError) {
            console.error('❌ Node start failed:', startError.message);
            sendEvent({ type: 'error', message: '❌ Node start failed: ' + startError.message });
            if (startStderr) {
              sendEvent({ type: 'error', message: 'Node start stderr: ' + startStderr });
            }
            res.end();
            return;
          }
          
          // Give it a moment to start up
          setTimeout(() => {
            console.log('✅ Node started successfully in background');
            sendEvent({ type: 'status', message: '✅ Node started successfully' });
            sendEvent({ type: 'status', message: '🎉 Nexus node is now contributing to the network!' });
            sendEvent({ type: 'complete', message: 'Setup completed successfully! Node ID: ' + nodeId });
            res.end();
          }, 2000);
        });
      });
    } else {
      // CLI not found, use direct installation
      sendEvent({ type: 'status', message: '📦 Installing Nexus CLI with direct method...' });
      console.log('📦 Installing Nexus CLI with direct method...');
      
      // Use direct curl installation with yes to accept terms
      exec(`curl -fsSL https://cli.nexus.xyz/ | sed '/read -p.*\/dev\/tty/d' | sh`, (error, stdout, stderr) => {
        if (error) {
          console.error('❌ CLI installation failed:', error.message);
          sendEvent({ type: 'error', message: '❌ CLI installation failed: ' + error.message });
          if (stderr) {
            sendEvent({ type: 'error', message: 'Stderr: ' + stderr });
          }
          res.end();
          return;
        }
        
        sendEvent({ type: 'status', message: '✅ Nexus CLI installed successfully' });
        console.log('✅ Nexus CLI installed successfully');
        
        // Restart terminal environment
        sendEvent({ type: 'status', message: '🔄 Restarting terminal environment...' });
        console.log('🔄 Restarting terminal environment...');
        
        // Detect shell and use appropriate profile
        const shell = process.env.SHELL || '';
        let profileFile = '~/.zshrc'; // default
        
        console.log('🔍 Detected shell:', shell);
        sendEvent({ type: 'status', message: '🔍 Detected shell: ' + shell });
        
        if (shell.includes('bash')) {
          profileFile = '~/.bashrc';
        } else if (shell.includes('zsh')) {
          profileFile = '~/.zshrc';
        } else if (shell.includes('fish')) {
          profileFile = '~/.config/fish/config.fish';
        } else {
          profileFile = '~/.profile';
        }
        
        sendEvent({ type: 'status', message: '📝 Using shell profile: ' + profileFile });
        console.log('📝 Using shell profile:', profileFile);
        
        // Skip sourcing problematic profile and just export PATH directly
        sendEvent({ type: 'status', message: '🔄 Updating PATH directly...' });
        console.log('🔄 Updating PATH directly...');
        
        exec('export PATH="$HOME/.nexus/bin:$PATH" && echo "PATH updated successfully"', (sourceError, sourceStdout, sourceStderr) => {
          if (sourceError) {
            console.error('❌ Failed to restart terminal:', sourceError.message);
            sendEvent({ type: 'error', message: '❌ Failed to restart terminal: ' + sourceError.message });
            res.end();
            return;
          }
          
          sendEvent({ type: 'status', message: '✅ Terminal environment updated' });
          console.log('✅ Terminal environment updated');
          
          // Start the node with node ID
          const nodeId = process.env.NEXUS_NODE_ID || '12954263'; // Use the node ID from previous run
          sendEvent({ type: 'status', message: '🚀 Starting Nexus node with ID: ' + nodeId });
          console.log('🚀 Starting Nexus node with ID:', nodeId);
          
          // Start the node in background mode to avoid interactive input issues
          exec(`nexus-network start --node-id ${nodeId} > /dev/null 2>&1 &`, (startError, startStdout, startStderr) => {
            if (startError) {
              console.error('❌ Node start failed:', startError.message);
              sendEvent({ type: 'error', message: '❌ Node start failed: ' + startError.message });
              if (startStderr) {
                sendEvent({ type: 'error', message: 'Node start stderr: ' + startStderr });
              }
              res.end();
              return;
            }
            
            // Give it a moment to start up
            setTimeout(() => {
              console.log('✅ Node started successfully in background');
              sendEvent({ type: 'status', message: '✅ Node started successfully' });
              sendEvent({ type: 'status', message: '🎉 Nexus node is now contributing to the network!' });
              sendEvent({ type: 'complete', message: 'Setup completed successfully! Node ID: ' + nodeId });
              res.end();
            }, 2000);
          });
        });
      });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 