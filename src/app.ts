import express from "express";
import cors from "cors";
import morgan from "morgan";
import signale from "signale";
import WebSocket from "ws";
import "dotenv/config";
import mongoose from "mongoose";
import http from "http";
import { Post, Posts } from "./models/publicationSchema";

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
            let object;

            if(!data.kit && !data.distance){
                object = {
                    _id: data._id
                };
            }

            else if(!data.kit && data.distance){
                object = {
                    distance: data.distance
                };
            }

            else if(data.kit && !data.distance){
                object = {
                    kit: {
                        id: data.kit.id
                    }
                };
            }

            else if(data._id && data.kit && data.message){
                object = {
                    _id: data._id,
                    kit: data.kit,
                    message: data.message
                }
            }

            else{
                object = {
                    _id: data._id,
                    kit: data.kit
                };
            }

            if(object.hasOwnProperty('_id') && object.hasOwnProperty('kit') && object.hasOwnProperty('message')) {
                const request = {
                    _id: object._id,
                    kit: object.kit,
                    message: object.message
                }
                
                connections.forEach((client, clientId) => {
                    if(client.readyState === WebSocket.OPEN) {
                        console.log(request);
                        client.send(JSON.stringify(request));
                    }
                })
            }

            else if(object.hasOwnProperty('_id') && object.hasOwnProperty('kit')) {
                let objectCreated: Post;
                const newPost = {
                    imageUrl: object.kit.imageUrl,
                    title: 'Imagen generada con KIT: ' + JSON.stringify(object.kit.id),
                    content: ("Fecha: " + new Date().toLocaleDateString('es-MX')),
                    _idUser: object._id,
                    likes: 0,
                    laughs: 0
                }
                if(newPost){
                    signale.info("Enviando => " + JSON.stringify(newPost));
                    const object = new Posts(newPost);
                    await object.save()
                    objectCreated = {
                        _id: object._id,
                        imageUrl: object.imageUrl,
                        title: object.title,
                        content: object.content,
                        _idUser: object._idUser,
                        likes: 0,
                        laughs: 0
                    };
                }
    
                connections.forEach((client, clientId) => {
                    if(client.readyState === WebSocket.OPEN) {                        
                        client.send(JSON.stringify(objectCreated));
                        signale.success("Enviado a los clientes");
                    }
                });                
            }

            else if(object.hasOwnProperty('distance')) {
                const request = {
                    distance: object.distance
                }
                
                connections.forEach((client, clientId) => {
                    if(client.readyState === WebSocket.OPEN) {
                        console.log(request);
                        client.send(JSON.stringify(request));
                    }
                })
            }
    
            else if(object.hasOwnProperty('_id')) {
                currentUserId = object._id;
                connections.set(currentUserId, ws);
                if (currentUserId instanceof Object){
                    signale.info("Conección guardada [Object] => " + JSON.stringify(currentUserId));
                } else{
                    signale.info("Conección guardada => " + currentUserId);
                }
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
