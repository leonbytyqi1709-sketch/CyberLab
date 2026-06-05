import { useEffect, useRef } from "react";
import type { Device, LogRow } from "../lib/api";

/* ── akustische Signale via Web Audio ───────────────────────────────── */
let audioCtx: AudioContext | null = null;
function tones(seq: { f: number; t: number; d: number }[]) {
  try {
    audioCtx =
      audioCtx ?? new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioCtx;
    for (const s of seq) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = s.f;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + s.t);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + s.t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + s.t + s.d);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + s.t);
      osc.stop(ctx.currentTime + s.t + s.d + 0.02);
    }
  } catch {
    /* Audio nicht verfügbar */
  }
}
const alarmSound = () =>
  tones([
    { f: 660, t: 0, d: 0.18 },
    { f: 440, t: 0.2, d: 0.28 },
  ]);
const successSound = () =>
  tones([
    { f: 523, t: 0, d: 0.12 },
    { f: 659, t: 0.12, d: 0.12 },
    { f: 784, t: 0.24, d: 0.22 },
  ]);

function notify(title: string, body: string) {
  try {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") new Notification(title, { body });
    else if (Notification.permission !== "denied")
      Notification.requestPermission().then((p) => {
        if (p === "granted") new Notification(title, { body });
      });
  } catch {
    /* ignore */
  }
}

/**
 * Akustische/Desktop-Benachrichtigungen für Storage-Ereignisse:
 *  - neuer ZFS-Disk-Ausfall (P1)  → Alarm-Ton + Notification.
 *  - Resilvering abgeschlossen     → Erfolgs-Ton + Notification.
 * Nur im aktiven Tab, um Hintergrund-Lärm zu vermeiden.
 */
export function useStorageAlerts(devices: Device[], logs: LogRow[], enabled: boolean) {
  const seenZfs = useRef<Set<string>>(new Set());
  const primed = useRef(false);
  const wasResilvering = useRef(false);

  useEffect(() => {
    // Erster Durchlauf: vorhandene Alarme „kennen", ohne zu tönen.
    const zfsLogs = logs.filter(
      (l) => l.kind === "zfs" && l.priority === "P1" && l.status !== "RESOLVED",
    );
    if (!primed.current) {
      zfsLogs.forEach((l) => seenZfs.current.add(l.id));
      wasResilvering.current = devices.some((d) =>
        (d.details?.disks ?? []).some((x) => x.state === "RESILVERING"),
      );
      primed.current = true;
      return;
    }
    if (!enabled) return;

    for (const l of zfsLogs) {
      if (!seenZfs.current.has(l.id)) {
        seenZfs.current.add(l.id);
        alarmSound();
        notify("⚠ ZFS Disk-Ausfall", `${l.device_name}: ${l.title}`);
      }
    }

    const anyResilver = devices.some((d) =>
      (d.details?.disks ?? []).some((x) => x.state === "RESILVERING"),
    );
    if (wasResilvering.current && !anyResilver) {
      successSound();
      notify("✓ Resilvering abgeschlossen", "ZFS-Pool wieder ONLINE.");
    }
    wasResilvering.current = anyResilver;
  }, [devices, logs, enabled]);
}
