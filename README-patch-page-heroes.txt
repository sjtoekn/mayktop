patch-page-heroes  (Social hero + a ready News hero, same family as the Community banner)

NEW:      web/src/components/PageHero.tsx, PageHero.css   (variant "social" = dusk violet/peach + chat bubbles, "news" = morning blue/yellow + newspaper)
CHANGED:  web/src/app/(site)/social/page.tsx and social/following/page.tsx (hero on top; the old "Social" h1 is replaced by the hero's h1)
          web/src/i18n/messages/{en,ar,es,fr,hi,zh}.ts (8 new texts: social.hero.a/b/c/sub, news.hero.a/b/c/sub)
Install: unzip -o patch-page-heroes.zip   then in web/: npm run check:i18n && npm run lint && npm run build
NEWS: the News page is not in the project zip I got (it came from your separate news patch). To add the hero there, put this at the top of
      the page, instead of its own title block:
        import PageHero from "@/components/PageHero";
        <PageHero variant="news" parts={[t("news.hero.a"), t("news.hero.b"), t("news.hero.c")]} sub={t("news.hero.sub")} />
