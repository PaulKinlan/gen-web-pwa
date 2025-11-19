/** @jsxImportSource https://esm.sh/react@18.2.0 */
import React, { useState, useEffect } from "https://esm.sh/react@18.2.0";
import { createRoot } from "https://esm.sh/react-dom@18.2.0/client";

function App() {
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);
      // Show the install button
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

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

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    console.log(`User response to the install prompt: ${outcome}`);

    // Clear the deferredPrompt for reuse
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (content) {
    return (
      <div>
        {isInstallable && (
          <div className="fixed top-4 right-4 z-50">
            <button
              onClick={handleInstallClick}
              className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-lg transition-colors"
            >
              Install App
            </button>
          </div>
        )}
        <div dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-4xl font-bold mb-4">Welcome to Gen Web</h1>
      <p className="mb-4">Use a <code className="bg-gray-200 px-2 py-1 rounded">web+gen://</code> URL to generate a site.</p>
      <p className="mb-6">
        For example: <a href="web+gen://nike.com/plan-a-hike" className="text-blue-500 hover:underline">web+gen://nike.com/plan-a-hike</a>
      </p>

      {isInstallable && (
        <div className="mt-8 p-6 bg-blue-50 border-2 border-blue-200 rounded-lg">
          <h2 className="text-2xl font-semibold mb-2">Install Gen Web</h2>
          <p className="mb-4 text-gray-700">
            Install Gen Web as a Progressive Web App for a better experience. You'll be able to:
          </p>
          <ul className="list-disc list-inside mb-4 text-gray-700">
            <li>Access it directly from your home screen</li>
            <li>Use it offline</li>
            <li>Register it as a handler for <code className="bg-gray-200 px-1 rounded">web+gen://</code> URLs</li>
          </ul>
          <button
            onClick={handleInstallClick}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-colors"
          >
            Install Now
          </button>
        </div>
      )}

      {!isInstallable && (
        <div className="mt-8 p-6 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-gray-600">
            <strong>Note:</strong> This app can be installed as a PWA. The install option will appear when available on your device.
          </p>
        </div>
      )}
    </div>
  );
}

const container = document.getElementById("root");
const root = createRoot(container!);
root.render(<App />);
