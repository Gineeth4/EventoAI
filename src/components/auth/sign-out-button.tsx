type SignOutButtonProps = {
  email?: string | null;
};

export default function SignOutButton({ email }: SignOutButtonProps) {
  return (
    <div className="plan-account-card" aria-label="Signed-in account">
      <div className="plan-account-info">
        <span className="plan-account-label">SIGNED IN</span>
        <span className="plan-account-email" title={email || undefined}>
          {email || "Account active"}
        </span>
      </div>

      <form action="/auth/signout" method="post" className="plan-account-form">
        <button type="submit" className="plan-signout-button">
          Sign out
        </button>
      </form>
    </div>
  );
}
