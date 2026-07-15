import { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import type { User } from "@/lib/types";
import { eligibleAssignees } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export function AssigneePicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const results = useMemo<User[]>(() => (user ? eligibleAssignees(user, q) : []), [user, q]);
  const selectedUsers = useMemo<User[]>(
    () => (user ? eligibleAssignees(user, "").filter((u) => selected.includes(u.id)) : []),
    [user, selected],
  );

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedUsers.map((u) => (
            <Badge key={u.id} variant="secondary" className="gap-1">
              {u.fullName}
              <button type="button" onClick={() => toggle(u.id)} className="ml-1 hover:text-destructive">
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="rounded-md border bg-card">
        <ScrollArea className="h-56">
          {results.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No reports found.</p>
          ) : (
            <ul className="divide-y">
              {results.map((u) => {
                const active = selected.includes(u.id);
                return (
                  <li key={u.id}>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => toggle(u.id)}
                      className="w-full justify-between rounded-none px-3 py-2 h-auto"
                    >
                      <span className="flex flex-col items-start">
                        <span className="text-sm font-medium">{u.fullName}</span>
                        <span className="text-xs text-muted-foreground">
                          {u.role.replace("_", " ")} · {u.department}
                        </span>
                      </span>
                      {active && <Check className="size-4 text-primary" />}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
