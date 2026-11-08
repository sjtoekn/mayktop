// The public site frame: header + left sidebar + right column (it used to live in app/layout.tsx).
// Every public page is inside this route group; /admin is not (it has its own frame).
import Shell from "@/components/shell/Shell";
import AccountBanner from "@/components/AccountBanner";
import MyVotesProvider from "@/components/MyVotesProvider";
import { t } from "@/i18n";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <MyVotesProvider>
      <Shell>
        <AccountBanner
          text={{
            suspended: t("account.banner.suspended"),
            deletion: t("account.banner.deletion"),
            link: t("account.banner.link"),
          }}
        />
        {children}
      </Shell>
    </MyVotesProvider>
  );
}
