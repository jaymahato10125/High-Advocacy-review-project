import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EyeIcon, Loader2Icon, MessageSquareQuoteIcon, ShieldCheckIcon } from 'lucide-react';
import { homeFor, useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Login (§9): two buttons, no fields, no password — this *is* "a simple way
// to switch between them".
export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState<'reviewer' | 'viewer' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(role: 'reviewer' | 'viewer') {
    setPending(role);
    setError(null);
    try {
      const user = await login(role);
      navigate(homeFor(user), { replace: true });
    } catch {
      setError('Could not sign in — is the API running?');
      setPending(null);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <MessageSquareQuoteIcon className="size-5 text-primary" />
          </div>
          <CardTitle className="text-xl">Proof Desk</CardTitle>
          <CardDescription>Testimonial review, minus the spreadsheets.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button size="lg" disabled={pending !== null} onClick={() => signIn('reviewer')}>
            {pending === 'reviewer' ? <Loader2Icon className="animate-spin" /> : <ShieldCheckIcon />}
            Continue as Reviewer
          </Button>
          <Button
            size="lg"
            variant="outline"
            disabled={pending !== null}
            onClick={() => signIn('viewer')}
          >
            {pending === 'viewer' ? <Loader2Icon className="animate-spin" /> : <EyeIcon />}
            Continue as Viewer
          </Button>
          {error && <p className="text-center text-sm text-destructive">{error}</p>}
          <p className="text-center text-xs text-muted-foreground">
            No password — pick a role. The session is a signed httpOnly cookie.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
