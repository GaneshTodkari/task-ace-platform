import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/change-password")({
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const [employeeId, setEmployeeId] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (
      !employeeId.trim() ||
      !currentPassword ||
      !newPassword ||
      !confirmPassword
    ) {
      setError("Please fill in all fields.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and Confirm password do not match.");
      return;
    }

    if (newPassword === currentPassword) {
      setError("New password must be different from the current password.");
      return;
    }

    // TODO:
    // changePassword(employeeId, currentPassword, newPassword)

    setSuccess(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl">
            Change Password
          </CardTitle>

          <CardDescription>
            Update your account password.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-5">

              {error && (
                <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

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

              <div className="space-y-2">
                <Label htmlFor="currentPassword">
                  Current Password
                </Label>

                <Input
                  id="currentPassword"
                  type="password"
                  placeholder="Current Password"
                  value={currentPassword}
                  onChange={(e) =>
                    setCurrentPassword(e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">
                  New Password
                </Label>

                <Input
                  id="newPassword"
                  type="password"
                  placeholder="New Password"
                  value={newPassword}
                  onChange={(e) =>
                    setNewPassword(e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">
                  Confirm Password
                </Label>

                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(e.target.value)
                  }
                />
              </div>

              <Button className="w-full" type="submit">
                Save
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

              <div className="rounded-md border border-green-200 bg-green-50 p-4 text-green-700">
                Password changed successfully.
              </div>

              <p className="text-sm text-muted-foreground">
                Please login using your new password.
              </p>

              <Button asChild className="w-full">
                <Link to="/auth">
                  Go to Login
                </Link>
              </Button>

            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}