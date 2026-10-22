import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { ShooterGame } from "@/components/shooter-game";

const playSearch = z.object({
  map: z.enum(["grass", "brick", "palace"]).catch("grass"),
  name: z.string().trim().min(1).max(16).catch("You"),
  room: z
    .string()
    .regex(/^[a-z0-9]{4}$/)
    .optional()
    .catch(undefined),
});

export const Route = createFileRoute("/play")({
  validateSearch: playSearch,
  component: PlayPage,
});

function PlayPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const leave = (map: "grass" | "brick" | "palace") => {
    void navigate({ to: "/", search: { map, room: search.room } });
  };
  return (
    <ShooterGame
      key={`${search.map}-${search.room ?? "solo"}-${search.name}`}
      map={search.map}
      name={search.name}
      room={search.room ?? null}
      onLeave={leave}
    />
  );
}
