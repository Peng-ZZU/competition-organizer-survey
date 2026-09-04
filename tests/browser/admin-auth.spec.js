import { expect, test } from "@playwright/test";

async function installAdminRuntime(page, { valid = true, initialSession = null } = {}) {
  await page.addInitScript(({ valid, initialSession }) => {
    const listeners = [];
    window.__ADMIN_RUNTIME__ = {
      auth: {
        async getSession() { return initialSession; },
        async signIn(email, password) {
          if (!valid || email !== "admin@example.com" || password !== "secret-password") {
            throw new Error("specific provider error");
          }
          const session = { user: { email } };
          for (const listener of listeners) listener("SIGNED_IN", session);
          return session;
        },
        async signOut() { for (const listener of listeners) listener("SIGNED_OUT", null); },
        onAuthStateChange(listener) {
          listeners.push(listener);
          return () => listeners.splice(listeners.indexOf(listener), 1);
        },
      },
      data: { async loadResponses() { window.__adminLoadCount = (window.__adminLoadCount ?? 0) + 1; return []; } },
    };
    window.__expireAdminSession = () => listeners.forEach((listener) => listener("SIGNED_OUT", null));
  }, { valid, initialSession });
}

test("authorized administrator can log in and sign out without public registration", async ({ page }) => {
  await installAdminRuntime(page);
  await page.goto("/admin.html");
  await expect(page.getByRole("heading", { name: "Organizer sign in" })).toBeVisible();
  await expect(page.getByText(/sign up|register/i)).toHaveCount(0);
  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByLabel("Password").fill("secret-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Survey Analytics" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__adminLoadCount)).toBe(1);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Organizer sign in" })).toBeVisible();
});

test("invalid login uses a generic error", async ({ page }) => {
  await installAdminRuntime(page, { valid: false });
  await page.goto("/admin.html");
  await page.getByLabel("Email").fill("unknown@example.com");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toHaveText("Sign in failed. Check your credentials and try again.");
  await expect(page.getByText("specific provider error")).toHaveCount(0);
});

test("expired administrator session returns to sign in", async ({ page }) => {
  await installAdminRuntime(page, { initialSession: { user: { email: "admin@example.com" } } });
  await page.goto("/admin.html");
  await expect(page.getByRole("heading", { name: "Survey Analytics" })).toBeVisible();
  await page.evaluate(() => window.__expireAdminSession());
  await expect(page.getByRole("heading", { name: "Organizer sign in" })).toBeVisible();
});
