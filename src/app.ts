import express from "express";
import cors from "cors";
import morgan from "morgan";
import signale from "signale";
import WebSocket from "ws";
import "dotenv/config";
import mongoose from "mongoose";
import http from "http";
import { Posts } from "./models/publicationSchema";

const app = express();
const uri = process.env.MONGODB_URI!;
const server = http.createServer(app);
const port = process.env.PORT
const wss = new WebSocket.Server({ noServer: true });

signale.warn("Conectando a MongoDB...");
mongoose.connect(uri);

const db = mongoose.connection;
db.on('error', (error) => {
    signale.fatal(new Error("Error de conexión a la base de datos: " + error));
});

db.once('open', () => {
    signale.success("Conexión exitosa a la base de datos MongoDB");
});

app.use(express.json());
app.use(cors());
app.use(morgan("dev"));

const pendingRequests = new Map();
const connections = new Map();

wss.on('connection', async (ws) => {
    let currentUserId: string | object;

    ws.on('message', async (rawData: any) => {
        try{
            const data = JSON.parse(rawData);
            signale.warn("Recibido => " + rawData);

            if (data._id && data.kit) {
                const newPost = {
                    imageUrl: data.kit.imageUrl,
                    title: 'Imagen generada con KIT: ' + JSON.stringify(data.kit.id),
                    content: ("Fecha: " + new Date().toLocaleDateString('es-MX')),
                    _idUser: data._id,
                    likes: 0,
                    laughs: 0
                }
                const objectCreated = await (new Posts(newPost).save());
                connections.forEach((client, clientId) => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            _id: objectCreated._id,
                            imageUrl: objectCreated.imageUrl,
                            title: objectCreated.title,
                            content: objectCreated.content,
                            _idUser: objectCreated._idUser,
                            likes: 0,
                            laughs: 0
                        }));
                    }
                });

            } else if (data._id && data.distance && data.id) {
                connections.forEach((client, clientId) => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            id: data.id,
                            distance: data.distance
                        }));
                    }
                });

            } else if(data.idKit && data.distance) {
                const objectToSend = {
                    idKit: data.idKit,
                    distance: data.distance
                }
                pendingRequests.set(data.idKit, objectToSend);
                connections.forEach((client, clientId) => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(objectToSend));
                    }
                });
            } else if (data._id) {
                currentUserId = data._id;
                connections.set(currentUserId, ws);
                signale.info("Conección guardada => " + JSON.stringify(currentUserId));

            }
        } catch (error) {
            signale.error(new Error("Error al procesar el mensaje para los clientes (WS):"));
            console.log(error);
        }
    });

    ws.on('close', () => {
        if(currentUserId) {            
            console.log(currentUserId);
            console.log(pendingRequests);
            connections.delete(currentUserId);
        }
    });
});

server.listen(port, () => {
    signale.success(`Servidor iniciado en el puerto ${port}`);
});

server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
})
