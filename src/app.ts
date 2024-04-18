import express from "express";
import cors from "cors";
import morgan from "morgan";
import signale from "signale";
import WebSocket from "ws";
import "dotenv/config";
import mongoose from "mongoose";
import http from "http";

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

import { Posts } from "./models/publicationSchema";

const pendingRequests = new Map();
const connections = new Map();
let ids = [];

type Kit = {
    _id: string | object,
    nickname?: string,
    imageUrl: string[]
}

class IUser {
    constructor(
        readonly _id: string | object,
        readonly nickname: string,
        readonly password: string,
        readonly kits: Kit[]
    ){}
}

class PageFetch {
    constructor(
        readonly id: string | object
    ){}
}

wss.on('connection', async (ws) => {
    let currentUserId: string | object;


    ws.on('message', async (rawData: any) => {
        try{
            const data = JSON.parse(rawData);
            console.log(data);
            signale.warn("Recibido => " + rawData);

            if(data instanceof PageFetch) {
                connections.set(currentUserId, ws);
            }
    
            if(data instanceof IUser) {
                const newPost = {
                    imageUrl: data.kits[0].imageUrl,
                    title: 'Imagen generada con KIT: ' + JSON.stringify(data.kits[0]._id),
                    content: ("Fecha: " + new Date().toLocaleDateString('es-MX')),
                    _idUser: data._id,
                    likes: 0,
                    laughs: 0
                }
                await new Posts(newPost).save();
    
                connections.forEach((client, clientId) => {
                    if(client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            update: true,
                            message: "Se ha actualizado la base de datos"
                        }));
                    }
                });
            }
        } catch (error) {
            signale.error(new Error("Error al procesar el mensaje para los clientes (WS):"));
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