import { createFileRoute } from "@tanstack/react-router";
import { useAuth, useDBVersion } from "@/lib/auth-context";
import { listUsers, updateUser } from "@/lib/api";
import type { User } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/hierarchy")({
  component: HierarchyPage,
});

interface Node {
  user: User;
  children: Node[];
}

function buildTree(users: User[]): Node[] {
  const map = new Map<string, Node>();
  users.forEach((u) => map.set(u.id, { user: u, children: [] }));
  const roots: Node[] = [];
  users.forEach((u) => {
    const node = map.get(u.id)!;
    if (u.managerId && map.has(u.managerId)) {
      map.get(u.managerId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function TreeNode({ node, users }: { node: Node; users: User[] }) {
  return (
    <li className="ml-4 border-l pl-4 py-1">
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <div className="font-medium text-sm">{node.user.fullName}</div>
          <div className="text-xs text-muted-foreground capitalize">{node.user.role.replace("_", " ")} · {node.user.department}</div>
        </div>
        <Select
          value={node.user.managerId ?? "none"}
          onValueChange={(v) => updateUser(node.user.id, { managerId: v === "none" ? null : v })}
        >
          <SelectTrigger className="h-8 w-48"><SelectValue placeholder="Reports to" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No manager</SelectItem>
            {users.filter((u) => u.id !== node.user.id).map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {node.children.length > 0 && (
        <ul className="mt-1">
          {node.children.map((c) => <TreeNode key={c.user.id} node={c} users={users} />)}
        </ul>
      )}
    </li>
  );
}

function HierarchyPage() {
  const { user } = useAuth();
  useDBVersion();
  if (!user || user.role !== "admin") return <p className="text-muted-foreground">Admin only.</p>;
  const users = listUsers();
  const tree = buildTree(users);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reporting hierarchy</h1>
        <p className="text-muted-foreground">Set who each user reports to. Changes apply instantly.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Org tree</CardTitle></CardHeader>
        <CardContent>
          <ul>
            {tree.map((n) => <TreeNode key={n.user.id} node={n} users={users} />)}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
