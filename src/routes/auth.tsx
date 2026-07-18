import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CheckSquare } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — TaskFlow" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/dashboard" });
  }, [user, navigate]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const u = login(email, password);
    setBusy(false);
    if (u) {
      toast.success(`Welcome back, ${u.fullName}`);
      navigate({ to: "/dashboard" });
    } else {
      toast.error("Invalid credentials or inactive user");
    }
  };

  const quick = (e: string) => {
    setEmail(e);
    setPassword("demo");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-primary/90 to-primary text-primary-foreground">
        <div className="flex items-center gap-2">
          <CheckSquare className="size-6" />
          <span className="font-semibold tracking-tight">TaskFlow</span>
        </div>
        <div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Plan, assign and ship work across your team.
          </h1>
          <p className="mt-4 text-primary-foreground/80 max-w-md">
            Role-based dashboards, hierarchy-aware assignments, and a full activity trail for every task.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/60">© TaskFlow</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Use one of the demo accounts to explore each role.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw">Password</Label>
                <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                Sign in
              </Button>
            </form>
            <div className="mt-6 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Demo accounts (password: demo)</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ["Admin", "admin@demo.com"],
                  ["Manager", "manager@demo.com"],
                  ["Team Lead", "lead@demo.com"],
                  ["Reportee", "riya@demo.com"],
                ].map(([label, em]) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => quick(em)}
                    className="rounded-md border px-3 py-2 text-left hover:bg-accent transition"
                  >
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="truncate">{em}</div>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
