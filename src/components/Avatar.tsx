import type { Member } from "../../shared/contracts";

export function Avatar({
  member,
  size = "md",
}: {
  member: Pick<Member, "displayName" | "avatarMediaId">;
  size?: "sm" | "md" | "lg";
}) {
  return member.avatarMediaId ? (
    <img
      className={`avatar avatar-${size} protected-media`}
      src={`/api/media/${member.avatarMediaId}`}
      alt={`Avatar de ${member.displayName}`}
      draggable={false}
    />
  ) : (
    <span
      className={`avatar avatar-${size} avatar-fallback`}
      aria-label={`Avatar de ${member.displayName}`}
    >
      {member.displayName.slice(0, 2).toUpperCase()}
    </span>
  );
}
