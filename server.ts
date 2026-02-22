import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Mock Stripe Checkout Session
  app.post("/api/create-checkout-session", (req, res) => {
    const { ticketId, amount, ticketTitle } = req.body;
    
    // In a real app, you'd use the Stripe SDK here
    // For this demo, we'll return a mock URL that redirects back to our app with success params
    const baseUrl = process.env.APP_URL || `http://localhost:${PORT}`;
    const mockSessionUrl = `${baseUrl}/?payment_success=true&ticket_id=${ticketId}&session_id=mock_session_${Date.now()}`;
    
    res.json({ url: mockSessionUrl });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
