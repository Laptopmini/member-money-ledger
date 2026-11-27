import { createContext, useContext } from "react";
import { useFlags, useLogout, useMe } from "../api/auth";
import { ApiError } from "../api/client";
import type { User } from "../api/types";
import { ErrorState } from "./ErrorState";
import { Login } from "./Login";
import { SessionWarning } from "./SessionWarning";

type Auth = { user: User; signOut: () => void; signingOut: boolean } | null;
const AuthContext = createContext<Auth>(null);

/** null when auth is off (flag) so the UI shows no sign-out control. */
export const useAuth = () => useContext(AuthContext);

function Splash() {
  return (
    <div className="splash" aria-busy="true">
      <div className="skeleton skeleton--lg" />
    </div>
  );
}

function Authed({ children }: { children: React.ReactNode }) {
  const me = useMe(true);
  const logout = useLogout();

  if (me.isError) {
    if (me.error instanceof ApiError && me.error.status === 401) {
      return <Login expired={me.error.code === "session_expired"} />;
    }
    return <ErrorState title="Couldn't reach the server" onRetry={() => me.refetch()} />;
  }
  if (!me.data) return <Splash />;

  return (
    <AuthContext.Provider
      value={{ user: me.data.user, signOut: () => logout.mutate(), signingOut: logout.isPending }}
    >
      {children}
      <SessionWarning expiresIn={me.data.expires_in_seconds} fetchedAt={me.dataUpdatedAt} />
    </AuthContext.Provider>
  );
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const flags = useFlags();
  if (flags.isPending) return <Splash />;
  // If flags can't be read, stay safe and require sign-in; the server decides either way.
  const required = flags.isError || flags.data["auth-required"];
  if (!required) return <>{children}</>;
  return <Authed>{children}</Authed>;
}
