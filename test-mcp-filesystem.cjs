const { spawn } = require('child_process');

async function testFilesystemMCP() {
  console.log('Testing MCP Filesystem Server...');
  
  // Start the filesystem server
  const server = spawn('npx', ['@modelcontextprotocol/server-filesystem', './']);
  
  let output = '';
  server.stdout.on('data', (data) => {
    output += data.toString();
    console.log('Server output:', data.toString());
  });
  
  server.stderr.on('data', (data) => {
    console.log('Server error:', data.toString());
  });
  
  // Send an initialization request
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '1.0.0',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    }
  };
  
  setTimeout(() => {
    server.stdin.write(JSON.stringify(initRequest) + '\n');
    
    // Send a tools/list request
    const toolsRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list'
    };
    
    setTimeout(() => {
      server.stdin.write(JSON.stringify(toolsRequest) + '\n');
      
      setTimeout(() => {
        server.kill();
        console.log('Test complete. Output captured:', output);
      }, 1000);
    }, 500);
  }, 500);
}

testFilesystemMCP().catch(console.error);
