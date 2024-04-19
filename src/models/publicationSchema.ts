import { model, Schema, Types } from "mongoose";
export class Post {
    constructor(
        readonly imageUrl: string,
        readonly title: string,
        readonly content: string,
        readonly likes: number,
        readonly laughs: number,
        readonly _idUser: Object,
        readonly _id?: Object
    ){}
}

const postSchema = new Schema<Post>({
    _idUser: {type: Types.ObjectId, required: true, ref: "Users"},
    content: {type: String, required: true},
    imageUrl: {type: String, required: true},
    title: {type: String, required: true},
    likes: {type: Number, required: true},
    laughs: {type: Number, required: true}
});

export const Posts = model<Post>("Post", postSchema);