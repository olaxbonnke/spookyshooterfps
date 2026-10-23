import { o as __toESM } from "../_runtime.mjs";
import { q as require_react, x as require_jsx_runtime, y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as Sparkles, d as Crosshair, f as Copy, l as Play, n as Users, o as Skull, p as Check, r as User, s as Shield, t as Zap } from "../_libs/lucide-react.mjs";
import { r as Route$2 } from "./router-CvzV8hOG.mjs";
import { t as ARENAS } from "./arenas-D5SE43Iz.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-B2tBduG1.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function roomCode() {
	const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
	let code = "";
	for (let i = 0; i < 4; i++) code += alphabet[Math.floor(Math.random() * 31)];
	return code;
}
function savedName() {
	if (typeof window === "undefined") return "Ranger";
	return localStorage.getItem("spooky-name") || "Ranger";
}
function mapDetails(id) {
	switch (id) {
		case "grass": return {
			tag: "Sector Alpha",
			difficulty: "Moderate",
			size: "15x15",
			hostiles: 8
		};
		case "brick": return {
			tag: "Bastion Zone",
			difficulty: "High",
			size: "17x15",
			hostiles: 10
		};
		case "palace": return {
			tag: "Ancient Crypt",
			difficulty: "Nightmare",
			size: "15x17",
			hostiles: 12
		};
	}
}
function Home() {
	const search = Route$2.useSearch();
	const navigate = useNavigate();
	const [name, setName] = (0, import_react.useState)(savedName);
	const [map, setMap] = (0, import_react.useState)(search.map);
	const [friends, setFriends] = (0, import_react.useState)(Boolean(search.room));
	const [room, setRoom] = (0, import_react.useState)(search.room ?? "");
	const [copied, setCopied] = (0, import_react.useState)(false);
	const pickMap = (id) => {
		setMap(id);
		navigate({
			to: "/",
			search: {
				map: id,
				room: friends && room ? room : void 0
			},
			replace: true
		});
	};
	const enableFriends = () => {
		const code = room || roomCode();
		setFriends(true);
		setRoom(code);
		navigate({
			to: "/",
			search: {
				map,
				room: code
			},
			replace: true
		});
	};
	const playAlone = () => {
		setFriends(false);
		navigate({
			to: "/",
			search: { map },
			replace: true
		});
	};
	const useCode = (raw) => {
		const code = raw.trim().toLowerCase();
		setRoom(code);
		if (!/^[a-z0-9]{4}$/.test(code)) return;
		setFriends(true);
		navigate({
			to: "/",
			search: {
				map,
				room: code
			},
			replace: true
		});
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
		navigator.clipboard?.writeText(url.toString()).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2400);
		}).catch(() => setCopied(false));
	};
	const start = () => {
		const nextName = name.trim().slice(0, 16) || "Ranger";
		try {
			localStorage.setItem("spooky-name", nextName);
		} catch {}
		const code = friends && /^[a-z0-9]{4}$/.test(room) ? room : void 0;
		navigate({
			to: "/play",
			search: {
				map,
				name: nextName,
				room: code
			}
		});
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "home",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "ambient-grid" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "home-wrap",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "home-header",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "hero-badge",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Tactical Horror FPS • v2.0" })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: "Spooky Labyrinth" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "lede",
							children: "Infiltrate procedurally generated dark labyrinths. Hunt roaming apparitions, utilize barricades for cover, and clear the sector alone or with co-op squadmates in real-time."
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "home-block",
					"aria-labelledby": "options-title",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "home-block-header",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
								id: "options-title",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(User, {}), "Operative Profile"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs font-mono text-[var(--color-subtle)] uppercase",
								children: "Callsign"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "field-label",
							htmlFor: "player-callsign",
							children: "Display Name"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							id: "player-callsign",
							className: "field font-semibold",
							value: name,
							maxLength: 16,
							placeholder: "e.g. Ghost, Hunter, Ranger",
							onChange: (e) => setName(e.target.value)
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "home-block",
					"aria-labelledby": "map-title",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "home-block-header",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
							id: "map-title",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, {}), "Target Sector"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-xs font-mono text-[var(--color-primary)] font-bold tracking-wider",
							children: [ARENAS.find((a) => a.id === map)?.name.toUpperCase(), " SELECTED"]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "maps",
						children: ARENAS.map((arena) => {
							const info = mapDetails(arena.id);
							const isSelected = map === arena.id;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								"data-map": arena.id,
								className: isSelected ? "map-card on" : "map-card",
								onClick: () => pickMap(arena.id),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "swatch",
									"aria-hidden": "true",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Crosshair, { className: "w-5 h-5 text-white/80" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex-1 min-w-0",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center justify-between gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: arena.name }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-xs font-mono font-bold text-[var(--color-muted)]",
												children: info.tag
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: arena.line }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "map-tags",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "map-tag",
													children: [info.size, " Grid"]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "map-tag",
													children: info.difficulty
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "map-tag flex items-center gap-1",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skull, { className: "w-3 h-3 text-[var(--color-primary)]" }),
														" ~",
														info.hostiles,
														" Foes"
													]
												})
											]
										})
									]
								})]
							}, arena.id);
						})
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "home-block",
					"aria-labelledby": "friends-title",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "home-block-header",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
								id: "friends-title",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, {}), "Infiltration Mode"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs font-mono text-[var(--color-subtle)] uppercase",
								children: friends ? "WebRTC Mesh Active" : "Solo Operation"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "seg",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: friends ? "seg-btn" : "seg-btn on",
								onClick: playAlone,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(User, { className: "w-4 h-4" }), "Solo Infiltration"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: friends ? "seg-btn on" : "seg-btn",
								onClick: enableFriends,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "w-4 h-4" }), "Co-op Squad"]
							})]
						}),
						friends ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-4 pt-4 border-t border-white/5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "code-line",
									children: ["Active Room Frequency: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: /^[a-z0-9]{4}$/.test(room) ? room : "----" })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "home-note",
									children: "Share your invite link with friends. Teammates connect peer-to-peer via WebRTC and appear in blue tactical armor."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "join-row",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										className: "field",
										value: room,
										placeholder: "CODE",
										maxLength: 4,
										onChange: (e) => setRoom(e.target.value.toLowerCase()),
										onBlur: (e) => useCode(e.target.value)
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "btn btn-ghost",
										onClick: () => useCode(room),
										children: "Connect"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "btn btn-ghost home-gap",
									onClick: copyLink,
									children: copied ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-4 h-4 text-emerald-400" }), " Link Copied to Clipboard"] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "w-4 h-4" }), " Copy Squad Invite Link"] })
								})
							]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "home-note mt-3",
							children: "Lone wolf operation. Eliminate every phantom roaming the corridors to survive and cleanse the labyrinth."
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "home-block",
					"aria-labelledby": "controls-title",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "home-block-header",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
								id: "controls-title",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, {}), "Combat Controls"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs font-mono text-[var(--color-subtle)]",
								children: "DESKTOP / MOBILE"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
							className: "keys",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "WASD" }), " Movement"] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "MOUSE" }), " Aim / Look"] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "CLICK" }), " Fire Shotgun"] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "SHIFT" }), " Tactical Sprint"] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "ESC" }), " Pause Menu"] })
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "home-note mt-3",
							children: "On touchscreens: drag the left thumbstick to walk, swipe the right screen area to aim, and tap the Fire trigger."
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "home-start",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "btn",
						onClick: start,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "w-5 h-5 fill-current" }), "Deploy To Labyrinth"]
					})
				})
			]
		})]
	});
}
//#endregion
export { Home as component };
