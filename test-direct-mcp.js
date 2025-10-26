#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = join(__dirname, '.env.mcp');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const [key, value] = line.split('=');
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    }
  });
}

class MCPDirectClient {
  constructor() {
    this.messageId = 1;
    this.connected = false;
    this.tools = [];
  }

  async testSeiMCPServer() {
    console.log('🔍 Testing direct connection to sei-mcp-server...');
    
    try {
      // Spawn the sei-mcp-server process
      const serverProcess = spawn('npx', ['-y', '@sei-js/mcp-server'], {
        env: {
          ...process.env,
          PRIVATE_KEY: process.env.PRIVATE_KEY,
          SEI_PRIVATE_KEY: process.env.SEI_PRIVATE_KEY
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let responseBuffer = '';
      let initTimeout;

      // Set up timeout
      initTimeout = setTimeout(() => {
        console.log('❌ Connection timeout');
        serverProcess.kill();
        process.exit(1);
      }, 30000);

      // Handle stdout
      serverProcess.stdout.on('data', (data) => {
        responseBuffer += data.toString();
        const lines = responseBuffer.split('\n');
        responseBuffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const message = JSON.parse(line);
              this.handleMessage(message, serverProcess, initTimeout);
            } catch (error) {
              console.log('📝 Server output:', line);
            }
          }
        }
      });

      // Handle stderr
      serverProcess.stderr.on('data', (data) => {
        const errorOutput = data.toString();
        console.log('⚠️  Server stderr:', errorOutput.trim());
      });

      // Handle process exit
      serverProcess.on('exit', (code, signal) => {
        clearTimeout(initTimeout);
        console.log(`🔚 Server process exited with code ${code}, signal ${signal}`);
      });

      // Send initialize request
      console.log('📤 Sending initialize request...');
      const initMessage = {
        jsonrpc: '2.0',
        id: this.messageId++,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            experimental: {}
          },
          clientInfo: {
            name: 'direct-mcp-test',
            version: '1.0.0'
          }
        }
      };

      serverProcess.stdin.write(JSON.stringify(initMessage) + '\n');

    } catch (error) {
      console.error('❌ Failed to test sei-mcp-server:', error);
    }
  }

  handleMessage(message, serverProcess, initTimeout) {
    console.log('📨 Received message:', JSON.stringify(message, null, 2));

    // Handle initialize response
    if (message.result && message.id && !this.connected) {
      console.log('✅ Server initialized successfully');
      
      // Send initialized notification
      const initializedNotification = {
        jsonrpc: '2.0',
        method: 'notifications/initialized',
        params: {}
      };
      
      serverProcess.stdin.write(JSON.stringify(initializedNotification) + '\n');
      
      // Request tools list
      setTimeout(() => {
        const toolsRequest = {
          jsonrpc: '2.0',
          id: this.messageId++,
          method: 'tools/list',
          params: {}
        };
        
        console.log('📤 Requesting tools list...');
        serverProcess.stdin.write(JSON.stringify(toolsRequest) + '\n');
      }, 1000);
      
      this.connected = true;
    }

    // Handle tools list response
    if (message.result && message.result.tools) {
      this.tools = message.result.tools;
      console.log('🛠️  Available tools:', this.tools.map(t => t.name));
      
      // Test get_balance tool
      this.testBalanceTool(serverProcess);
      
      clearTimeout(initTimeout);
    }

    // Handle errors
    if (message.error) {
      console.error('❌ Server error:', message.error);
    }
  }

  async testBalanceTool(serverProcess) {
    console.log('\n💰 Testing get_balance tool...');
    
    const balanceTool = this.tools.find(t => t.name === 'get_balance');
    if (!balanceTool) {
      console.log('❌ get_balance tool not found');
      serverProcess.kill();
      return;
    }

    console.log('✅ Found get_balance tool');
    console.log('📋 Tool description:', balanceTool.description);

    // Call the get_balance tool with a test address
    const testAddress = '0x28482B1279E442f49eE76351801232D58f341CB9';
    const toolCallMessage = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method: 'tools/call',
      params: {
        name: 'get_balance',
        arguments: {
          address: testAddress,
          network: 'sei'
        }
      }
    };

    console.log(`📤 Calling get_balance for address: ${testAddress}`);
    serverProcess.stdin.write(JSON.stringify(toolCallMessage) + '\n');

    // Set timeout for tool call response
    setTimeout(() => {
      console.log('✅ MCP server test completed');
      serverProcess.kill();
      process.exit(0);
    }, 10000);
  }
}

// Run the test
const client = new MCPDirectClient();
client.testSeiMCPServer();
