import { expect, test, type Page } from "@playwright/test";
import { deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const projectId = "campusgig-e2e";
const password = "CampusGigE2E!2026";
const clientEmail = "client.e2e@example.com";
const studentEmail = "student.e2e@example.com";
const adminEmail = "admin.e2e@example.com";
const signupEmail = "new-member.e2e@example.com";

const identities = {
  client: {
    email: clientEmail,
    fullName: "CampusGig E2E Client",
    username: "e2e-client",
  },
  student: {
    email: studentEmail,
    fullName: "CampusGig E2E Student",
    username: "e2e-student",
  },
} as const;

async function clearEmulators() {
  const responses = await Promise.all([
    fetch(
      `http://127.0.0.1:8080/emulator/v1/projects/${projectId}/databases/(default)/documents`,
      { method: "DELETE" },
    ),
    fetch(
      `http://127.0.0.1:9099/emulator/v1/projects/${projectId}/accounts`,
      { method: "DELETE" },
    ),
  ]);

  for (const response of responses) {
    if (!response.ok) {
      throw new Error(
        `Firebase emulator cleanup failed with HTTP ${response.status}.`,
      );
    }
  }
}

async function seedIdentity(
  role: keyof typeof identities,
  studentVerified: boolean,
) {
  const identity = identities[role];
  const auth = getAuth();
  const db = getFirestore();
  const user = await auth.createUser({
    email: identity.email,
    password,
    emailVerified: true,
    displayName: identity.fullName,
  });
  const now = Timestamp.now();

  await Promise.all([
    db.collection("users").doc(user.uid).set({
      uid: user.uid,
      email: identity.email,
      fullName: identity.fullName,
      username: identity.username,
      usernameNormalized: identity.username,
      emailVerified: true,
      studentVerified,
      verificationStatus: studentVerified ? "approved" : "unsubmitted",
      onboardingComplete: true,
      country: "Nigeria",
      university: "CampusGig Test University",
      course: studentVerified ? "Computer Science" : "",
      headline: studentVerified
        ? "Product designer and frontend developer"
        : "Campus organisation",
      bio: "A deterministic profile created only inside the Firebase emulator.",
      skills: studentVerified ? "Product design, React, research" : "",
      availability: studentVerified ? "Available this week" : "",
      completedGigCount: 0,
      ratingCount: 0,
      averageRating: 0,
      totalEarnedUsdcBaseUnits: "0",
      createdAt: now,
      updatedAt: now,
    }),
    db.collection("usernames").doc(identity.username).set({
      uid: user.uid,
      username: identity.username,
      createdAt: now,
    }),
  ]);

  return user;
}

async function login(page: Page, email: string, admin = false) {
  await page.goto(admin ? "/admin/login" : "/login");
  await page.getByLabel(admin ? "Admin email" : "Email address").fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page
    .getByRole("button", {
      name: admin ? "Open admin console" : "Log in",
    })
    .click();
  await page.waitForURL(admin ? /\/admin$/ : /\/gigs$/);
}

test.describe.serial("authenticated marketplace with Firebase emulators", () => {
  let clientUid = "";
  let studentUid = "";
  let gigId = "";

  test.beforeAll(async () => {
    if (
      process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099" ||
      process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080"
    ) {
      throw new Error(
        "Authenticated E2E tests are restricted to the local Firebase emulators.",
      );
    }

    await clearEmulators();
    if (getApps().length === 0) initializeApp({ projectId });
    const client = await seedIdentity("client", false);
    const student = await seedIdentity("student", true);
    clientUid = client.uid;
    studentUid = student.uid;
    await getAuth().createUser({
      email: adminEmail,
      password,
      emailVerified: true,
      displayName: "CampusGig E2E Administrator",
    });
  });

  test.afterAll(async () => {
    await Promise.all(getApps().map((app) => deleteApp(app)));
  });

  test("new member signs up, receives verification, and reaches onboarding", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto("/signup");
    await page.getByLabel("Full name").fill("CampusGig New Member");
    await page.getByLabel("Username").fill("e2e_new_member");
    await page.getByLabel("Email address").fill(signupEmail);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL(/\/verify-email$/);
    await expect(
      page.getByRole("heading", { name: "Check your email" }),
    ).toBeVisible();
    await expect(page.getByText(signupEmail, { exact: true })).toBeVisible();

    let oobCode = "";
    await expect
      .poll(
        async () => {
          const response = await fetch(
            `http://127.0.0.1:9099/emulator/v1/projects/${projectId}/oobCodes`,
          );
          const payload = (await response.json()) as {
            oobCodes?: Array<{
              email?: string;
              oobCode?: string;
              requestType?: string;
            }>;
          };
          const verification = payload.oobCodes?.find(
            (item) =>
              item.email === signupEmail &&
              item.requestType === "VERIFY_EMAIL",
          );
          oobCode = verification?.oobCode ?? "";
          return oobCode;
        },
        { timeout: 10_000 },
      )
      .not.toBe("");

    const verificationResponse = await fetch(
      "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update?key=e2e-fake-api-key",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oobCode }),
      },
    );
    expect(verificationResponse.ok).toBe(true);

    await page
      .getByRole("button", { name: "I’ve verified my email" })
      .click();
    await page.waitForURL(/\/profile\/edit\?onboarding=1$/);
    await expect(
      page.getByRole("heading", { name: "Edit your profile" }),
    ).toBeVisible();

    const createdUser = await getAuth().getUserByEmail(signupEmail);
    const [profile, username, wallet] = await Promise.all([
      getFirestore().collection("users").doc(createdUser.uid).get(),
      getFirestore().collection("usernames").doc("e2e_new_member").get(),
      getFirestore().collection("walletKeys").doc(createdUser.uid).get(),
    ]);
    expect(createdUser.emailVerified).toBe(true);
    expect(profile.data()?.emailVerified).toBe(true);
    expect(profile.data()?.onboardingComplete).toBe(false);
    expect(username.data()?.uid).toBe(createdUser.uid);
    expect(wallet.exists).toBe(true);

    await page
      .getByLabel("Professional headline")
      .fill("Frontend developer and product designer");
    await page.getByLabel("Skills").fill("React, Product design, Accessibility");
    await page.getByLabel("Years of experience").fill("3");
    await page
      .getByLabel("Languages")
      .fill("English (fluent), French (conversational)");
    await page.getByRole("button", { name: "Add link" }).click();
    await page.getByLabel("Label").fill("GitHub projects");
    await page.getByLabel("HTTPS link").fill("https://github.com/campusgig-e2e");
    await page.getByRole("button", { name: "Save profile" }).click();
    await page.waitForURL(/\/gigs$/);

    const completedProfile = await getFirestore()
      .collection("users")
      .doc(createdUser.uid)
      .get();
    expect(completedProfile.data()?.onboardingComplete).toBe(true);
    expect(completedProfile.data()?.yearsExperience).toBe(3);
    expect(completedProfile.data()?.portfolioLinks).toEqual([
      {
        label: "GitHub projects",
        type: "github",
        url: "https://github.com/campusgig-e2e",
      },
    ]);
  });

  test("client and student progress from posting through accepted terms", async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const clientContext = await browser.newContext();
    const studentContext = await browser.newContext();
    const clientPage = await clientContext.newPage();
    const studentPage = await studentContext.newPage();

    await login(clientPage, clientEmail);
    await clientPage.goto("/post");
    await expect(
      clientPage.getByRole("heading", { name: "Post a gig" }),
    ).toBeVisible();

    await clientPage
      .getByLabel("Gig title")
      .fill("Design a launch page for our student society");
    await clientPage
      .getByLabel("Short summary")
      .fill(
        "Create a polished, responsive launch page for a university student society.",
      );
    await clientPage
      .getByLabel("Full description")
      .fill(
        "Design and build one responsive landing page with an event overview, member benefits, clear calls to action, and a documented handoff for our student team.",
      );
    await clientPage
      .locator("label")
      .filter({ hasText: "USDC on Solana" })
      .click();
    await clientPage.getByLabel("Budget").fill("75.00");
    await clientPage.getByLabel("Category").selectOption("Design");
    const deadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1_000)
      .toISOString()
      .slice(0, 10);
    await clientPage.getByLabel("Deadline").fill(deadline);
    await clientPage.getByRole("button", { name: "Publish gig" }).click();
    await expect(
      clientPage.getByRole("heading", { name: "Your gig is live" }),
    ).toBeVisible();
    await clientPage.getByRole("link", { name: "View live listing" }).click();
    await clientPage.waitForURL(/\/gigs\/[A-Za-z0-9_-]+$/);
    gigId = clientPage.url().split("/").at(-1) ?? "";
    expect(gigId).not.toBe("");

    await login(studentPage, studentEmail);
    await studentPage.goto(`/gigs/${gigId}`);
    await expect(
      studentPage.getByRole("heading", {
        name: "Design a launch page for our student society",
      }),
    ).toBeVisible();
    await studentPage
      .getByLabel("Short note to the poster")
      .fill(
        "I have shipped responsive student-community websites and can provide the design, implementation, and documented handoff before the deadline.",
      );
    await studentPage
      .getByRole("button", { name: "Apply for this gig" })
      .click();
    await expect(studentPage.getByText("Application sent")).toBeVisible();

    await clientPage.goto(`/my-gigs/${gigId}/applicants`);
    await expect(
      clientPage.getByRole("heading", {
        name: "Choose a student for this gig",
      }),
    ).toBeVisible();
    await expect(clientPage.getByText("CampusGig E2E Student")).toBeVisible();
    await clientPage.getByRole("button", { name: "View profile" }).click();
    await expect(
      clientPage.getByRole("heading", { name: "About CampusGig E2E Student" }),
    ).toBeVisible();
    await clientPage.getByRole("button", { name: "Select student" }).click();
    await expect(
      clientPage.getByText("CampusGig E2E Student selected"),
    ).toBeVisible();
    await expect(
      clientPage.getByRole("link", { name: "Open chat & terms" }),
    ).toBeVisible();

    await clientPage
      .getByRole("link", { name: "Open chat & terms" })
      .click();
    await expect(
      clientPage.getByRole("heading", { name: "Chat and agree terms" }),
    ).toBeVisible({ timeout: 20_000 });
    await clientPage
      .getByRole("textbox", { name: "Message", exact: true })
      .fill(
        "Welcome aboard. Please review https://example.com/brief and confirm that the responsive page and documented handoff are clear before I propose the final terms.",
      );
    await clientPage
      .locator("#conversation-attachment")
      .setInputFiles({
        name: "scope-notes.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("Accessible navigation and a documented handoff are required."),
      });
    await clientPage.getByRole("button", { name: "Send message" }).click();
    await expect(clientPage.getByText("Welcome aboard.")).toBeVisible();

    await studentPage.goto(`/gigs/${gigId}/conversation`);
    await expect(
      studentPage.getByRole("heading", { name: "Chat and agree terms" }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(studentPage.getByText(/Welcome aboard/)).toBeVisible();
    await expect(
      studentPage.getByRole("link", { name: "https://example.com/brief" }),
    ).toBeVisible();
    const attachmentDownload = studentPage.waitForEvent("download");
    await studentPage
      .getByRole("button", { name: "Download scope-notes.txt" })
      .click();
    expect((await attachmentDownload).suggestedFilename()).toBe("scope-notes.txt");
    await studentPage.setViewportSize({ width: 390, height: 844 });
    await studentPage
      .getByRole("button", {
        name: "Report message from CampusGig E2E Client",
      })
      .click();
    await studentPage.getByLabel("Reason").selectOption("unsafe_file_or_link");
    await studentPage
      .getByLabel("Additional details (optional)")
      .fill(
        "Please review the external brief link and the attached file before I open either outside this test.",
      );
    await studentPage.getByRole("button", { name: "Send report" }).click();
    await expect(studentPage.getByText(/Report sent privately/)).toBeVisible();
    await studentPage
      .getByRole("textbox", { name: "Message", exact: true })
      .fill(
        "Confirmed. I will deliver the responsive page, source files, and handoff notes by the agreed deadline.",
      );
    await expect(clientPage.getByText("Typing…", { exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await studentPage.getByRole("button", { name: "Send message" }).click();
    await expect(
      studentPage.getByText(/Confirmed. I will deliver/),
    ).toBeVisible();
    await expect(
      clientPage.getByText(/Confirmed. I will deliver/),
    ).toBeVisible({ timeout: 10_000 });

    await clientPage
      .getByRole("textbox", { name: "Scope", exact: true })
      .fill(
        "Design and implement the responsive launch page described in the published gig, including accessible navigation and clear calls to action.",
      );
    await clientPage
      .getByLabel("Deliverables")
      .fill(
        "Responsive production page, source files, and concise handoff documentation.",
      );
    await clientPage.getByLabel("Deadline").fill(deadline);
    await clientPage.getByLabel("Revisions").fill("2");
    await clientPage.getByLabel("Agreed amount (USDC)").fill("75.00");
    await clientPage
      .getByRole("button", { name: "Propose final terms" })
      .click();
    await expect(clientPage.getByText("Awaiting student")).toBeVisible();

    await expect(
      studentPage.getByRole("button", { name: "Accept final terms" }),
    ).toBeVisible({ timeout: 10_000 });
    await studentPage
      .getByRole("button", { name: "Accept final terms" })
      .click();
    await expect(
      studentPage.getByText(
        "You accepted these terms. Funding is the next step.",
      ),
    ).toBeVisible();

    const [
      gig,
      application,
      clientWallet,
      studentWallet,
      conversation,
      payment,
      escrowWallet,
      messages,
      safetyReports,
    ] = await Promise.all([
      getFirestore().collection("gigs").doc(gigId).get(),
      getFirestore()
        .collection("applications")
        .doc(`${gigId}__${studentUid}`)
        .get(),
      getFirestore().collection("walletKeys").doc(clientUid).get(),
      getFirestore().collection("walletKeys").doc(studentUid).get(),
      getFirestore().collection("gigConversations").doc(gigId).get(),
      getFirestore().collection("gigPayments").doc(gigId).get(),
      getFirestore().collection("paymentWalletKeys").doc(gigId).get(),
      getFirestore()
        .collection("gigConversations")
        .doc(gigId)
        .collection("messages")
        .get(),
      getFirestore().collection("safetyReports").get(),
    ]);
    expect(gig.data()?.status).toBe("awaiting_funding");
    expect(gig.data()?.selectedApplicantId).toBe(studentUid);
    expect(gig.data()?.agreementStatus).toBe("accepted");
    expect(application.data()?.status).toBe("accepted");
    expect(clientWallet.exists).toBe(true);
    expect(studentWallet.exists).toBe(true);
    expect(conversation.data()?.agreementStatus).toBe("accepted");
    expect(conversation.data()?.acceptedVersion).toBe(1);
    expect(payment.data()?.status).toBe("awaiting_funding");
    expect(payment.data()?.amountBaseUnits).toBe("75000000");
    expect(escrowWallet.exists).toBe(true);
    expect(messages.size).toBe(2);
    const attachment = messages.docs
      .map((document) => document.data().attachment)
      .find(Boolean);
    expect(attachment?.scanStatus).toBe("clean");
    expect(attachment?.scanEngine).toBe("isolated-emulator");
    expect(attachment?.storagePath).toMatch(
      new RegExp(`^chatAttachments/${gigId}/`),
    );
    expect(attachment?.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(safetyReports.size).toBe(1);
    expect(safetyReports.docs[0].data()).toMatchObject({
      gigId,
      reporterId: studentUid,
      subjectUserId: clientUid,
      category: "unsafe_file_or_link",
      priority: "high",
      status: "open",
      messageEvidence: {
        attachment: {
          name: "scope-notes.txt",
          scanStatus: "clean",
        },
      },
    });

    await Promise.all([clientContext.close(), studentContext.close()]);
  });

  test("approved administrator reaches live operations analytics", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await login(page, adminEmail, true);
    await expect(
      page.getByRole("heading", { name: "Marketplace overview" }),
    ).toBeVisible();
    await expect(page.getByText("Total members")).toBeVisible();
    await expect(page.getByText("Verified students")).toBeVisible();
    await expect(page.getByText("CampusGig E2E Administrator")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Safety reports", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Safety reports", exact: true })
      .click();
    await expect(page.getByRole("heading", { name: "Safety reports" })).toBeVisible();
    await expect(page.getByText("Unsafe file or link")).toBeVisible();
    await expect(page.getByText("CampusGig E2E Client")).toBeVisible();
    await expect(page.getByText("scope-notes.txt")).toBeVisible();
    await page.getByRole("button", { name: "Start review" }).click();
    await expect(page.getByText(/now under review/)).toBeVisible();
    await page
      .getByLabel("Resolution note")
      .fill(
        "Reviewed the preserved text, clean scan result, and link context. No policy violation was established in this emulator scenario.",
      );
    await page.getByRole("button", { name: "Dismiss report" }).click();
    await expect(page.getByText(/was dismissed/)).toBeVisible();
    const [closedReport, auditEvents] = await Promise.all([
      getFirestore().collection("safetyReports").limit(1).get(),
      getFirestore()
        .collection("adminAuditEvents")
        .where("action", "==", "safety_report_dismiss")
        .get(),
    ]);
    expect(closedReport.docs[0].data()?.status).toBe("dismissed");
    expect(auditEvents.size).toBe(1);
  });
});
