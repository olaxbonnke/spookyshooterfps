import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Check, Copy, Crosshair, Play, Shield, Skull, Sparkles, User, Users, Zap } from "lucide-react";
import { ARENAS, type MapId } from "@/game/arenas";

const homeSearch = z.object({
  map: z.enum(["grass", "brick", "palace"]).catch("grass"),
  room: z
    .string()
    .regex(/^[a-z0-9]{4}$/)
    .optional()
    .catch(undefined),
});

export const Route = createFileRoute("/")({
  validateSearch: homeSearch,
  component: Home,
});

function roomCode() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

function savedName() {
  if (typeof window === "undefined") return "Ranger";
  return localStorage.getItem("spooky-name") || "Ranger";
}

function mapDetails(id: MapId) {
  switch (id) {
    case "grass":
      return { tag: "Sector Alpha", difficulty: "Moderate", size: "15x15", hostiles: 8 };
    case "brick":
      return { tag: "Bastion Zone", difficulty: "High", size: "17x15", hostiles: 10 };
    case "palace":
      return { tag: "Ancient Crypt", difficulty: "Nightmare", size: "15x17", hostiles: 12 };
  }
}

function Home() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [name, setName] = useState(savedName);
  const [map, setMap] = useState<MapId>(search.map);
  const [friends, setFriends] = useState(Boolean(search.room));
  const [room, setRoom] = useState(search.room ?? "");
  const [copied, setCopied] = useState(false);

  const pickMap = (id: MapId) => {
    setMap(id);
    void navigate({ to: "/", search: { map: id, room: friends && room ? room : undefined }, replace: true });
  };

  const enableFriends = () => {
    const code = room || roomCode();
    setFriends(true);
    setRoom(code);
    void navigate({ to: "/", search: { map, room: code }, replace: true });
  };

  const playAlone = () => {
    setFriends(false);
    void navigate({ to: "/", search: { map }, replace: true });
  };

  const useCode = (raw: string) => {
    const code = raw.trim().toLowerCase();
    setRoom(code);
    if (!/^[a-z0-9]{4}$/.test(code)) return;
    setFriends(true);
    void navigate({ to: "/", search: { map, room: code }, replace: true });
  };

  const copyLink = () => {
    const code = /^[a-z0-9]{4}$/.test(room) ? room : roomCode();
    setRoom(code);
    setFriends(true);
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("map", map);
    url.searchParams.set("room", code);
    window.history.replaceState({}, "", url);
    void navigator.clipboard
      ?.writeText(url.toString())
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2400);
      })
      .catch(() => setCopied(false));
  };

  const start = () => {
    const nextName = name.trim().slice(0, 16) || "Ranger";
    try {
      localStorage.setItem("spooky-name", nextName);
    } catch {
      /* ignore */
    }
    const code = friends && /^[a-z0-9]{4}$/.test(room) ? room : undefined;
    void navigate({ to: "/play", search: { map, name: nextName, room: code } });
  };

  return (
    <main className="home">
      <div className="ambient-grid" />
      <div className="home-wrap">
        <header className="home-header">
          <div className="hero-badge">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Tactical Horror FPS • v2.0</span>
          </div>
          <h1>Spooky Labyrinth</h1>
          <p className="lede">
            Infiltrate procedurally generated dark labyrinths. Hunt roaming apparitions, utilize barricades for cover, and clear the sector alone or with co-op squadmates in real-time.
          </p>
        </header>

        {/* Operative Callsign */}
        <section className="home-block" aria-labelledby="options-title">
          <div className="home-block-header">
            <h2 id="options-title">
              <User />
              Operative Profile
            </h2>
            <span className="text-xs font-mono text-[var(--color-subtle)] uppercase">Callsign</span>
          </div>
          <label className="field-label" htmlFor="player-callsign">
            Display Name
          </label>
          <input
            id="player-callsign"
            className="field font-semibold"
            value={name}
            maxLength={16}
            placeholder="e.g. Ghost, Hunter, Ranger"
            onChange={(e) => setName(e.target.value)}
          />
        </section>

        {/* Labyrinth Map Selector */}
        <section className="home-block" aria-labelledby="map-title">
          <div className="home-block-header">
            <h2 id="map-title">
              <Shield />
              Target Sector
            </h2>
            <span className="text-xs font-mono text-[var(--color-primary)] font-bold tracking-wider">
              {ARENAS.find((a) => a.id === map)?.name.toUpperCase()} SELECTED
            </span>
          </div>
          <div className="maps">
            {ARENAS.map((arena) => {
              const info = mapDetails(arena.id);
              const isSelected = map === arena.id;
              return (
                <button
                  key={arena.id}
                  type="button"
                  data-map={arena.id}
                  className={isSelected ? "map-card on" : "map-card"}
                  onClick={() => pickMap(arena.id)}
                >
                  <span className="swatch" aria-hidden="true">
                    <Crosshair className="w-5 h-5 text-white/80" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <strong>{arena.name}</strong>
                      <span className="text-xs font-mono font-bold text-[var(--color-muted)]">{info.tag}</span>
                    </div>
                    <small>{arena.line}</small>
                    <div className="map-tags">
                      <span className="map-tag">{info.size} Grid</span>
                      <span className="map-tag">{info.difficulty}</span>
                      <span className="map-tag flex items-center gap-1">
                        <Skull className="w-3 h-3 text-[var(--color-primary)]" /> ~{info.hostiles} Foes
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Squad & Deployment Mode */}
        <section className="home-block" aria-labelledby="friends-title">
          <div className="home-block-header">
            <h2 id="friends-title">
              <Users />
              Infiltration Mode
            </h2>
            <span className="text-xs font-mono text-[var(--color-subtle)] uppercase">
              {friends ? "WebRTC Mesh Active" : "Solo Operation"}
            </span>
          </div>
          <div className="seg">
            <button type="button" className={friends ? "seg-btn" : "seg-btn on"} onClick={playAlone}>
              <User className="w-4 h-4" />
              Solo Infiltration
            </button>
            <button type="button" className={friends ? "seg-btn on" : "seg-btn"} onClick={enableFriends}>
              <Users className="w-4 h-4" />
              Co-op Squad
            </button>
          </div>
          {friends ? (
            <div className="mt-4 pt-4 border-t border-white/5">
              <p className="code-line">
                Active Room Frequency: <strong>{/^[a-z0-9]{4}$/.test(room) ? room : "----"}</strong>
              </p>
              <p className="home-note">
                Share your invite link with friends. Teammates connect peer-to-peer via WebRTC and appear in blue tactical armor.
              </p>
              <div className="join-row">
                <input
                  className="field"
                  value={room}
                  placeholder="CODE"
                  maxLength={4}
                  onChange={(e) => setRoom(e.target.value.toLowerCase())}
                  onBlur={(e) => useCode(e.target.value)}
                />
                <button type="button" className="btn btn-ghost" onClick={() => useCode(room)}>
                  Connect
                </button>
              </div>
              <button type="button" className="btn btn-ghost home-gap" onClick={copyLink}>
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" /> Link Copied to Clipboard
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> Copy Squad Invite Link
                  </>
                )}
              </button>
            </div>
          ) : (
            <p className="home-note mt-3">
              Lone wolf operation. Eliminate every phantom roaming the corridors to survive and cleanse the labyrinth.
            </p>
          )}
        </section>

        {/* Controls Briefing */}
        <section className="home-block" aria-labelledby="controls-title">
          <div className="home-block-header">
            <h2 id="controls-title">
              <Zap />
              Combat Controls
            </h2>
            <span className="text-xs font-mono text-[var(--color-subtle)]">DESKTOP / MOBILE</span>
          </div>
          <ul className="keys">
            <li>
              <span>WASD</span> Movement
            </li>
            <li>
              <span>MOUSE</span> Aim / Look
            </li>
            <li>
              <span>CLICK</span> Fire Shotgun
            </li>
            <li>
              <span>SHIFT</span> Tactical Sprint
            </li>
            <li>
              <span>ESC</span> Pause Menu
            </li>
          </ul>
          <p className="home-note mt-3">
            On touchscreens: drag the left thumbstick to walk, swipe the right screen area to aim, and tap the Fire trigger.
          </p>
        </section>

        {/* Deploy Action */}
        <div className="home-start">
          <button type="button" className="btn" onClick={start}>
            <Play className="w-5 h-5 fill-current" />
            Deploy To Labyrinth
          </button>
        </div>
      </div>
    </main>
  );
}
