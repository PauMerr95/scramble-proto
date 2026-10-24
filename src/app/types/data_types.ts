import { Avatar } from '../types/side_types';
import { Theme } from '../types/layout_types';

export interface UserInfo {
  id: number,
  name: string,
  avatar: Avatar,
  theme: Theme,
  apiKey: string | null,
  lastSessionPath: string | null,
  createdAt: string,
  updatedAt: string,
}
export function defaultUserInfo(): UserInfo {
  const now = new Date();
  return {
    id: 0,
    name: "Test User",
    avatar: "Sheep",
    theme: "DarkLime",
    apiKey: null,
    lastSessionPath: null,
    createdAt: now.toISOString(),
    updatedAt: new Date(now).toISOString(),
  }
}

