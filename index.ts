/** @jsxImportSource npm:hono/jsx */
import { Hono } from "npm:hono";
import { serveStatic } from "npm:hono/deno";
import type { Context } from "npm:hono";
import { streamText } from "npm:ai";
import { createGoogleGenerativeAI } from "npm:@ai-sdk/google";

const google = createGoogleGenerativeAI({
  apiKey: Deno.env.get("GEMINI_API_KEY") || "",
});

const app = new Hono();

// Unwrap Hono errors to see original error details
app.onError((err: Error, c: Context) => {
  throw err;
});

app.get("/api/generate", async (c: Context) => {
  const { query } = c.req.query();

  console.log("Received query:", query);
  const webSchemeUrl = new URL(query);

  const { hostname: agent, pathname: agentQuery } = webSchemeUrl;

  console.log("Agent:", agent);
  console.log("Agent Query:", agentQuery);

  if (agent == null || agentQuery == null) {
    return c.json({ error: "Agent and agentQuery are required" }, 400);
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
    model: google("gemini-2.5-flash"),
    prompt: finalPrompt,
  });

  c.set("X-Stream-Id", result.id);
  c.set("Content-Type", "text/html; charset=utf-8");

  return result.toTextStreamResponse();
});

// Serve static files from frontend directory
app.get("/*", serveStatic({ root: "./frontend" }));

Deno.serve(app.fetch);
