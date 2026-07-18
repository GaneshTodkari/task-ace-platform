import type { User } from "./types";

export function getDescendants(users: User[], rootId: string): User[] {
  const childrenMap = new Map<string, User[]>();

  for (const u of users) {
    if (!u.managerId) continue;

    if (!childrenMap.has(u.managerId)) {
      childrenMap.set(u.managerId, []);
    }

    childrenMap.get(u.managerId)!.push(u);
  }

  const out: User[] = [];
  const visited = new Set<string>();

  const walk = (id: string) => {
    if (visited.has(id)) return;

    visited.add(id);

    const kids = childrenMap.get(id) ?? [];

    for (const k of kids) {
      if (!visited.has(k.id)) {
        out.push(k);
        walk(k.id);
      }
    }
  };

  walk(rootId);

  return out;
}

export function isDescendantOf(users: User[], ancestorId: string, userId: string) {
  return getDescendants(users, ancestorId).some((u) => u.id === userId);
}

export function getAncestors(users: User[], userId: string) {
  const map = new Map(users.map((u) => [u.id, u]));

  const out: User[] = [];
  const visited = new Set<string>();

  let cur = map.get(userId);

  while (cur?.managerId) {
    if (visited.has(cur.managerId)) break;

    visited.add(cur.managerId);

    const parent = map.get(cur.managerId);

    if (!parent) break;

    out.push(parent);
    cur = parent;
  }

  return out;
}