import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

// Create an MCP server
const server = new McpServer({
  name: 'Demo',
  version: '1.0.0',
})

server.tool(
  'calculate-bmi',
  {
    weightKg: z.number(),
    heightM: z.number(),
  },
  async ({ weightKg, heightM }) => ({
    content: [{
      type: 'text',
      text: String(weightKg / (heightM * heightM)),
    }],
  }),
)

// Async tool with external API call
server.tool(
  'fetch-weather',
  { city: z.string() },
  async ({ city }) => {
    const response = await fetch(`https://api.weather.com/${city}`)
    const data = await response.text()
    return {
      content: [{ type: 'text', text: data }],
    }
  },
)

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport()

async function main() {
  await server.connect(transport)
}
main()
