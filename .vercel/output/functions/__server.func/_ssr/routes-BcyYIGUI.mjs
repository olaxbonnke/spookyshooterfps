import { o as __toESM } from "../_runtime.mjs";
import { q as require_react, x as require_jsx_runtime, y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as Route$2 } from "./router-DolqMcv4.mjs";
import { t as ARENAS } from "./arenas-BLSnc4-n.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-BcyYIGUI.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function roomCode() {
	const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
	let code = "";
	for (let i = 0; i < 4; i++) code += alphabet[Math.floor(Math.random() * 31)];
	return code;
}
function savedName() {
	if (typeof window === "undefined") return "You";
	return localStorage.getItem("spooky-name") || "You";
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
		navigator.clipboard?.writeText(url.toString()).then(() => setCopied(true)).catch(() => setCopied(false));
	};
	const start = () => {
		const nextName = name.trim().slice(0, 16) || "You";
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
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "home",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "home-wrap",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "kicker",
					children: "FPS shooter"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: "Spooky Labyrinth" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "lede",
					children: "Pick a labyrinth, go in alone or with friends, then start. Leaving a match brings you back here."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "home-block",
					"aria-labelledby": "options-title",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						id: "options-title",
						children: "Options"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "field-label",
						children: ["Name", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: "field",
							value: name,
							maxLength: 16,
							onChange: (e) => setName(e.target.value)
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "home-block",
					"aria-labelledby": "map-title",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						id: "map-title",
						children: "Labyrinth"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "maps",
						children: ARENAS.map((arena) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							"data-map": arena.id,
							className: map === arena.id ? "map-card on" : "map-card",
							onClick: () => pickMap(arena.id),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "swatch",
								"aria-hidden": "true"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: arena.name }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: arena.line })] })]
						}, arena.id))
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "home-block",
					"aria-labelledby": "friends-title",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							id: "friends-title",
							children: "Friends"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "seg",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: friends ? "seg-btn" : "seg-btn on",
								onClick: playAlone,
								children: "Alone"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: friends ? "seg-btn on" : "seg-btn",
								onClick: enableFriends,
								children: "With friends"
							})]
						}),
						friends ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "code-line",
								children: ["Room ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: /^[a-z0-9]{4}$/.test(room) ? room : "----" })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "home-note",
								children: "Send the link. They land here, press Start, and show up in blue."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "join-row",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "field",
									value: room,
									placeholder: "Code",
									maxLength: 4,
									onChange: (e) => setRoom(e.target.value.toLowerCase()),
									onBlur: (e) => useCode(e.target.value)
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "btn btn-ghost",
									onClick: () => useCode(room),
									children: "Use code"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "btn btn-ghost home-gap",
								onClick: copyLink,
								children: copied ? "Link copied" : "Copy invite link"
							})
						] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "home-note",
							children: "Just you and the figures in the maze."
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "home-block",
					"aria-labelledby": "controls-title",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							id: "controls-title",
							children: "Controls"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
							className: "keys",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "WASD" }), " Move"] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Mouse" }), " Aim"] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Click" }), " Fire"] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Shift" }), " Run"] })
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "home-note",
							children: "On a phone, the left circle walks, dragging the picture aims, and Fire shoots."
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "home-start",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "btn",
						onClick: start,
						children: "Start game"
					})
				})
			]
		})
	});
}
//#endregion
export { Home as component };
