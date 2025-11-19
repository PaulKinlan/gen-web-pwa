/** @jsxImportSource npm:hono/jsx */
import { Hono } from "npm:hono";
import { serveStatic } from "npm:hono/deno";
import type { Context } from "npm:hono";
import { streamText } from "npm:ai";
import { createGoogleGenerativeAI } from "npm:@ai-sdk/google";

const google = createGoogleGenerativeAI({
  apiKey: Deno.env.get("GOOGLE_API_KEY"),
});

const app = new Hono();

// Unwrap Hono errors to see original error details
app.onError((err: Error, c: Context) => {
  throw err;
});

app.get("/api/generate", async (c: Context) => {
  const { agent, query } = c.req.query();

  if (!agent || !query) {
    return c.json({ error: "Agent and query are required" }, 400);
  }

  const agents = await Deno.readTextFile("./backend/agents.json").then(
    JSON.parse
  );
  const agentConfig = agents[agent];

  if (!agentConfig) {
    return c.json({ error: "Agent not found" }, 404);
  }

  const systemPrompt =
    "You are an expert web designer. Generate a single HTML file with inline CSS and JavaScript that fulfills the user's request. The design should be modern, responsive, and visually appealing.";
  const brandPrompt = agentConfig.brand;
  const sitePrompt = agentConfig.site;

  const finalPrompt = `${systemPrompt}\n\n**Brand Guidelines:**\n${brandPrompt}\n\n**Website Goal:**\n${sitePrompt}\n\n**User Query:**\n${query}`;

  const result = await streamText({
    model: google("models/gemini-pro"),
    prompt: finalPrompt,
  });

  return result.toTextStreamResponse();
});

// Serve static files from frontend directory
app.get("/*", serveStatic({ root: "./frontend" }));

export default app.fetch;
