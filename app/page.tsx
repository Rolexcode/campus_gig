import type { Metadata } from "next";
import { CampusGigApp } from "./components/CampusGigApp";

export const metadata: Metadata = {
  title: "CampusGig — Safe student gigs",
  description: "Find trusted student talent or earn from your skills with payment protected in escrow.",
};

export default function Home() {
  return <CampusGigApp route={[]} />;
}
