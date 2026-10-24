import { avatars, MoveGrid } from "../types/side_types";

export const modalAvatarGrid: MoveGrid = 
    Array.from({length: Math.ceil(avatars.length/6)},
        (_, idx) => {
            return avatars.slice(idx*6, (idx+1)*6);
        });