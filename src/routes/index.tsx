import { createFileRoute } from "@tanstack/react-router";
import { BookingApp } from "@/components/booking/BookingApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Резервации — кабинети, салони, заведения, зали" },
      { name: "description", content: "Една система за резервации, настроена чрез конфигурация за различни видове бизнес." },
      { property: "og:title", content: "Универсална система за резервации" },
      { property: "og:description", content: "Проверка на наличност, конфликти и капацитет за всякакъв бизнес." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BookingApp,
});
