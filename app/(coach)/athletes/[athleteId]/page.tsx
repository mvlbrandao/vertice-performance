import { redirect } from "next/navigation";

export default async function AthleteRootPage({
  params,
}: {
  params: Promise<{ athleteId: string }>;
}) {
  const { athleteId } = await params;
  redirect(`/athletes/${athleteId}/dados`);
}
