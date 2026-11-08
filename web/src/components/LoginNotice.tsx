import Link from "next/link";

// Shown when someone who is not logged in tries to post, comment or vote.
// The words come in as props (translated on the server with t()).
export type LoginText = { message: string; link: string };

export default function LoginNotice({ text }: { text: LoginText }) {
  return (
    <>
      {text.message}{" "}
      <Link href="/login" className="underline">
        {text.link}
      </Link>
    </>
  );
}
