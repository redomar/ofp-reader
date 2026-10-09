import type { Metadata } from "next";
import { SimpleApp } from "@/components/SimpleApp";

export const metadata: Metadata = {
  title: "Simple · OFP Reader",
  description: "The essentials of the active flight plan on one read-only page: times, fuel, weights, runways, weather and what to watch out for.",
};

export default function Page() {
  return <SimpleApp />;
}
