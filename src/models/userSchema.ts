import { Schema, model } from "mongoose";

class Kit {
    constructor(
        readonly id: string,
        readonly nickname?: string,
        readonly imagesUrl?: string[]
    ){}
}
class User {
    constructor(
        readonly nickname: string,
        readonly password: string,
        readonly kits?: Kit[]
    ){}
}

interface IKit{
    id: string,
    nickname?: string,
    imagesUrl?: string[]
}

const KitSchema = new Schema<IKit>({
    id: { type: String, required: true },
    nickname: { type: String, required: false },
    imagesUrl: { type: [String], required: false },
})

const UserSchema = new Schema<User>({
    nickname: { type: String, required: true },
    password: { type: String, required: true },
    kits: [KitSchema]
});

export const Users = model<User>("User", UserSchema);