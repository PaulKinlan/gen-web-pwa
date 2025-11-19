/** @jsxImportSource npm:hono/jsx */
import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";

function App() {
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleUrl = async () => {
      const url = new URL(window.location.href);
      const path = url.pathname.slice(1); // Remove leading '/'

      if (path.startsWith("web+gen:")) {
        const urlParts = path.slice("web+gen://".length).split('/');
        const agent = urlParts[0];
        const query = urlParts.slice(1).join(' ');

        const response = await fetch(`/api/generate?agent=${agent}&query=${query}`);

        if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();

          const read = async () => {
            const { done, value } = await reader.read();
            if (done) {
              setIsLoading(false);
              return;
            }
            setContent((prev) => prev + decoder.decode(value));
            read();
          };
          read();
        } else {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };

    handleUrl();
  }, []);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (content) {
    return <div dangerouslySetInnerHTML={{ __html: content }} />;
  }

  return (
    <div>
      <h1>Welcome to Gen Web</h1>
      <p>Use a <code>web+gen://</code> URL to generate a site.</p>
    </div>
  );
}

const container = document.getElementById("root");
const root = createRoot(container!);
root.render(<App />);
