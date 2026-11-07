/** Friendly messages for login / sign-up errors. */
export function formatAuthError(err: any): string {
  const msg = String(err?.message || "").toLowerCase();
  if (msg.includes("rate limit") || msg.includes("too many") || err?.status === 429) {
    return "Too many attempts. Please wait a few minutes and try again.";
  }
  if (msg.includes("invalid email or password") || msg.includes("invalid login credentials")) {
    return "Incorrect email or password. Please double-check and try again.";
  }
  if (msg.includes("already exists") || msg.includes("already registered")) {
    return "This email is already registered. Please switch to Sign In.";
  }
  if (msg.includes("expired")) {
    return "That code has expired. Please request a new one.";
  }
  if (msg.includes("invalid otp") || msg.includes("invalid code") || msg.includes("incorrect code")) {
    return "That code is not correct. Please check it and try again.";
  }
  if (msg.includes("not verified")) {
    return "Please verify your email first. Use Create Account to get a new code.";
  }
  return err?.message || "Something went wrong. Please try again.";
}
