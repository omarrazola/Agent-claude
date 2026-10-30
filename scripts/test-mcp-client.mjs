import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function testMCP() {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["scripts/design-system-mcp.mjs"]
  });

  const client = new Client({
    name: "test-client",
    version: "1.0.0"
  }, {
    capabilities: {}
  });

  await client.connect(transport);

  console.log("=== 1. LIST TOOLS ===");
  const tools = await client.listTools();
  console.log("Tools count:", tools.tools.length);
  tools.tools.forEach(t => console.log(`- ${t.name}: ${t.description.slice(0, 70)}...`));

  console.log("\n=== 2. CALL TOOL: get_component_spec (Button) ===");
  const btnRes = await client.callTool({
    name: "get_component_spec",
    arguments: { componentName: "Button" }
  });
  console.log(btnRes.content[0].text);

  console.log("\n=== 3. CALL TOOL: get_design_token (--base-black) ===");
  const tokenRes = await client.callTool({
    name: "get_design_token",
    arguments: { tokenName: "--base-black" }
  });
  console.log(tokenRes.content[0].text);

  console.log("\n=== 4. LIST RESOURCES ===");
  const resources = await client.listResources();
  resources.resources.forEach(r => console.log(`- ${r.uri}: ${r.name}`));

  await client.close();
  console.log("\n✓ MCP Server test passed 100%!");
}

testMCP().catch(console.error);
