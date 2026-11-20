"use client";

import { useEffect, useState } from "react";

type Msg = { text: string; href?: string };
let listeners: ((msg: Msg) => void)[] = [];
export function toast(text: string, href?: string) {
  listeners.forEach((l) => l({ text, href }));
}

export function ToastHost() {
  const [msg, setMsg] = useState<Msg | null>(null);
  useEffect(() => {
    let timer: any;
    const l = (m: Msg) => {
      setMsg(m);
      clearTimeout(timer);
      timer = setTimeout(() => setMsg(null), m.href ? 6000 : 1800);
    };
    listeners.push(l);
    return () => {
      listeners = listeners.filter((x) => x !== l);
      clearTimeout(timer);
    };
  }, []);
  if (!msg) return null;
  return (
    <div className="toast">
      {msg.href ? (
        <a href={msg.href} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
          {msg.text} ↗
        </a>
      ) : (
        msg.text
      )}
    </div>
  );
}
