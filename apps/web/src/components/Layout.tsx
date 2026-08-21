import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOutIcon, MessageSquareQuoteIcon } from 'lucide-react';
import { homeFor, useAuth } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const navItems =
    user?.role === 'reviewer'
      ? [
          { to: '/queue', label: 'Queue' },
          { to: '/notifications', label: 'Notifications' },
          { to: '/submit', label: 'Public form' },
        ]
      : [
          { to: '/approved', label: 'Approved' },
          { to: '/submit', label: 'Public form' },
        ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Link to={homeFor(user)} className="flex items-center gap-2 font-semibold tracking-tight">
            <MessageSquareQuoteIcon className="size-5 text-primary" />
            Proof Desk
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-1.5 text-sm transition-colors',
                    isActive
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {user && (
              <>
                <Badge variant="secondary" className="capitalize">
                  {user.displayName}
                </Badge>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOutIcon />
                  Log out
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
