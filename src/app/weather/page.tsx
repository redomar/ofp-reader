import type { Metadata } from "next";
import { WeatherApp } from "@/components/WeatherApp";

export const metadata: Metadata = {
  title: "Weather · OFP Reader",
  description: "Paste METARs, TAFs and ATIS and read them as weather cards: sky, wind, visibility, cloud layers and a TAF timeline.",
};

export default function Page() {
  return <WeatherApp />;
}
