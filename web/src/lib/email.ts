// The one place the site sends email (verification, password reset).
//
// No email service is set up yet, so for now the email is PRINTED in the terminal where
// `npm run dev` is running; open the link from there. When a real service is chosen (Resend,
// Postmark ... see TODO 31 / 56), only THIS function changes. In production it refuses to
// "send" so that a missing email service is noticed instead of silently losing emails.
export type Mail = { to: string; subject: string; text: string };

export async function sendEmail(mail: Mail): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("No email service is set up yet: connect one in src/lib/email.ts");
  }
  const line = "=".repeat(70);
  console.log(
    `\n${line}\nEMAIL (printed here because no email service is set up yet)\nTo:      ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}\n${line}\n`,
  );
}
