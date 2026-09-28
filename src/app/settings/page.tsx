import type { Metadata } from "next";
import { SettingsApp } from "@/components/SettingsApp";

export const metadata: Metadata = {
  title: "Settings · OFP Reader",
  description: "Saved flight plans, stored form entries and display preferences for OFP Reader.",
};

export default function Page() {
  return <SettingsApp />;
}
