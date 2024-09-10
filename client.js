import WebSocket from "ws";

const PORT = 8070;
const HOST = "localhost";
const URL = `ws://${HOST}:${PORT}`;

const ws = new WebSocket(URL);

const message = {
    type: "answer",
    sdp: "hi",
    sessionId: "66dfd2eeb4867116b987c042",
    callId: "66dfd2eeb4867116b987c041"
};

ws.on('error', console.error);

ws.on('open', function open() {
    ws.send(JSON.stringify(message));
    // setInterval(() => {
    //     ws.send(JSON.stringify(message));
    //     console.log("sending message:", message);
    // }, 1000);
});

ws.on('message', function message(data) {
    const received = JSON.parse(data);
    console.log('received:', received);
});