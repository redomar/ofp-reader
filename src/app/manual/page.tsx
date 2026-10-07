import type { Metadata } from "next";
import { ManualApp } from "@/components/ManualApp";

export const metadata: Metadata = {
  title: "Manual · OFP Reader",
  description: "How to use OFP Reader: where every part of the OFP is, what each section shows, and quick-reference workflows for each phase of flight.",
};

export default function Page() {
  return <ManualApp />;
}
