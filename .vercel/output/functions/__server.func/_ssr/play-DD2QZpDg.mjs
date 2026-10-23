import { o as __toESM } from "../_runtime.mjs";
import { q as require_react, x as require_jsx_runtime, y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as Sparkles, c as RotateCcw, f as Copy, l as Play, n as Users, o as Skull, p as Check, s as Shield, u as Pause } from "../_libs/lucide-react.mjs";
import { n as Route$1 } from "./router-CvzV8hOG.mjs";
import { a as resolveMove, i as rayBoxes, n as arenaBoxes, r as findArena, t as ARENAS } from "./arenas-D5SE43Iz.mjs";
import { C as SphereGeometry, S as Scene, _ as Object3D, a as BufferGeometry, b as PointLight, c as DirectionalLight, d as HemisphereLight, f as InstancedMesh, g as MeshStandardMaterial, h as Mesh, i as BufferAttribute, l as Fog, m as LineBasicMaterial, n as AmbientLight, o as Color, p as Line, r as BoxGeometry, s as CylinderGeometry, t as WebGLRenderer, u as Group, v as PerspectiveCamera, x as SRGBColorSpace, y as PlaneGeometry } from "../_libs/three.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/play-DD2QZpDg.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function createSfx() {
	let ctx = null;
	function ac() {
		if (typeof AudioContext === "undefined") return null;
		if (!ctx) ctx = new AudioContext();
		if (ctx.state === "suspended") ctx.resume();
		return ctx;
	}
	function tone(freq, dur, type, gain, at = 0) {
		const a = ac();
		if (!a) return;
		const o = a.createOscillator();
		const g = a.createGain();
		const t = a.currentTime + at;
		o.type = type;
		o.frequency.setValueAtTime(freq, t);
		g.gain.setValueAtTime(1e-4, t);
		g.gain.exponentialRampToValueAtTime(gain, t + .015);
		g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
		o.connect(g);
		g.connect(a.destination);
		o.start(t);
		o.stop(t + dur + .02);
	}
	return {
		unlock() {
			try {
				ac();
			} catch {
				ctx = null;
			}
		},
		step() {
			tone(78 + Math.random() * 26, .05, "sine", .025);
		},
		pickup() {
			const a = ac();
			if (!a) return;
			const o = a.createOscillator();
			const g = a.createGain();
			const t = a.currentTime;
			o.type = "triangle";
			o.frequency.setValueAtTime(480, t);
			o.frequency.exponentialRampToValueAtTime(860, t + .09);
			g.gain.setValueAtTime(1e-4, t);
			g.gain.exponentialRampToValueAtTime(.07, t + .02);
			g.gain.exponentialRampToValueAtTime(1e-4, t + .16);
			o.connect(g);
			g.connect(a.destination);
			o.start(t);
			o.stop(t + .18);
		},
		gate() {
			tone(392, .22, "sine", .04);
			tone(523, .28, "sine", .03, .08);
		},
		boo() {
			tone(340, .16, "sine", .05);
			tone(168, .42, "triangle", .045, .06);
		},
		moan() {
			tone(150, .32, "sine", .028);
			tone(96, .46, "triangle", .022, .08);
		},
		shot() {
			tone(180, .04, "square", .04);
			tone(90, .07, "sawtooth", .03, .01);
		},
		hit() {
			tone(520, .05, "square", .03);
			tone(240, .08, "triangle", .025, .02);
		},
		slash() {
			tone(240, .05, "sawtooth", .03);
			tone(130, .08, "triangle", .025, .02);
		},
		cut() {
			tone(620, .07, "square", .028);
			tone(180, .14, "sawtooth", .035, .02);
		},
		hurt() {
			tone(72, .26, "sawtooth", .055);
			tone(46, .38, "sine", .045, .04);
		},
		lose() {
			tone(220, .24, "triangle", .05);
			tone(146, .36, "sine", .04, .1);
			tone(92, .48, "sine", .035, .2);
		},
		win() {
			tone(523, .26, "sine", .05, 0);
			tone(659, .28, "sine", .05, .09);
			tone(784, .36, "sine", .045, .18);
		},
		dispose() {
			const c = ctx;
			ctx = null;
			if (c) c.close();
		}
	};
}
var FAST_POLL_MS = 400;
var IDLE_POLL_MS = 2e3;
var PING_INTERVAL_MS = 2e3;
var STALL_MS = 1e4;
var MAX_RECOVERY_ATTEMPTS = 3;
var SIGNAL_RETRY_DELAYS_MS = [250, 750];
function defaultIceServers() {
	return [{ urls: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"] }];
}
var P2PRoom = class {
	opts;
	peers = /* @__PURE__ */ new Map();
	/** Per-remote-peer signal delivery chains (order-preserving). */
	signalQueues = /* @__PURE__ */ new Map();
	cursor = 0;
	pollTimer = null;
	pingTimer = null;
	closed = false;
	everPolled = false;
	lastPeersFingerprint = "";
	constructor(opts) {
		this.opts = opts;
	}
	/**
	* The first poll IS the join: it registers this peer and returns the
	* roster. A failed first poll (cold DB, offline tab) must not strand the
	* room: the loop and timers start regardless and the next poll retries.
	*/
	async join() {
		try {
			await this.pollOnce();
		} catch {}
		if (this.closed) return;
		this.schedulePoll(this.anyPairConnecting() ? FAST_POLL_MS : IDLE_POLL_MS);
		this.pingTimer = setInterval(() => {
			this.pingAll();
			this.watchdog();
		}, PING_INTERVAL_MS);
	}
	close() {
		this.closed = true;
		if (this.pollTimer) clearTimeout(this.pollTimer);
		if (this.pingTimer) clearInterval(this.pingTimer);
		for (const slot of this.peers.values()) slot.pc.close();
		this.peers.clear();
		fetch("/api/rtc", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				op: "leave",
				room: this.opts.room,
				peer: this.opts.selfId
			}),
			keepalive: true
		}).catch(() => {});
	}
	/** Send on the unreliable game-state channel (drops stale packets). */
	broadcast(data) {
		const wire = JSON.stringify({
			t: "d",
			d: data
		});
		for (const slot of this.peers.values()) if (slot.state?.readyState === "open") slot.state.send(wire);
	}
	/** Send reliably (ordered) to one peer, or to all when peerId is omitted. */
	send(data, peerId) {
		const wire = JSON.stringify({
			t: "d",
			d: data
		});
		const targets = peerId ? [this.peers.get(peerId)] : [...this.peers.values()];
		for (const slot of targets) if (slot?.reliable?.readyState === "open") slot.reliable.send(wire);
	}
	peerList() {
		return [...this.peers.values()].map((s) => ({ ...s.info }));
	}
	schedulePoll(delay) {
		if (this.closed) return;
		if (this.pollTimer) clearTimeout(this.pollTimer);
		this.pollTimer = setTimeout(() => void this.poll(), delay);
	}
	anyPairConnecting() {
		for (const s of this.peers.values()) {
			if (s.terminal) continue;
			if (s.info.connectionState !== "connected") return true;
		}
		return false;
	}
	async pollOnce() {
		const params = new URLSearchParams({
			room: this.opts.room,
			peer: this.opts.selfId,
			name: this.opts.name ?? "",
			since: String(this.cursor)
		});
		const res = await fetch(`/api/rtc?${params}`);
		if (this.closed) return;
		if (!res.ok) throw new Error(`signaling poll failed: ${res.status}`);
		const body = await res.json();
		if (this.closed) return;
		if (!this.everPolled) {
			this.everPolled = true;
			this.opts.onConnected?.();
		}
		this.reconcileRoster(body.peers);
		const roster = new Set(body.peers.map((p) => p.id));
		for (const sig of body.signals) {
			this.cursor = Math.max(this.cursor, sig.id);
			await this.onSignal(sig.from, sig.kind, sig.payload, roster);
			if (this.closed) return;
		}
	}
	async poll() {
		if (this.closed) return;
		try {
			await this.pollOnce();
		} catch {}
		this.schedulePoll(this.anyPairConnecting() ? FAST_POLL_MS : IDLE_POLL_MS);
	}
	reconcileRoster(peers) {
		const alive = new Set(peers.map((p) => p.id));
		for (const p of peers) {
			if (p.id === this.opts.selfId) continue;
			const existing = this.peers.get(p.id);
			if (existing) existing.info.name = p.name;
			else this.connectTo(p.id, p.name, this.opts.selfId > p.id);
		}
		for (const [id, slot] of this.peers) if (!alive.has(id)) {
			slot.pc.close();
			this.peers.delete(id);
		}
		this.emitPeers();
	}
	connectTo(peerId, name, initiator) {
		if (this.closed) return null;
		const pc = new RTCPeerConnection({ iceServers: this.opts.iceServers ?? defaultIceServers() });
		const slot = {
			pc,
			makingOffer: false,
			ignoreOffer: false,
			pendingCandidates: [],
			lastProgressAt: Date.now(),
			recoveryAttempts: 0,
			info: {
				id: peerId,
				name,
				connectionState: pc.connectionState,
				candidateType: null,
				rttMs: null
			}
		};
		this.peers.set(peerId, slot);
		pc.onicecandidate = (e) => {
			if (e.candidate) this.sendSignal(peerId, "ice", e.candidate.toJSON());
		};
		pc.onconnectionstatechange = () => {
			slot.info.connectionState = pc.connectionState;
			if (pc.connectionState === "connecting" || pc.connectionState === "connected") slot.lastProgressAt = Date.now();
			if (pc.connectionState === "connected") {
				slot.recoveryAttempts = 0;
				slot.terminal = false;
				this.readCandidateType(slot);
			}
			this.emitPeers();
			if (pc.connectionState === "failed") pc.restartIce();
			if (pc.connectionState === "failed" || pc.connectionState === "disconnected") this.schedulePoll(FAST_POLL_MS);
		};
		pc.onnegotiationneeded = async () => {
			try {
				slot.makingOffer = true;
				await pc.setLocalDescription();
				await this.sendSignal(peerId, "offer", pc.localDescription.toJSON());
			} catch {} finally {
				slot.makingOffer = false;
			}
		};
		pc.ondatachannel = (e) => this.attachChannel(slot, e.channel);
		if (initiator) {
			this.attachChannel(slot, pc.createDataChannel("state", {
				ordered: false,
				maxRetransmits: 0
			}));
			this.attachChannel(slot, pc.createDataChannel("reliable", { ordered: true }));
		}
		return slot;
	}
	attachChannel(slot, channel) {
		if (channel.label === "state") slot.state = channel;
		else slot.reliable = channel;
		channel.onopen = () => {
			slot.lastProgressAt = Date.now();
		};
		channel.onmessage = (e) => {
			let msg;
			try {
				msg = JSON.parse(e.data);
			} catch {
				return;
			}
			if (msg.t === "ping") {
				if (slot.state?.readyState === "open") slot.state.send(JSON.stringify({ t: "pong" }));
			} else if (msg.t === "pong") {
				if (slot.pingSentAt) {
					slot.info.rttMs = Math.round(performance.now() - slot.pingSentAt);
					slot.pingSentAt = void 0;
					this.emitPeers();
				}
			} else this.opts.onMessage?.(slot.info.id, msg.d, channel.label === "state" ? "state" : "reliable");
		};
	}
	/** Apply buffered ICE candidates once a remote description is in place. */
	async flushPendingCandidates(slot) {
		while (slot.pendingCandidates.length > 0) {
			const candidate = slot.pendingCandidates.shift();
			try {
				await slot.pc.addIceCandidate(candidate);
			} catch (err) {
				if (!slot.ignoreOffer) console.warn("[p2p] addIceCandidate failed:", err);
			}
			if (this.closed) return;
		}
	}
	async onSignal(from, kind, payload, roster) {
		if (this.closed) return;
		let slot = this.peers.get(from);
		if (!slot) {
			if (!roster.has(from)) return;
			const created = this.connectTo(from, "", false);
			if (!created) return;
			slot = created;
		}
		const polite = this.opts.selfId < from;
		try {
			if (kind === "offer" || kind === "answer") {
				const description = payload;
				const collision = kind === "offer" && (slot.makingOffer || slot.pc.signalingState !== "stable");
				slot.ignoreOffer = !polite && collision;
				if (slot.ignoreOffer) return;
				try {
					await slot.pc.setRemoteDescription(description);
				} catch (err) {
					if (kind !== "offer" || slot.recreatedForOffer) throw err;
					const attempts = slot.recoveryAttempts;
					const name = slot.info.name;
					slot.pc.close();
					this.peers.delete(from);
					const fresh = this.connectTo(from, name, false);
					if (!fresh) return;
					fresh.recoveryAttempts = attempts;
					fresh.recreatedForOffer = true;
					slot = fresh;
					await slot.pc.setRemoteDescription(description);
				}
				if (this.closed) return;
				await this.flushPendingCandidates(slot);
				if (this.closed) return;
				if (kind === "offer") {
					await slot.pc.setLocalDescription();
					if (this.closed) return;
					await this.sendSignal(from, "answer", slot.pc.localDescription.toJSON());
				}
			} else if (kind === "ice") {
				const candidate = payload;
				if (!slot.pc.remoteDescription) {
					slot.pendingCandidates.push(candidate);
					return;
				}
				try {
					await slot.pc.addIceCandidate(candidate);
				} catch (err) {
					if (!slot.ignoreOffer) console.warn("[p2p] addIceCandidate failed:", err);
				}
			}
		} catch {}
	}
	/**
	* Signals are serialized per remote peer (a candidate must never overtake
	* its SDP into the DB) and retried on failure with short backoff.
	*/
	sendSignal(to, kind, payload) {
		const next = (this.signalQueues.get(to) ?? Promise.resolve()).then(() => this.postSignal(to, kind, payload));
		this.signalQueues.set(to, next.catch(() => {}));
		return next;
	}
	async postSignal(to, kind, payload) {
		for (let attempt = 0;; attempt++) {
			if (this.closed) return;
			try {
				const res = await fetch("/api/rtc", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						op: "signal",
						room: this.opts.room,
						from: this.opts.selfId,
						to,
						kind,
						payload
					})
				});
				if (res.ok) return;
				throw new Error(`signal POST failed: ${res.status}`);
			} catch (err) {
				if (attempt >= SIGNAL_RETRY_DELAYS_MS.length) {
					console.warn(`[p2p] signal ${kind} to ${to} failed after retries`, err);
					return;
				}
				await new Promise((r) => setTimeout(r, SIGNAL_RETRY_DELAYS_MS[attempt]));
			}
		}
	}
	pingAll() {
		const wire = JSON.stringify({ t: "ping" });
		for (const slot of this.peers.values()) {
			if (slot.state?.readyState !== "open") continue;
			const stale = slot.pingSentAt !== void 0 && performance.now() - slot.pingSentAt > 2 * PING_INTERVAL_MS;
			if (slot.pingSentAt === void 0 || stale) {
				slot.pingSentAt = performance.now();
				slot.state.send(wire);
			}
		}
	}
	/**
	* Stuck-pair recovery, piggybacked on the ping interval. A pair that has
	* made no progress for STALL_MS gets rebuilt by the dialer with a FRESH
	* RTCPeerConnection (new DTLS identity — fixes the suspend/resume
	* fingerprint wedge). After MAX_RECOVERY_ATTEMPTS the pair is terminal:
	* visible to the app as its last connectionState, ignored by fast-poll.
	*/
	watchdog() {
		if (this.closed) return;
		const now = Date.now();
		for (const [peerId, slot] of this.peers) {
			const live = slot.pc.connectionState;
			if (live !== slot.info.connectionState) {
				slot.info.connectionState = live;
				if (live === "connecting" || live === "connected") slot.lastProgressAt = now;
				this.emitPeers();
			}
			if (slot.terminal || live === "connected") continue;
			if (now - slot.lastProgressAt <= STALL_MS) continue;
			if (slot.recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
				slot.terminal = true;
				this.emitPeers();
				continue;
			}
			slot.recoveryAttempts += 1;
			slot.lastProgressAt = now;
			if (this.opts.selfId > peerId) {
				const { name } = slot.info;
				const attempts = slot.recoveryAttempts;
				slot.pc.close();
				this.peers.delete(peerId);
				const fresh = this.connectTo(peerId, name, true);
				if (fresh) fresh.recoveryAttempts = attempts;
				this.schedulePoll(FAST_POLL_MS);
			}
		}
	}
	async readCandidateType(slot) {
		try {
			const stats = await slot.pc.getStats();
			let selected;
			stats.forEach((s) => {
				if (s.type === "candidate-pair" && s.nominated) selected = s;
			});
			const localId = selected?.localCandidateId;
			if (localId) {
				const local = stats.get(localId);
				slot.info.candidateType = local?.candidateType ?? null;
				this.emitPeers();
			}
		} catch {}
	}
	emitPeers() {
		const list = this.peerList();
		const fingerprint = JSON.stringify(list.map((p) => [
			p.id,
			p.name,
			p.connectionState,
			p.candidateType,
			p.rttMs
		]));
		if (fingerprint === this.lastPeersFingerprint) return;
		this.lastPeersFingerprint = fingerprint;
		this.opts.onPeersChanged?.(list);
	}
};
/**
* React binding for P2PRoom. Identity and room id are captured once on mount
* so re-renders never tear the mesh down. Change room by remounting.
*/
function useP2PRoom(options = {}) {
	const enabled = options.enabled !== false && !!options.room;
	const [selfId] = (0, import_react.useState)(() => `p-${Math.random().toString(36).slice(2, 10)}`);
	const [room] = (0, import_react.useState)(() => options.room || "solo");
	const [name] = (0, import_react.useState)(() => options.name || selfId);
	const [peers, setPeers] = (0, import_react.useState)([]);
	const [joined, setJoined] = (0, import_react.useState)(false);
	const roomRef = (0, import_react.useRef)(null);
	const listeners = (0, import_react.useRef)(/* @__PURE__ */ new Set());
	(0, import_react.useEffect)(() => {
		if (!enabled) return;
		const p2p = new P2PRoom({
			room,
			selfId,
			name,
			onPeersChanged: setPeers,
			onMessage: (from, data, channel) => {
				for (const fn of listeners.current) fn(from, data, channel);
			},
			onConnected: () => setJoined(true)
		});
		roomRef.current = p2p;
		p2p.join();
		return () => {
			roomRef.current = null;
			p2p.close();
		};
	}, [
		room,
		selfId,
		name,
		enabled
	]);
	return {
		selfId,
		room,
		peers,
		joined,
		broadcast: (0, import_react.useCallback)((data) => roomRef.current?.broadcast(data), []),
		send: (0, import_react.useCallback)((data, peerId) => roomRef.current?.send(data, peerId), []),
		onMessage: (0, import_react.useCallback)((fn) => {
			listeners.current.add(fn);
			return () => listeners.current.delete(fn);
		}, [])
	};
}
var EYE = 1.62;
var WALK = 6.4;
var SPRINT = 9.2;
var RADIUS = .36;
var FOE_R = .42;
var LOOK_SENS = .0044;
function blankNet() {
	return {
		enabled: false,
		selfId: "",
		name: "Ranger",
		isHost: true,
		remotes: /* @__PURE__ */ new Map(),
		inbox: [],
		broadcast: () => {},
		send: () => {}
	};
}
function drawMinimap(ctx, px, pz, yaw, arena, foes, remotes) {
	const size = 180;
	const half = size / 2;
	const radius = 84;
	const scale = 3.4;
	ctx.clearRect(0, 0, size, size);
	ctx.save();
	ctx.beginPath();
	ctx.arc(half, half, radius, 0, Math.PI * 2);
	ctx.clip();
	ctx.fillStyle = "rgba(8, 10, 16, 0.88)";
	ctx.fill();
	ctx.strokeStyle = "rgba(0, 210, 255, 0.14)";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.arc(half, half, radius * .45, 0, Math.PI * 2);
	ctx.arc(half, half, radius * .82, 0, Math.PI * 2);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(half, 0);
	ctx.lineTo(half, size);
	ctx.moveTo(0, half);
	ctx.lineTo(size, half);
	ctx.stroke();
	ctx.translate(half, half);
	ctx.rotate(-yaw);
	ctx.fillStyle = "rgba(90, 120, 150, 0.55)";
	ctx.strokeStyle = "rgba(140, 180, 220, 0.75)";
	ctx.lineWidth = 1;
	for (const b of arena.walls) {
		const bx = (b.minX + b.maxX) / 2;
		const bz = (b.minZ + b.maxZ) / 2;
		if (Math.hypot(bx - px, bz - pz) > 28) continue;
		const x0 = (b.minX - px) * scale;
		const z0 = (b.minZ - pz) * scale;
		const w = (b.maxX - b.minX) * scale;
		const h = (b.maxZ - b.minZ) * scale;
		ctx.fillRect(x0, z0, w, h);
		ctx.strokeRect(x0, z0, w, h);
	}
	ctx.fillStyle = "rgba(224, 122, 40, 0.75)";
	for (const s of arena.shields) {
		if (Math.hypot(s.x - px, s.z - pz) > 26) continue;
		const x0 = (s.x - s.w / 2 - px) * scale;
		const z0 = (s.z - s.d / 2 - pz) * scale;
		ctx.fillRect(x0, z0, s.w * scale, s.d * scale);
	}
	ctx.fillStyle = "rgba(255, 140, 20, 0.85)";
	for (const p of arena.pumpkins) {
		if (Math.hypot(p.x - px, p.z - pz) > 22) continue;
		ctx.beginPath();
		ctx.arc((p.x - px) * scale, (p.z - pz) * scale, 2.2, 0, Math.PI * 2);
		ctx.fill();
	}
	const pulse = 1 + Math.sin(performance.now() * .009) * .3;
	for (const f of foes) {
		if (!f.alive) continue;
		if (Math.hypot(f.x - px, f.z - pz) > 26) continue;
		const fx = (f.x - px) * scale;
		const fz = (f.z - pz) * scale;
		ctx.fillStyle = "rgba(255, 30, 50, 0.3)";
		ctx.beginPath();
		ctx.arc(fx, fz, 6.5 * pulse, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = "#ff1e38";
		ctx.beginPath();
		ctx.arc(fx, fz, 3.8, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.fillStyle = "#00d2ff";
	for (const r of remotes) {
		const rx = (r.x - px) * scale;
		const rz = (r.z - pz) * scale;
		ctx.beginPath();
		ctx.arc(rx, rz, 4, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.restore();
	ctx.save();
	ctx.translate(half, half);
	ctx.fillStyle = "#10f08c";
	ctx.shadowColor = "rgba(16, 240, 140, 0.85)";
	ctx.shadowBlur = 8;
	ctx.beginPath();
	ctx.moveTo(0, -8);
	ctx.lineTo(5.5, 6);
	ctx.lineTo(0, 2.5);
	ctx.lineTo(-5.5, 6);
	ctx.closePath();
	ctx.fill();
	ctx.restore();
	ctx.save();
	ctx.strokeStyle = "rgba(0, 210, 255, 0.55)";
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(half, half, radius, 0, Math.PI * 2);
	ctx.stroke();
	ctx.font = "bold 10px 'Rajdhani', monospace";
	ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	const nAngle = -yaw - Math.PI / 2;
	const nDist = 76;
	ctx.fillText("N", half + Math.cos(nAngle) * nDist, half + Math.sin(nAngle) * nDist);
	ctx.restore();
}
function ShooterGame(props) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Match, { ...props });
}
function Match({ map, name, room, onLeave }) {
	const canvasRef = (0, import_react.useRef)(null);
	const mapCanvasRef = (0, import_react.useRef)(null);
	const stickRef = (0, import_react.useRef)({
		x: 0,
		y: 0
	});
	const knobRef = (0, import_react.useRef)(null);
	const netRef = (0, import_react.useRef)(blankNet());
	const onLeaveRef = (0, import_react.useRef)(onLeave);
	onLeaveRef.current = onLeave;
	const p2p = useP2PRoom({
		room: room ?? "solo",
		name,
		enabled: !!room
	});
	const api = (0, import_react.useRef)({
		enter: () => {},
		resume: () => {},
		pause: () => {},
		again: () => {},
		menu: () => {},
		fire: () => {},
		setMap: (_id) => {},
		next: () => {}
	});
	const [phase, setPhase] = (0, import_react.useState)("play");
	const [mapId, setMapId] = (0, import_react.useState)(map);
	const [hurt, setHurt] = (0, import_react.useState)(false);
	const [hitMarker, setHitMarker] = (0, import_react.useState)(false);
	const [hud, setHud] = (0, import_react.useState)({
		hp: 100,
		foes: 6,
		total: 6,
		map: "Hedge"
	});
	const [lookHint, setLookHint] = (0, import_react.useState)(true);
	const [copied, setCopied] = (0, import_react.useState)(false);
	const onHitRef = (0, import_react.useRef)(() => {});
	onHitRef.current = () => {
		setHitMarker(true);
		setTimeout(() => setHitMarker(false), 90);
	};
	const connected = p2p.peers.filter((peer) => peer.connectionState === "connected");
	netRef.current.enabled = !!room;
	netRef.current.selfId = p2p.selfId;
	netRef.current.name = name;
	netRef.current.broadcast = p2p.broadcast;
	netRef.current.send = p2p.send;
	const ids = [p2p.selfId, ...connected.map((peer) => peer.id)];
	netRef.current.isHost = ids.reduce((best, id) => id < best ? id : best) === p2p.selfId;
	(0, import_react.useEffect)(() => p2p.onMessage((from, data) => {
		netRef.current.inbox.push({
			from,
			data
		});
	}), [p2p.onMessage]);
	const copyInvite = () => {
		if (!room) return;
		const url = new URL(window.location.href);
		url.pathname = url.pathname.replace(/\/play\/?$/, "/") || "/";
		url.search = "";
		url.searchParams.set("map", mapId);
		url.searchParams.set("room", room);
		navigator.clipboard?.writeText(url.toString()).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2400);
		}).catch(() => setCopied(false));
	};
	(0, import_react.useEffect)(() => {
		const canvasEl = canvasRef.current;
		if (!canvasEl) return;
		const canvas = canvasEl;
		let dead = false;
		const sfx = createSfx();
		const held = /* @__PURE__ */ new Set();
		const phaseRef = { current: "play" };
		const stick = stickRef.current;
		const mapPick = { current: map };
		const setPhaseBoth = (p) => {
			phaseRef.current = p;
			if (!dead) setPhase(p);
		};
		const renderer = (() => {
			try {
				return new WebGLRenderer({
					canvas,
					antialias: true,
					alpha: false
				});
			} catch {
				return null;
			}
		})();
		if (!renderer) {
			sfx.dispose();
			return;
		}
		const gl = renderer;
		gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
		gl.outputColorSpace = SRGBColorSpace;
		gl.toneMapping = 4;
		gl.toneMappingExposure = 1.3;
		const scene = new Scene();
		const camera = new PerspectiveCamera(70, 1, .05, 200);
		camera.rotation.order = "YXZ";
		scene.add(camera);
		const ambient = new AmbientLight(16777215, .75);
		scene.add(ambient);
		const hemi = new HemisphereLight(16772829, 4010024, 2);
		scene.add(hemi);
		const sun = new DirectionalLight(16767146, 2.4);
		sun.position.set(-18, 28, 12);
		scene.add(sun);
		const lantern = new PointLight(16772304, 42, 28, 1.8);
		lantern.position.set(0, 0, 0);
		camera.add(lantern);
		const flash = new PointLight(16755268, 0, 14, 2);
		camera.add(flash);
		const gun = new Group();
		const metal = new MeshStandardMaterial({
			color: 1843238,
			roughness: .35,
			metalness: .85
		});
		const wood = new MeshStandardMaterial({
			color: 5911582,
			roughness: .65,
			metalness: .08
		});
		const sleeve = new MeshStandardMaterial({
			color: 2369586,
			roughness: .85
		});
		const body = new Mesh(new BoxGeometry(.08, .1, .78), metal);
		const barrel = new Mesh(new BoxGeometry(.04, .04, .62), metal);
		barrel.position.set(0, .055, -.52);
		const guard = new Mesh(new BoxGeometry(.09, .07, .3), metal);
		guard.position.set(0, -.01, -.2);
		const grip = new Mesh(new BoxGeometry(.055, .16, .07), wood);
		grip.position.set(0, -.12, .16);
		grip.rotation.x = .45;
		const stock = new Mesh(new BoxGeometry(.07, .11, .32), wood);
		stock.position.set(0, .01, .42);
		const arm = new Mesh(new BoxGeometry(.1, .1, .42), sleeve);
		arm.position.set(.04, -.16, .28);
		arm.rotation.x = .55;
		gun.add(body, barrel, guard, grip, stock, arm);
		gun.position.set(.16, -.26, -.48);
		gun.rotation.y = -.12;
		gun.rotation.x = -.04;
		gun.traverse((child) => {
			child.renderOrder = 10;
			const mesh = child;
			if (mesh.isMesh && mesh.material && !Array.isArray(mesh.material)) {
				mesh.material.depthTest = false;
				mesh.material.depthWrite = false;
			}
		});
		camera.add(gun);
		const foeMat = new MeshStandardMaterial({
			color: 8004136,
			roughness: .55,
			emissive: 4458512,
			emissiveIntensity: .45
		});
		const headMat = new MeshStandardMaterial({
			color: 14206386,
			roughness: .65
		});
		const eyeMat = new MeshStandardMaterial({
			color: 16716083,
			emissive: 16711714,
			emissiveIntensity: 2.2
		});
		const floorMat = new MeshStandardMaterial({
			color: 5925442,
			roughness: .85,
			metalness: .08
		});
		const wallMat = new MeshStandardMaterial({
			color: 2902580,
			roughness: .78,
			metalness: .12
		});
		const trimMat = new MeshStandardMaterial({
			color: 14711336,
			roughness: .45,
			emissive: 7811840,
			emissiveIntensity: .4
		});
		const coverMat = new MeshStandardMaterial({
			color: 12868120,
			roughness: .75
		});
		const pumpMat = new MeshStandardMaterial({
			color: 16737809,
			roughness: .45,
			emissive: 11877376,
			emissiveIntensity: .75
		});
		const stemMat = new MeshStandardMaterial({
			color: 4020786,
			roughness: .9
		});
		const tracerMat = new LineBasicMaterial({
			color: 16770984,
			linewidth: 2
		});
		const materials = [
			metal,
			wood,
			sleeve,
			foeMat,
			headMat,
			eyeMat,
			floorMat,
			wallMat,
			trimMat,
			coverMat,
			pumpMat,
			stemMat,
			tracerMat
		];
		const world = new Group();
		scene.add(world);
		const geos = [
			body.geometry,
			barrel.geometry,
			guard.geometry,
			grip.geometry,
			stock.geometry,
			arm.geometry
		];
		let arena = findArena("grass");
		let boxes = [];
		let foes = [];
		let px = 0;
		let pz = 0;
		let yaw = 0;
		let pitch = 0;
		const vel = {
			x: 0,
			z: 0
		};
		let hp = 100;
		let aliveFoes = 0;
		let flashT = 0;
		let kick = 0;
		let recoil = 0;
		let swayX = 0;
		let swayY = 0;
		let prevYaw = 0;
		let prevPitch = 0;
		let hurtUntil = 0;
		let boo = 0;
		const wantFire = { current: false };
		const tracers = [];
		for (let i = 0; i < 10; i++) {
			const geo = new BufferGeometry();
			geo.setAttribute("position", new BufferAttribute(/* @__PURE__ */ new Float32Array(6), 3));
			const line = new Line(geo, tracerMat);
			line.visible = false;
			line.frustumCulled = false;
			scene.add(line);
			geos.push(geo);
			tracers.push({
				line,
				life: 0
			});
		}
		let hudAt = 0;
		function pushHud(force = false) {
			if (dead) return;
			const now = performance.now();
			if (!force && now - hudAt < 80) return;
			hudAt = now;
			setHud({
				hp: Math.max(0, Math.round(hp)),
				foes: aliveFoes,
				total: foes.length,
				map: arena.name
			});
		}
		function lookDir() {
			const cp = Math.cos(pitch);
			return {
				x: -Math.sin(yaw) * cp,
				y: -Math.sin(pitch),
				z: -Math.cos(yaw) * cp
			};
		}
		function trace(ax, ay, az, bx, by, bz, enemy) {
			const slot = tracers.find((t) => t.life <= 0) ?? tracers[0];
			const attr = slot.line.geometry.getAttribute("position");
			attr.setXYZ(0, ax, ay, az);
			attr.setXYZ(1, bx, by, bz);
			attr.needsUpdate = true;
			slot.line.visible = true;
			slot.life = enemy ? .08 : .05;
			tracerMat.color.setHex(enemy ? 16729139 : 16770728);
		}
		function clearWorld() {
			for (const child of [...world.children]) world.remove(child);
			foes = [];
		}
		function build() {
			clearWorld();
			arena = findArena(mapPick.current);
			boxes = arenaBoxes(arena);
			hp = 100;
			kick = 0;
			recoil = 0;
			boo = 0;
			px = arena.spawn.x;
			pz = arena.spawn.z;
			yaw = arena.spawn.yaw;
			pitch = 0;
			vel.x = 0;
			vel.z = 0;
			scene.background = new Color(arena.sky);
			scene.fog = new Fog(arena.fog, 6, 52);
			gl.setClearColor(arena.sky, 1);
			floorMat.color.setHex(arena.floor);
			wallMat.color.setHex(arena.wall);
			trimMat.color.setHex(arena.trim);
			coverMat.color.setHex(arena.cover);
			sun.color.setHex(arena.sun);
			lantern.color.setHex(16772560);
			const floor = new Mesh(new PlaneGeometry(arena.floorW, arena.floorD, 4, 4), floorMat);
			floor.rotation.x = -Math.PI / 2;
			floor.position.set(arena.floorX, 0, arena.floorZ);
			floor.frustumCulled = false;
			world.add(floor);
			geos.push(floor.geometry);
			const dummy = new Object3D();
			const wallGeo = new BoxGeometry(1, 1, 1);
			geos.push(wallGeo);
			const walls = new InstancedMesh(wallGeo, wallMat, arena.walls.length);
			arena.walls.forEach((b, i) => {
				dummy.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2);
				dummy.scale.set(Math.max(.05, b.maxX - b.minX), b.maxY - b.minY, Math.max(.05, b.maxZ - b.minZ));
				dummy.rotation.set(0, 0, 0);
				dummy.updateMatrix();
				walls.setMatrixAt(i, dummy.matrix);
			});
			walls.instanceMatrix.needsUpdate = true;
			walls.frustumCulled = false;
			world.add(walls);
			const shieldGeo = new BoxGeometry(1, 1, 1);
			geos.push(shieldGeo);
			if (arena.shields.length) {
				const shields = new InstancedMesh(shieldGeo, coverMat, arena.shields.length);
				arena.shields.forEach((s, i) => {
					dummy.position.set(s.x, s.h / 2, s.z);
					dummy.scale.set(s.w, s.h, s.d);
					dummy.rotation.set(0, 0, 0);
					dummy.updateMatrix();
					shields.setMatrixAt(i, dummy.matrix);
				});
				shields.instanceMatrix.needsUpdate = true;
				shields.frustumCulled = false;
				world.add(shields);
				const caps = new InstancedMesh(shieldGeo, trimMat, arena.shields.length);
				arena.shields.forEach((s, i) => {
					dummy.position.set(s.x, s.h + .08, s.z);
					dummy.scale.set(s.w + .08, .16, s.d + .08);
					dummy.rotation.set(0, 0, 0);
					dummy.updateMatrix();
					caps.setMatrixAt(i, dummy.matrix);
				});
				caps.instanceMatrix.needsUpdate = true;
				caps.frustumCulled = false;
				world.add(caps);
			}
			if (arena.pumpkins.length) {
				const pumpGeo = new SphereGeometry(.42, 8, 7);
				const stemGeo = new CylinderGeometry(.045, .06, .18, 5);
				geos.push(pumpGeo, stemGeo);
				const pumps = new InstancedMesh(pumpGeo, pumpMat, arena.pumpkins.length);
				const stems = new InstancedMesh(stemGeo, stemMat, arena.pumpkins.length);
				arena.pumpkins.forEach((p, i) => {
					dummy.position.set(p.x, .3 * p.s, p.z);
					dummy.scale.set(p.s, p.s * .78, p.s);
					dummy.rotation.set(0, 0, 0);
					dummy.updateMatrix();
					pumps.setMatrixAt(i, dummy.matrix);
					dummy.position.set(p.x, .58 * p.s, p.z);
					dummy.scale.set(p.s, p.s, p.s);
					dummy.updateMatrix();
					stems.setMatrixAt(i, dummy.matrix);
				});
				pumps.instanceMatrix.needsUpdate = true;
				stems.instanceMatrix.needsUpdate = true;
				pumps.frustumCulled = false;
				stems.frustumCulled = false;
				world.add(pumps, stems);
			}
			const bodyGeo = new BoxGeometry(.62, 1.05, .4);
			const headGeo = new SphereGeometry(.24, 8, 6);
			const eyeGeo = new SphereGeometry(.05, 6, 4);
			geos.push(bodyGeo, headGeo, eyeGeo);
			foes = arena.foes.map((spot) => {
				const group = new Group();
				const torso = new Mesh(bodyGeo, foeMat);
				torso.position.y = .85;
				const head = new Mesh(headGeo, headMat);
				head.position.y = 1.58;
				const eyeL = new Mesh(eyeGeo, eyeMat);
				eyeL.position.set(-.08, 1.62, -.22);
				const eyeR = new Mesh(eyeGeo, eyeMat);
				eyeR.position.set(.08, 1.62, -.22);
				const eyeLight = new PointLight(16716066, 14, 12, 1.8);
				eyeLight.position.set(0, 1.5, -.2);
				group.add(torso, head, eyeL, eyeR, eyeLight);
				group.position.set(spot.x, 0, spot.z);
				group.frustumCulled = false;
				world.add(group);
				return {
					mesh: group,
					light: eyeLight,
					x: spot.x,
					z: spot.z,
					hp: 100,
					cool: .6 + Math.random() * .8,
					alive: true
				};
			});
			aliveFoes = foes.length;
			pushHud(true);
			const net = netRef.current;
			if (net.enabled && net.isHost) net.send({
				k: "map",
				id: arena.id
			});
		}
		function resize() {
			const w = canvas.clientWidth || window.innerWidth;
			const h = canvas.clientHeight || window.innerHeight;
			const aspect = w / Math.max(1, h);
			gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 900 ? 1 : 1.5));
			gl.setSize(w, h, false);
			let vertical = 2 * Math.atan(Math.tan(90 * (Math.PI / 180) / 2) / Math.max(aspect, .35)) * 180 / Math.PI;
			vertical = Math.max(54, Math.min(vertical, aspect < 1 ? 96 : 74));
			camera.aspect = aspect;
			camera.fov = vertical;
			camera.updateProjectionMatrix();
		}
		function tryLock() {
			if (window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 860) return;
			try {
				canvas.requestPointerLock();
			} catch {}
		}
		function shoot() {
			if (phaseRef.current !== "play" || hp <= 0) return;
			wantFire.current = true;
		}
		const resetInput = () => {
			held.clear();
			stick.x = 0;
			stick.y = 0;
			vel.x = 0;
			vel.z = 0;
		};
		function enter() {
			if (dead) return;
			resetInput();
			try {
				sfx.unlock();
			} catch {}
			if (phaseRef.current === "won" || phaseRef.current === "lost") return;
			tryLock();
			setPhaseBoth("play");
			pushHud(true);
		}
		function pause() {
			if (phaseRef.current !== "play") return;
			resetInput();
			setPhaseBoth("paused");
			try {
				document.exitPointerLock();
			} catch {}
		}
		function again() {
			try {
				sfx.unlock();
			} catch {}
			const net = netRef.current;
			if (net.enabled && !net.isHost) {
				net.send({ k: "reset" });
				return;
			}
			build();
			tryLock();
			setPhaseBoth("play");
		}
		function leave() {
			try {
				document.exitPointerLock();
			} catch {}
			onLeaveRef.current(mapPick.current);
		}
		function setMap(id) {
			mapPick.current = id;
			if (!dead) setMapId(id);
			if (phaseRef.current === "menu") build();
		}
		function next() {
			const i = ARENAS.findIndex((a) => a.id === mapPick.current);
			const id = ARENAS[(i + 1) % ARENAS.length].id;
			const net = netRef.current;
			if (net.enabled && !net.isHost) {
				net.send({
					k: "reset",
					map: id
				});
				return;
			}
			setMap(id);
			again();
		}
		api.current = {
			enter,
			resume: enter,
			pause,
			again,
			menu: leave,
			fire: shoot,
			setMap,
			next
		};
		const onKeyDown = (e) => {
			held.add(e.code);
			if (e.key) held.add(e.key.toLowerCase());
			if ([
				"ArrowUp",
				"ArrowDown",
				"ArrowLeft",
				"ArrowRight",
				"Space"
			].includes(e.code)) e.preventDefault();
			if (e.code === "Escape") pause();
			if ((e.code === "KeyF" || e.code === "Space") && phaseRef.current === "play") shoot();
			if ((e.code === "Enter" || e.code === "Space") && (phaseRef.current === "menu" || phaseRef.current === "paused")) enter();
		};
		const onKeyUp = (e) => {
			held.delete(e.code);
			if (e.key) held.delete(e.key.toLowerCase());
		};
		const onBlur = () => {
			resetInput();
		};
		const onFocus = () => {
			resetInput();
		};
		const onMouse = (e) => {
			if (document.pointerLockElement !== canvas || phaseRef.current !== "play") return;
			yaw -= e.movementX * LOOK_SENS;
			pitch -= e.movementY * LOOK_SENS;
			pitch = Math.max(-1.15, Math.min(1.15, pitch));
		};
		let sawLock = false;
		const onLock = () => {
			const locked = document.pointerLockElement === canvas;
			resetInput();
			if (locked) sawLock = true;
			else if (sawLock && phaseRef.current === "play") {
				sawLock = false;
				setPhaseBoth("paused");
			}
		};
		let lookId = null;
		let lookX = 0;
		let lookY = 0;
		let edge = 0;
		let lookTravel = 0;
		const onPointerDown = (e) => {
			if (phaseRef.current !== "play") return;
			if (e.pointerType === "mouse" && document.pointerLockElement !== canvas) {
				tryLock();
				return;
			}
			if (document.pointerLockElement === canvas) return;
			lookId = e.pointerId;
			lookX = e.clientX;
			lookY = e.clientY;
			edge = 0;
			lookTravel = 0;
			try {
				canvas.setPointerCapture(e.pointerId);
			} catch {}
		};
		const onPointerMove = (e) => {
			if (e.pointerId !== lookId || phaseRef.current !== "play") return;
			const dx = e.clientX - lookX;
			const dy = e.clientY - lookY;
			lookX = e.clientX;
			lookY = e.clientY;
			lookTravel += Math.hypot(dx, dy);
			const sens = e.pointerType === "mouse" ? .0058 : .014;
			if (dx * dx + dy * dy > 4 && !dead) setLookHint(false);
			yaw -= dx * sens;
			pitch -= dy * sens * .8;
			pitch = Math.max(-1.15, Math.min(1.15, pitch));
			const rect = canvas.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const margin = Math.min(120, rect.width * .24);
			if (x >= rect.width - margin) edge = (x - (rect.width - margin)) / margin;
			else if (x <= margin) edge = -((margin - x) / margin);
			else edge = 0;
		};
		const onPointerUp = (e) => {
			if (e.pointerId !== lookId) return;
			const tap = lookTravel < 16;
			lookId = null;
			edge = 0;
			if (tap) shoot();
		};
		const onMouseDown = (e) => {
			if (e.button !== 0) return;
			if (document.pointerLockElement === canvas) shoot();
		};
		const onVisibility = () => {
			if (document.hidden) resetInput();
		};
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("keyup", onKeyUp);
		document.addEventListener("keyup", onKeyUp);
		window.addEventListener("blur", onBlur);
		window.addEventListener("focus", onFocus);
		document.addEventListener("visibilitychange", onVisibility);
		window.addEventListener("resize", resize);
		const ro = new ResizeObserver(() => resize());
		ro.observe(canvas);
		document.addEventListener("mousemove", onMouse);
		document.addEventListener("mousedown", onMouseDown);
		document.addEventListener("pointerlockchange", onLock);
		canvas.addEventListener("pointerdown", onPointerDown);
		canvas.addEventListener("pointermove", onPointerMove);
		canvas.addEventListener("pointerup", onPointerUp);
		canvas.addEventListener("pointercancel", onPointerUp);
		build();
		resize();
		window.__controlsTest = {
			getYaw: () => yaw,
			getSpeed: () => Math.hypot(vel.x, vel.z),
			getPos: () => ({
				x: px,
				y: EYE,
				z: pz
			}),
			setKeys: (codes) => {
				held.clear();
				for (const code of codes) held.add(code);
				if (phaseRef.current === "menu" || phaseRef.current === "paused") setPhaseBoth("play");
			},
			isInsideWall: () => false
		};
		const friendMat = new MeshStandardMaterial({
			color: 2851514,
			roughness: .5,
			emissive: 999526,
			emissiveIntensity: .5
		});
		materials.push(friendMat);
		const friendBody = new BoxGeometry(.62, 1.05, .4);
		const friendHead = new SphereGeometry(.22, 8, 6);
		geos.push(friendBody, friendHead);
		const friends = /* @__PURE__ */ new Map();
		const ensureFriend = (id) => {
			const existing = friends.get(id);
			if (existing) return existing;
			const group = new Group();
			const torso = new Mesh(friendBody, friendMat);
			torso.position.y = .85;
			const head = new Mesh(friendHead, headMat);
			head.position.y = 1.58;
			group.add(torso, head);
			scene.add(group);
			friends.set(id, group);
			return group;
		};
		function strike(foe) {
			foe.hp -= 40;
			sfx.hit();
			onHitRef.current();
			if (foe.hp <= 0) {
				foe.alive = false;
				foe.mesh.visible = false;
				foe.light.intensity = 0;
				aliveFoes = foes.filter((f) => f.alive).length;
				pushHud(true);
			}
		}
		function sting(amount) {
			if (amount <= 0 || phaseRef.current !== "play") return;
			hp -= amount;
			hurtUntil = performance.now() + 260;
			if (!dead) setHurt(true);
			sfx.hurt();
			pushHud(true);
		}
		function applyMap(id) {
			if (id !== "grass" && id !== "brick" && id !== "palace") return;
			if (id === arena.id) return;
			mapPick.current = id;
			if (!dead) setMapId(id);
			build();
		}
		function drain() {
			const net = netRef.current;
			const batch = net.inbox.splice(0, 40);
			for (const msg of batch) {
				const data = msg.data;
				if (!data || typeof data !== "object") continue;
				const packet = data;
				if (packet.k === "me") {
					const x = Number(packet.x);
					const z = Number(packet.z);
					if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
					let remote = net.remotes.get(msg.from);
					if (!remote) {
						remote = {
							id: msg.from,
							name: "Friend",
							x,
							z,
							yaw: 0,
							hp: 100,
							at: 0
						};
						net.remotes.set(msg.from, remote);
					}
					remote.x = x;
					remote.z = z;
					remote.yaw = Number(packet.yaw) || 0;
					remote.hp = Number(packet.hp) || remote.hp;
					remote.name = String(packet.name || remote.name).slice(0, 16);
					remote.at = performance.now();
				} else if (packet.k === "foes" && !net.isHost && Array.isArray(packet.foes)) {
					if (typeof packet.map === "string") applyMap(packet.map);
					packet.foes.forEach((row, i) => {
						const foe = foes[i];
						if (!foe || !row) return;
						foe.x = Number(row.x) || foe.x;
						foe.z = Number(row.z) || foe.z;
						foe.hp = Number(row.hp);
						foe.alive = !!row.alive;
						foe.mesh.visible = foe.alive;
						foe.mesh.position.set(foe.x, 0, foe.z);
					});
					aliveFoes = foes.filter((foe) => foe.alive).length;
					if (aliveFoes > 0 && (phaseRef.current === "won" || phaseRef.current === "lost")) setPhaseBoth("play");
				} else if (packet.k === "shot" && net.isHost) {
					const foe = foes[Number(packet.i)];
					if (foe?.alive) strike(foe);
				} else if (packet.k === "ouch") sting(Math.min(20, Number(packet.dmg) || 0));
				else if (packet.k === "map" && !net.isHost && typeof packet.id === "string") applyMap(packet.id);
				else if (packet.k === "reset" && net.isHost) {
					if (typeof packet.map === "string") {
						if (packet.map === "grass" || packet.map === "brick" || packet.map === "palace") {
							mapPick.current = packet.map;
							if (!dead) setMapId(packet.map);
						}
					}
					build();
					tryLock();
					setPhaseBoth("play");
				}
			}
		}
		let last = performance.now();
		let fireCool = 0;
		let lastMe = 0;
		let lastFoeSend = 0;
		const frame = (now) => {
			if (dead) return;
			let dt = (now - last) / 1e3;
			last = now;
			if (dt > .05) dt = .05;
			if (dt < 0) dt = 0;
			drain();
			const playing = phaseRef.current === "play";
			fireCool = Math.max(0, fireCool - dt);
			flashT = Math.max(0, flashT - dt);
			flash.intensity = flashT > 0 ? 12 : 0;
			if (playing) {
				const turn = (held.has("KeyQ") || held.has("q") ? 1 : 0) - (held.has("KeyE") || held.has("e") ? 1 : 0);
				yaw += turn * 2.4 * dt;
				if (lookId !== null && edge !== 0) yaw -= edge * 2.6 * dt;
				const fx = -Math.sin(yaw);
				const fz = -Math.cos(yaw);
				const rx = Math.cos(yaw);
				const rz = -Math.sin(yaw);
				let wx = 0;
				let wz = 0;
				if (held.has("KeyW") || held.has("ArrowUp") || held.has("w")) {
					wx += fx;
					wz += fz;
				}
				if (held.has("KeyS") || held.has("ArrowDown") || held.has("s")) {
					wx -= fx;
					wz -= fz;
				}
				if (held.has("KeyD") || held.has("ArrowRight") || held.has("d")) {
					wx += rx;
					wz += rz;
				}
				if (held.has("KeyA") || held.has("ArrowLeft") || held.has("a")) {
					wx -= rx;
					wz -= rz;
				}
				let sx = stick.x;
				let sy = stick.y;
				if (sx * sx + sy * sy < .02) {
					sx = 0;
					sy = 0;
				}
				wx += rx * sx + fx * sy;
				wz += rz * sx + fz * sy;
				const mag = Math.hypot(wx, wz);
				const target = (held.has("ShiftLeft") || held.has("ShiftRight") ? SPRINT : WALK) * (mag > 1 ? 1 : mag);
				const wishX = mag > 0 ? wx / mag * target : 0;
				const wishZ = mag > 0 ? wz / mag * target : 0;
				if (mag === 0) {
					vel.x *= Math.exp(-26 * dt);
					vel.z *= Math.exp(-26 * dt);
					if (Math.abs(vel.x) < .02) vel.x = 0;
					if (Math.abs(vel.z) < .02) vel.z = 0;
				} else {
					const k = 1 - Math.exp(-18 * dt);
					vel.x += (wishX - vel.x) * k;
					vel.z += (wishZ - vel.z) * k;
				}
				const moved = resolveMove(px, pz, vel.x * dt, vel.z * dt, RADIUS, boxes);
				if (Math.abs(moved.x - px) < 1e-4 && Math.abs(vel.x) > .01) vel.x = 0;
				if (Math.abs(moved.z - pz) < 1e-4 && Math.abs(vel.z) > .01) vel.z = 0;
				px = moved.x;
				pz = moved.z;
				const dir = lookDir();
				if (wantFire.current && fireCool <= 0) {
					wantFire.current = false;
					fireCool = .2;
					kick = 1;
					recoil = Math.min(.07, recoil + .02);
					flashT = .045;
					sfx.shot();
					let best = rayBoxes(px, EYE, pz, dir.x, dir.y, dir.z, 60, boxes);
					let foe = null;
					for (const f of foes) {
						if (!f.alive) continue;
						const vx = f.x - px;
						const vy = -.4700000000000002;
						const vz = f.z - pz;
						const t = vx * dir.x + vy * dir.y + vz * dir.z;
						if (t < .6 || t > best) continue;
						const hx = px + dir.x * t;
						const hy = EYE + dir.y * t;
						const hz = pz + dir.z * t;
						if ((hx - f.x) ** 2 + (hz - f.z) ** 2 < .55 * .55 && hy > .2 && hy < 1.9) {
							best = t;
							foe = f;
						}
					}
					const hx = px + dir.x * best;
					const hy = EYE + dir.y * best;
					const hz = pz + dir.z * best;
					trace(px + dir.x * .4, 1.4700000000000002, pz + dir.z * .4, hx, hy, hz, !!foe);
					if (foe) {
						const net = netRef.current;
						if (!net.enabled || net.isHost) strike(foe);
						else net.send({
							k: "shot",
							i: foes.indexOf(foe)
						});
					}
				}
				if (!netRef.current.enabled || netRef.current.isHost) {
					const squad = [{
						id: "self",
						x: px,
						z: pz
					}];
					if (netRef.current.enabled) {
						for (const remote of netRef.current.remotes.values()) if (now - remote.at < 2e3) squad.push({
							id: remote.id,
							x: remote.x,
							z: remote.z
						});
					}
					for (const f of foes) {
						if (!f.alive) continue;
						f.cool = Math.max(0, f.cool - dt);
						let target = squad[0];
						let bestD = Infinity;
						for (const player of squad) {
							const d = (player.x - f.x) ** 2 + (player.z - f.z) ** 2;
							if (d < bestD) {
								bestD = d;
								target = player;
							}
						}
						const toX = target.x - f.x;
						const toZ = target.z - f.z;
						const dist = Math.hypot(toX, toZ) || 1;
						const ndx = toX / dist;
						const ndz = toZ / dist;
						const see = rayBoxes(f.x, 1.4, f.z, ndx, 0, ndz, dist, boxes) >= dist - .3;
						if (dist > 1.1) {
							const speed = 3.2;
							let step = resolveMove(f.x, f.z, ndx * speed * dt, ndz * speed * dt, FOE_R, boxes);
							if (Math.hypot(step.x - f.x, step.z - f.z) < .001) {
								const stepX = resolveMove(f.x, f.z, ndx * speed * dt, 0, FOE_R, boxes);
								if (Math.hypot(stepX.x - f.x, stepX.z - f.z) > .001) step = stepX;
								else {
									const stepZ = resolveMove(f.x, f.z, 0, ndz * speed * dt, FOE_R, boxes);
									if (Math.hypot(stepZ.x - f.x, stepZ.z - f.z) > .001) step = stepZ;
									else {
										const perpA = resolveMove(f.x, f.z, -ndz * speed * dt, ndx * speed * dt, FOE_R, boxes);
										if (Math.hypot(perpA.x - f.x, perpA.z - f.z) > .001) step = perpA;
										else {
											const perpB = resolveMove(f.x, f.z, ndz * speed * dt, -ndx * speed * dt, FOE_R, boxes);
											if (Math.hypot(perpB.x - f.x, perpB.z - f.z) > .001) step = perpB;
										}
									}
								}
							}
							f.x = step.x;
							f.z = step.z;
						}
						if (target.id === "self") {
							const gapX = px - f.x;
							const gapZ = pz - f.z;
							const gap = Math.hypot(gapX, gapZ);
							if (gap < .95 && gap > .001) {
								const push = (.95 - gap) / gap;
								const away = resolveMove(px, pz, gapX * push, gapZ * push, RADIUS, boxes);
								px = away.x;
								pz = away.z;
								const back = resolveMove(f.x, f.z, -gapX * push, -gapZ * push, FOE_R, boxes);
								f.x = back.x;
								f.z = back.z;
								if (boo <= 0) {
									boo = .7;
									sting(8);
								}
							}
						} else if (dist < .95 && f.cool <= 0) {
							f.cool = .7;
							netRef.current.send({
								k: "ouch",
								dmg: 8
							}, target.id);
						}
						f.mesh.position.set(f.x, 0, f.z);
						f.mesh.lookAt(target.x, 0, target.z);
						if (see && dist < 22 && f.cool <= 0) {
							f.cool = 1.45;
							const spread = (Math.random() - .5) * .22;
							const syaw = Math.atan2(ndx, ndz) + spread;
							const sdx = Math.sin(syaw);
							const sdz = Math.cos(syaw);
							const blocked = rayBoxes(f.x, 1.4, f.z, sdx, 0, sdz, dist, boxes);
							trace(f.x, 1.4, f.z, f.x + sdx * Math.min(dist, blocked), 1.45, f.z + sdz * Math.min(dist, blocked), true);
							if (blocked >= dist - .4 && Math.abs(spread) < .09) {
								if (target.id === "self") sting(12);
								else netRef.current.send({
									k: "ouch",
									dmg: 12
								}, target.id);
							}
						}
					}
				} else for (const f of foes) {
					if (!f.alive) continue;
					f.mesh.position.set(f.x, 0, f.z);
				}
				boo = Math.max(0, boo - dt);
				if (aliveFoes <= 0 && phaseRef.current === "play") {
					setPhaseBoth("won");
					sfx.win();
					try {
						document.exitPointerLock();
					} catch {}
				} else if (hp <= 0 && phaseRef.current === "play") {
					hp = 0;
					setPhaseBoth("lost");
					sfx.lose();
					pushHud(true);
					try {
						document.exitPointerLock();
					} catch {}
				}
			} else {
				vel.x *= Math.exp(-10 * dt);
				vel.z *= Math.exp(-10 * dt);
			}
			kick = Math.max(0, kick - dt * 6);
			recoil = Math.max(0, recoil - dt * .55);
			const net = netRef.current;
			if (net.enabled && (playing || phaseRef.current === "paused")) {
				if (now - lastMe > 50) {
					lastMe = now;
					net.broadcast({
						k: "me",
						x: px,
						z: pz,
						yaw,
						pitch,
						hp,
						name: net.name
					});
				}
				if (net.isHost && now - lastFoeSend > 100) {
					lastFoeSend = now;
					net.broadcast({
						k: "foes",
						map: arena.id,
						foes: foes.map((foe) => ({
							x: foe.x,
							z: foe.z,
							hp: foe.hp,
							alive: foe.alive
						}))
					});
				}
			}
			const seen = /* @__PURE__ */ new Set();
			for (const remote of net.remotes.values()) {
				seen.add(remote.id);
				const group = ensureFriend(remote.id);
				const fresh = now - remote.at < 2500;
				group.visible = fresh;
				if (!fresh) continue;
				group.position.set(remote.x, 0, remote.z);
				group.rotation.y = remote.yaw;
			}
			for (const [id, group] of friends) if (!seen.has(id)) group.visible = false;
			const lookDx = yaw - prevYaw;
			const lookDy = pitch - prevPitch;
			prevYaw = yaw;
			prevPitch = pitch;
			swayX += (-lookDx * .55 - swayX) * Math.min(1, dt * 8);
			swayY += (lookDy * .35 - swayY) * Math.min(1, dt * 8);
			const moving = Math.hypot(vel.x, vel.z);
			const bob = Math.sin(now * .012) * Math.min(.025, moving * .0035);
			gun.position.set(.16 + swayX * .4, -.26 + swayY * .4 + bob, -.48 + kick * .08);
			gun.rotation.y = -.12 - swayX * .35;
			gun.rotation.z = -swayX * .25;
			gun.rotation.x = -.04 - kick * .4;
			camera.position.set(px, EYE, pz);
			if (phaseRef.current === "menu") {
				yaw = arena.spawn.yaw + Math.sin(now * 4e-4) * .18;
				pitch = -.06;
			}
			camera.rotation.y = yaw;
			camera.rotation.x = pitch + recoil;
			camera.rotation.z = 0;
			for (const t of tracers) {
				if (t.life <= 0) continue;
				t.life -= dt;
				if (t.life <= 0) t.line.visible = false;
			}
			if (hurtUntil && performance.now() > hurtUntil) {
				hurtUntil = 0;
				if (!dead) setHurt(false);
			}
			gl.render(scene, camera);
			if (mapCanvasRef.current && arena) {
				const mctx = mapCanvasRef.current.getContext("2d");
				if (mctx) drawMinimap(mctx, px, pz, yaw, arena, foes, Array.from(net.remotes.values()));
			}
		};
		gl.setAnimationLoop(frame);
		return () => {
			dead = true;
			gl.setAnimationLoop(null);
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
			document.removeEventListener("keyup", onKeyUp);
			window.removeEventListener("blur", onBlur);
			window.removeEventListener("focus", onFocus);
			document.removeEventListener("visibilitychange", onVisibility);
			window.removeEventListener("resize", resize);
			ro.disconnect();
			document.removeEventListener("mousemove", onMouse);
			document.removeEventListener("mousedown", onMouseDown);
			document.removeEventListener("pointerlockchange", onLock);
			canvas.removeEventListener("pointerdown", onPointerDown);
			canvas.removeEventListener("pointermove", onPointerMove);
			canvas.removeEventListener("pointerup", onPointerUp);
			canvas.removeEventListener("pointercancel", onPointerUp);
			if (window.__controlsTest) delete window.__controlsTest;
			for (const g of geos) g.dispose();
			for (const m of materials) m.dispose();
			gl.dispose();
			sfx.dispose();
		};
	}, []);
	const showHud = phase === "play" || phase === "paused" || phase === "won" || phase === "lost";
	const hpPercent = Math.max(0, Math.min(100, hud.hp));
	const isCriticalHp = hud.hp < 30;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: phase === "play" ? "game-root is-play" : "game-root",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
				ref: canvasRef,
				className: "view"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: hurt ? "vignette on" : "vignette",
				"aria-hidden": "true"
			}),
			phase === "play" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "crosshair",
				"aria-hidden": "true",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "crosshair-dot" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "crosshair-line crosshair-t" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "crosshair-line crosshair-b" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "crosshair-line crosshair-l" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "crosshair-line crosshair-r" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: hitMarker ? "hitmarker active" : "hitmarker" })
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: showHud ? "hud" : "hud hud-quiet",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "hud-top",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "stack",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "stack-row",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "chip chip-hot",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skull, { "aria-hidden": "true" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
										hud.foes,
										" / ",
										hud.total,
										" HOSTILES"
									] })]
								}),
								room ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "chip chip-neon",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, {
											className: "w-4 h-4 text-[var(--color-neon-blue)]",
											"aria-hidden": "true"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-mono",
											children: room
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-xs px-1.5 py-0.5 rounded bg-white/10",
											children: [connected.length + 1, " SQUAD"]
										})
									]
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: `chip hp-chip ${isCriticalHp ? "border-red-500/50" : ""}`,
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, { className: `w-4 h-4 ${isCriticalHp ? "text-red-500 animate-pulse" : "text-emerald-400"}` }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: `hp ${isCriticalHp ? "hp-critical" : ""}`,
											"aria-label": `Health ${hud.hp}`,
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { width: `${hpPercent}%` } })
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: isCriticalHp ? "text-red-400 font-bold" : "",
											children: hud.hp
										})
									]
								})
							]
						}), phase === "play" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "objective",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "objective-tag",
								children: hud.map
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Purge all hostiles from the labyrinth corridors." })]
						}) : null]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "stack stack-end",
						children: [phase === "play" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "minimap-wrap",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
								ref: mapCanvasRef,
								width: 180,
								height: 180,
								className: "minimap-canvas"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "minimap-badge",
								children: "TACTICAL RADAR"
							})]
						}) : null, phase === "play" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "icon-btn",
							onClick: () => api.current.pause(),
							"aria-label": "Pause Mission",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, {})
						}) : null]
					})]
				}), phase === "play" && lookHint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "look-hint touch-only",
					children: "Drag right side to aim • Tap Fire to shoot"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {})]
			}),
			phase === "paused" || phase === "won" || phase === "lost" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "scrim",
				children: [
					phase === "paused" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "card",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "kicker",
								children: "Tactical Hold"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: "Mission Paused" }),
							room ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "code-line",
								children: ["Squad Frequency: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: room })]
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "The labyrinth figures remain frozen while in tactical hold." }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "actions",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										className: "btn",
										onClick: () => api.current.resume(),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "w-5 h-5 fill-current" }), "Resume Mission"]
									}),
									room ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "btn btn-ghost",
										onClick: copyInvite,
										children: copied ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-4 h-4 text-emerald-400" }), " Link Copied"] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "w-4 h-4" }), " Copy Squad Invite Link"] })
									}) : null,
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "btn btn-ghost",
										onClick: () => api.current.menu(),
										children: "Abort to Headquarters"
									})
								]
							})
						]
					}) : null,
					phase === "won" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "card card-won",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "kicker text-emerald-400",
								children: "// MISSION SUCCESSFUL"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "text-emerald-300",
								children: "Sector Purged"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
								"Outstanding work, Operative. All hostile entities in the ",
								hud.map,
								" labyrinth have been neutralized."
							] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-4 p-4 rounded-xl bg-white/5 border border-white/10 flex justify-between items-center text-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[var(--color-muted)] text-xs uppercase font-mono",
									children: "Hostiles Eliminated"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-xl font-bold text-emerald-400 mt-1",
									children: [
										hud.total,
										" / ",
										hud.total
									]
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[var(--color-muted)] text-xs uppercase font-mono",
									children: "Health Integrity"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-xl font-bold text-white mt-1",
									children: [hud.hp, "%"]
								})] })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "actions",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										className: "btn",
										onClick: () => api.current.next(),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "w-5 h-5" }), "Advance to Next Sector"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										className: "btn btn-ghost",
										onClick: () => api.current.again(),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "w-4 h-4" }), "Replay Sector"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "btn btn-ghost",
										onClick: () => api.current.menu(),
										children: "Headquarters"
									})
								]
							})
						]
					}) : null,
					phase === "lost" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "card card-lost",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "kicker text-red-400",
								children: "// OPERATIVE DOWN"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "text-red-400",
								children: "Critical Failure"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "The hostiles overwhelmed your defenses. Use barricades for cover and keep moving to avoid line of sight." }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-4 p-4 rounded-xl bg-white/5 border border-white/10 flex justify-between items-center text-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[var(--color-muted)] text-xs uppercase font-mono",
									children: "Hostiles Remaining"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xl font-bold text-red-400 mt-1",
									children: hud.foes
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[var(--color-muted)] text-xs uppercase font-mono",
									children: "Sector"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xl font-bold text-white mt-1",
									children: hud.map
								})] })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "actions",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "btn",
									onClick: () => api.current.again(),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "w-4 h-4" }), "Redeploy & Try Again"]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "btn btn-ghost",
									onClick: () => api.current.menu(),
									children: "Headquarters"
								})]
							})
						]
					}) : null
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "swing",
				onClick: () => api.current.fire(),
				children: "Fire"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Joystick, {
				knobRef,
				onChange: (x, y) => {
					stickRef.current.x = x;
					stickRef.current.y = y;
				}
			})
		]
	});
}
function Joystick({ knobRef, onChange }) {
	const baseRef = (0, import_react.useRef)(null);
	const onChangeRef = (0, import_react.useRef)(onChange);
	onChangeRef.current = onChange;
	(0, import_react.useEffect)(() => {
		const el = baseRef.current;
		const knob = knobRef.current;
		if (!el || !knob) return;
		let id = null;
		const origin = {
			x: 0,
			y: 0
		};
		const place = (x, y) => {
			knob.style.transform = `translate(${x * 40}px, ${y * 40}px)`;
		};
		const down = (e) => {
			id = e.pointerId;
			el.setPointerCapture(e.pointerId);
			const r = el.getBoundingClientRect();
			origin.x = r.left + r.width / 2;
			origin.y = r.top + r.height / 2;
			move(e);
		};
		const move = (e) => {
			if (e.pointerId !== id) return;
			const dx = e.clientX - origin.x;
			const dy = e.clientY - origin.y;
			const mag = Math.hypot(dx, dy) || 1;
			const k = Math.min(1, mag / 46);
			const nx = dx / mag * k;
			const ny = -dy / mag * k;
			place(nx, -ny);
			onChangeRef.current(nx, ny);
		};
		const up = (e) => {
			if (e.pointerId !== id) return;
			id = null;
			place(0, 0);
			onChangeRef.current(0, 0);
		};
		el.addEventListener("pointerdown", down);
		el.addEventListener("pointermove", move);
		el.addEventListener("pointerup", up);
		el.addEventListener("pointercancel", up);
		return () => {
			el.removeEventListener("pointerdown", down);
			el.removeEventListener("pointermove", move);
			el.removeEventListener("pointerup", up);
			el.removeEventListener("pointercancel", up);
		};
	}, [knobRef]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		ref: baseRef,
		className: "stick touch-only",
		"aria-label": "Move",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref: knobRef,
			className: "stick-knob"
		})
	});
}
function PlayPage() {
	const search = Route$1.useSearch();
	const navigate = useNavigate();
	const leave = (map) => {
		navigate({
			to: "/",
			search: {
				map,
				room: search.room
			}
		});
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShooterGame, {
		map: search.map,
		name: search.name,
		room: search.room ?? null,
		onLeave: leave
	}, `${search.map}-${search.room ?? "solo"}-${search.name}`);
}
//#endregion
export { PlayPage as component };
