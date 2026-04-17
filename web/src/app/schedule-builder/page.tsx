import { permanentRedirect } from "next/navigation";

type ScheduleBuilderRedirectProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ScheduleBuilderRedirect({ searchParams }: ScheduleBuilderRedirectProps) {
  const resolvedSearchParams = await searchParams;
  const nextSearchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(resolvedSearchParams ?? {})) {
    if (Array.isArray(value)) {
      for (const item of value) {
        nextSearchParams.append(key, item);
      }
      continue;
    }

    if (typeof value === "string") {
      nextSearchParams.set(key, value);
    }
  }

  const query = nextSearchParams.toString();
  permanentRedirect(query ? `/?${query}` : "/");
}
