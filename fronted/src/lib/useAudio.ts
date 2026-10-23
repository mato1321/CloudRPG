// @ts-nocheck
import { useEffect, useState } from "react";
import { audio } from "./audio";

/** 目前的音訊設定（靜音、音量），任何地方改了都會同步更新 */
export function useAudioSettings() {
  const [s, setS] = useState({ ...audio.settings });
  useEffect(() => {
    setS({ ...audio.settings });
    return audio.subscribe(setS);
  }, []);
  return s;
}

/** 進入頁面時播放指定的背景音樂；離開頁面時停止 */
export function useTheme(name: string | null) {
  useEffect(() => {
    audio.playTheme(name);
  }, [name]);
  useEffect(() => () => audio.stopMusic(), []);
}
