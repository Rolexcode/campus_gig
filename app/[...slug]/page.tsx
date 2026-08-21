import { CampusGigApp } from "../components/CampusGigApp";

export default async function CampusGigRoute({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  return <CampusGigApp route={slug} />;
}
