import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Страница не найдена</h2>
<<<<<<< HEAD
        <p className="mt-2 text-sm text-muted-foreground">Запрашиваемой страницы не существует.</p>
=======
        <p className="mt-2 text-sm text-muted-foreground">
          Запрашиваемой страницы не существует.
        </p>
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Что-то пошло не так</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
<<<<<<< HEAD
            onClick={() => {
              router.invalidate();
              reset();
            }}
=======
            onClick={() => { router.invalidate(); reset(); }}
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Повторить
          </button>
<<<<<<< HEAD
          <a
            href="/"
            className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
=======
          <a href="/" className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
            На главную
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
<<<<<<< HEAD
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1",
      },
=======
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1" },
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
      { name: "theme-color", content: "#b91c4a" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Senim" },
<<<<<<< HEAD
      { title: "Senim — Закажите поездку" },
      {
        name: "description",
        content:
          "Закажите поездку или станьте водителем в Senim. Отслеживание в реальном времени, честные тарифы.",
      },
=======
      { title: "Senim" },
      { name: "description", content: "платформа, которая делает поездки женщин и детей безопаснее благодаря строгой проверке водителей, отслеживанию маршрута и инструментам экстренной помощи." },
      { property: "og:title", content: "Senim" },
      { name: "twitter:title", content: "Senim" },
      { property: "og:description", content: "платформа, которая делает поездки женщин и детей безопаснее благодаря строгой проверке водителей, отслеживанию маршрута и инструментам экстренной помощи." },
      { name: "twitter:description", content: "платформа, которая делает поездки женщин и детей безопаснее благодаря строгой проверке водителей, отслеживанию маршрута и инструментам экстренной помощи." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/96531cb1-d133-49e7-8b52-928dbd8883af/id-preview-ee0470d2--8dc130c5-532d-45d7-935a-aaba3555a2c1.lovable.app-1782850514499.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/96531cb1-d133-49e7-8b52-928dbd8883af/id-preview-ee0470d2--8dc130c5-532d-45d7-935a-aaba3555a2c1.lovable.app-1782850514499.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icon-512.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/icon-512.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
<<<<<<< HEAD
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
=======
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
>>>>>>> e04c986f27501ce55aa6761282b45af2d1d8c231
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster richColors closeButton position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
