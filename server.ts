import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";

// Vercel Edge Runtime Config removed

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // Real-time Game State
  const worldState = {
    "Nhân Giới": { globalEvent: "Thanh Bình", bossAlive: false, bossHp: 0 },
    "Yêu Giới": { globalEvent: "Linh Khí Triều Tịch", bossAlive: true, bossHp: 1000000 },
    "Ma Giới": { globalEvent: "Huyết Nguyệt", bossAlive: true, bossHp: 2000000 },
    "Minh Giới": { globalEvent: "U Minh Lộ", bossAlive: false, bossHp: 0 },
    "Tiên Giới": { globalEvent: "Tiên Khí Quán Đỉnh", bossAlive: false, bossHp: 0 },
    "Thần Vực": { globalEvent: "Thần Kiếp", bossAlive: false, bossHp: 0 }
  };

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("join_realm", (realm) => {
      socket.join(realm);
      socket.emit("world_update", worldState[realm]);
    });

    socket.on("player_action", (data) => {
      // Broadcast actions for real-time visibility
      socket.to(data.realm).emit("realm_event", data);
    });

    socket.on("chat_message", (data) => {
      io.to(data.realm).emit("chat_broadcast", data);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  // API routes
  app.use(express.json());

  // Simple In-Memory Cache
  const aiCache = new Map<string, { data: any, timestamp: number }>();
  const CACHE_TTL = 300 * 1000; // 5 minutes

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
