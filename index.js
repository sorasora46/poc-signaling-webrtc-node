import { WebSocketServer } from "ws";
import { MongoClient } from "mongodb";
import { ObjectId } from "mongodb";

const PORT = 8070;
const HOST = "localhost";
const URI = "mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+2.3.1";

const wss = new WebSocketServer({ host: HOST, port: PORT });
const dbClient = new MongoClient(URI);
const db = dbClient.db("stream_blender");

// TYPE
const OFFER = "offer";
const ANSWER = "answer";
const OFFER_CANDIDATE = "offerCandidate";
const ANSWER_CANDIDATE = "answerCandidate";
const CREATE = "create"; // create room

// TYPE
const CAMERA = "camera";
const SWITCHER = "switcher";

/** Example payload
 * message = {
 *  type: <TYPE>,
 *  callId: <callId>
 *  sessionId: <sessionId>
 *  sdp: <SDP>
 * }
 * 
 * message = {
 *  type: <offer_candidate | answer_candidate>,
 *  callId: <callId>
 *  sessionId: <sessionId>
 *  candidate: <candidate object>
 * }
 */

const connections = [];

wss.on("connection", ws => {
    ws.on("error", console.error);

    ws.on("message", async data => {
        const message = JSON.parse(data);

        switch (message.type) {
            case CREATE:
                console.log("create called:", message);
                await handleCreateRequest(ws); // pass ws to save connection
                break;
            case OFFER:
                console.log("offer called:", message);
                await handleOfferRequest(message, ws); // pass ws to save connection
                break;
            case ANSWER:
                console.log("answer called:", message);
                await handleAnswerRequest(message);
                break;
            case ANSWER_CANDIDATE:
                console.log("answer_candidate called:", message);
                await handleAnswerCandidateRequest(message);
                break;
            case OFFER_CANDIDATE:
                console.log("offer_candidate called:", message);
                await handleOfferCandidateRequest(message);
                break;
            default:
                console.error("type unknown:", message);
        }
    });
});

// switcher is always a receiver => always send answer SDP

const handleCreateRequest = async (ws) => {
    const sessions = db.collection("sessions");

    const sessResult = await sessions.insertOne({});
    const sessionId = sessResult.insertedId.toHexString();

    // save connection, so camera can use and send offer sdp/candidate
    connections.push({
        sessionId: sessionId,
        connection: ws,
        role: SWITCHER
    });

    const response = {
        type: "createResponse",
        sessionId: sessionId
    };
    ws.send(JSON.stringify(response))
};

const handleOfferRequest = async (request, ws) => {
    const calls = db.collection("calls");

    const sessionId = request.sessionId;
    const offer = {
        type: request.type,
        sdp: request.sdp,
        sessionId: sessionId
    };

    // TODO: save SDP offer to MongoDB
    const result = await calls.insertOne(offer);
    const callId = result.insertedId.toHexString();

    // MAYBE: save new call's id to sessions collection

    // save connection, so switcher can use and send answer sdp/candidate
    connections.push({
        sessionId: sessionId,
        callId: callId,
        connection: ws,
        role: CAMERA
    });

    // TODO: send SDP offer to switcher
    const switcher = connections.find(conn =>
        conn.sessionId == sessionId && conn.role == SWITCHER);
    switcher.connection.send(JSON.stringify({ ...offer, callId: callId }));
};

const handleAnswerRequest = async (request) => {
    const calls = db.collection("calls");

    const callId = request.callId;
    const sessionId = request.sessionId;
    const answer = {
        type: request.type,
        sdp: request.sdp,
        sessionId: sessionId,
        callId: callId
    };

    // TODO: save SDP answer to MongoDB
    await calls.updateOne(
        { _id: ObjectId.createFromHexString(callId) },
        {
            $set: {
                answer: answer
            }
        }
    );

    // TODO: send SDP answer to camera
    const camera = connections.find(conn =>
        conn.sessionId == sessionId && conn.callId == callId && conn.role == CAMERA);
    console.log('called')
    camera.connection.send(JSON.stringify(answer));
};

const handleOfferCandidateRequest = async (request) => {
    // TODO: save candidate to MongoDB
    const type = request.type;
    const candidate = request.candidate;
    const callId = request.callId;
    const sessionId = request.sessionId;

    const data = {
        sessionId: sessionId,
        callId: callId,
        type: type,
        candidate: candidate
    };

    const query = {
        callId: callId,
        sessionId: sessionId
    };

    const offerCandidates = db.collection("offerCandidates");
    await offerCandidates.insertOne(data);

    // const result = await offerCandidates.find(query).toArray();

    const switcher = connections.find(conn =>
        conn.sessionId == sessionId && conn.role == SWITCHER);
    switcher.connection.send(JSON.stringify(data));
};

const handleAnswerCandidateRequest = async (request) => {
    // TODO: save candidate to MongoDB
    const type = request.type;
    const candidate = request.candidate;
    const callId = request.callId;
    const sessionId = request.sessionId;

    const data = {
        sessionId: sessionId,
        callId: callId,
        type: type,
        candidate: candidate
    };

    const query = {
        callId: callId,
        sessionId: sessionId
    };

    const answerCandidates = db.collection("answerCandidates");
    await answerCandidates.insertOne(data);

    // const result = await answerCandidates.find(query).toArray();

    const camera = connections.find(conn =>
        conn.sessionId == sessionId && conn.callId == callId && conn.role == CAMERA);
    camera.connection.send(JSON.stringify(data));
};
