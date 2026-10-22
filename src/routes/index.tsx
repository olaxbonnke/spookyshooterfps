import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
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
  if (typeof window === "undefined") return "You";
  return localStorage.getItem("spooky-name") || "You";
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
    void navigator.clipboard?.writeText(url.toString()).then(() => setCopied(true)).catch(() => setCopied(false));
  };

  const start = () => {
    const nextName = name.trim().slice(0, 16) || "You";
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
      <div className="home-wrap">
        <p className="kicker">FPS shooter</p>
        <h1>Spooky Labyrinth</h1>
        <p className="lede">Pick a labyrinth, go in alone or with friends, then start. Leaving a match brings you back here.</p>

        <section className="home-block" aria-labelledby="options-title">
          <h2 id="options-title">Options</h2>
          <label className="field-label">
            Name
            <input className="field" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} />
          </label>
        </section>

        <section className="home-block" aria-labelledby="map-title">
          <h2 id="map-title">Labyrinth</h2>
          <div className="maps">
            {ARENAS.map((arena) => (
              <button
                key={arena.id}
                type="button"
                data-map={arena.id}
                className={map === arena.id ? "map-card on" : "map-card"}
                onClick={() => pickMap(arena.id)}
              >
                <span className="swatch" aria-hidden="true" />
                <span>
                  <strong>{arena.name}</strong>
                  <small>{arena.line}</small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="home-block" aria-labelledby="friends-title">
          <h2 id="friends-title">Friends</h2>
          <div className="seg">
            <button type="button" className={friends ? "seg-btn" : "seg-btn on"} onClick={playAlone}>
              Alone
            </button>
            <button type="button" className={friends ? "seg-btn on" : "seg-btn"} onClick={enableFriends}>
              With friends
            </button>
          </div>
          {friends ? (
            <>
              <p className="code-line">
                Room <strong>{/^[a-z0-9]{4}$/.test(room) ? room : "----"}</strong>
              </p>
              <p className="home-note">Send the link. They land here, press Start, and show up in blue.</p>
              <div className="join-row">
                <input
                  className="field"
                  value={room}
                  placeholder="Code"
                  maxLength={4}
                  onChange={(e) => setRoom(e.target.value.toLowerCase())}
                  onBlur={(e) => useCode(e.target.value)}
                />
                <button type="button" className="btn btn-ghost" onClick={() => useCode(room)}>
                  Use code
                </button>
              </div>
              <button type="button" className="btn btn-ghost home-gap" onClick={copyLink}>
                {copied ? "Link copied" : "Copy invite link"}
              </button>
            </>
          ) : (
            <p className="home-note">Just you and the figures in the maze.</p>
          )}
        </section>

        <section className="home-block" aria-labelledby="controls-title">
          <h2 id="controls-title">Controls</h2>
          <ul className="keys">
            <li>
              <span>WASD</span> Move
            </li>
            <li>
              <span>Mouse</span> Aim
            </li>
            <li>
              <span>Click</span> Fire
            </li>
            <li>
              <span>Shift</span> Run
            </li>
          </ul>
          <p className="home-note">On a phone, the left circle walks, dragging the picture aims, and Fire shoots.</p>
        </section>

        <div className="home-start">
          <button type="button" className="btn" onClick={start}>
            Start game
          </button>
        </div>
      </div>
    </main>
  );
}
