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

// Helper function to create a transform stream that extracts HTML from markdown code blocks
function createHtmlExtractorStream(): TransformStream<string, string> {
  let buffer = "";
  let insideCodeBlock = false;
  let htmlStarted = false;

  return new TransformStream({
    transform(chunk, controller) {
      buffer += chunk;

      // Check for opening code fence
      if (!insideCodeBlock && buffer.includes("```html")) {
        const htmlStartIndex = buffer.indexOf("```html") + 7; // Length of "```html"
        buffer = buffer.slice(htmlStartIndex);
        insideCodeBlock = true;
        htmlStarted = true;
      }

      // Check for closing code fence
      if (insideCodeBlock && buffer.includes("```")) {
        const endIndex = buffer.indexOf("```");
        const htmlContent = buffer.slice(0, endIndex);
        controller.enqueue(htmlContent);
        buffer = ""; // Clear buffer after extraction
        insideCodeBlock = false;
        return;
      }

      // If we're inside the code block, emit the content
      if (htmlStarted && insideCodeBlock) {
        controller.enqueue(buffer);
        buffer = "";
      }
    },
    flush(controller) {
      // Emit any remaining buffer content if we're inside a code block
      if (insideCodeBlock && buffer) {
        controller.enqueue(buffer);
      }
    },
  });
}

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

  // Get the text stream from the AI SDK result
  const textStream = result.toTextStreamResponse();
  const reader = textStream.body?.getReader();

  if (!reader) {
    return c.json({ error: "Failed to create stream reader" }, 500);
  }

  // Create a new readable stream that extracts HTML from markdown
  const htmlStream = new ReadableStream({
    async start(controller) {
      const decoder = new TextDecoder();
      const htmlExtractor = createHtmlExtractorStream();
      const writer = htmlExtractor.writable.getWriter();
      const extractedReader = htmlExtractor.readable.getReader();

      // Pipe the AI stream through the extractor
      const readPromise = (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              await writer.close();
              break;
            }
            const text = decoder.decode(value, { stream: true });
            await writer.write(text);
          }
        } catch (error) {
          console.error("Error reading stream:", error);
          await writer.abort(error);
        }
      })();

      // Read from the extractor and send to response
      try {
        while (true) {
          const { done, value } = await extractedReader.read();
          if (done) break;
          controller.enqueue(new TextEncoder().encode(value));
        }
      } catch (error) {
        console.error("Error in extractor stream:", error);
      }

      await readPromise;
      controller.close();
    },
  });

  c.header("X-Stream-Id", result.id);
  c.header("Content-Type", "text/html; charset=utf-8");

  return new Response(htmlStream);
});

// Serve static files with proper MIME types
app.get("*.tsx", async (c: Context) => {
  const path = c.req.path.slice(1); // Remove leading slash
  const content = await Deno.readTextFile(`./frontend/${path}`);
  return c.text(content, 200, {
    "Content-Type": "application/javascript; charset=utf-8",
  });
});

// Serve static files from frontend directory
app.get("/*", serveStatic({ root: "./frontend" }));

Deno.serve(app.fetch);
