// @ts-nocheck
import { useCallback, useEffect, useState } from "react";
import { api, isLoggedIn } from "./api";

/** 讀取伺服器上的玩家檔案（各遊戲模式頁面共用） */
export function useProfile() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    if (!isLoggedIn()) {
      setLoading(false);
      return Promise.resolve();
    }
    setLoading(true);
    return api("/api/profile")
      .then((d) => {
        setData(d);
        setErr(null);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    data,
    profile: data?.profile || null,
    loading,
    err,
    reload,
    setProfile: (p) => setData((d) => ({ ...(d || {}), profile: p })),
  };
}
