import { WebSocketServer } from "ws";
const wss = new WebSocketServer({ port: 8787 });
wss.on("connection", (socket) => {
  socket.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === "hello") {
      console.log("HELLO:", msg.clientId.slice(0, 8), msg.capabilities.runtime);
    }
  });
});
console.log("dbg coordinator on 8787");
