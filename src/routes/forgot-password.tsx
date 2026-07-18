import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [employeeId, setEmployeeId] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!employeeId.trim()) {
      alert("Please enter your Employee ID.");
      return;
    }

    // TODO:
    // requestPasswordReset(employeeId)

    setSubmitted(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl">
            Forgot Password
          </CardTitle>

          <CardDescription>
            Request a password reset.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-6">

              <div className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
                If you have forgotten your password, please contact your
                system administrator.
              </div>

              <div className="relative text-center">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>

                <span className="relative bg-background px-3 text-xs text-muted-foreground">
                  OR
                </span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="employeeId">
                  Employee ID
                </Label>

                <Input
                  id="employeeId"
                  placeholder="Enter Employee ID"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                />
              </div>

              <Button className="w-full" type="submit">
                Request Reset
              </Button>

              <div className="text-center">
                <Link
                  to="/auth"
                  className="text-sm text-primary hover:underline"
                >
                  ← Back to Login
                </Link>
              </div>

            </form>
          ) : (
            <div className="space-y-5 text-center">

              <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
                Password reset request submitted successfully.
              </div>

              <p className="text-sm text-muted-foreground">
                Please contact your administrator to approve your password
                reset request.
              </p>

              <Button asChild className="w-full">
                <Link to="/auth">
                  Back to Login
                </Link>
              </Button>

            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}