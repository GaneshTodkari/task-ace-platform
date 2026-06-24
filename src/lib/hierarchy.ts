import type { User } from "./types";

export function getDescendants(users: User[], rootId: string): User[] {
  const childrenMap = new Map<string, User[]>();
  for (const u of users) {
    if (!u.managerId) continue;
    if (!childrenMap.has(u.managerId)) childrenMap.set(u.managerId, []);
    childrenMap.get(u.managerId)!.push(u);
  }
  const out: User[] = [];
  const walk = (id: string) => {
    const kids = childrenMap.get(id) ?? [];
    for (const k of kids) {
      out.push(k);
      walk(k.id);
    }
  };
  walk(rootId);
  return out;
}

export function isDescendantOf(users: User[], ancestorId: string, userId: string): boolean {
  return getDescendants(users, ancestorId).some((u) => u.id === userId);
}

export function getAncestors(users: User[], userId: string): User[] {
  const map = new Map(users.map((u) => [u.id, u]));
  const out: User[] = [];
  let cur = map.get(userId);
  while (cur?.managerId) {
    const parent = map.get(cur.managerId);
    if (!parent) break;
    out.push(parent);
    cur = parent;
  }
  return out;
}
