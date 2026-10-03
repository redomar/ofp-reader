import type { Metadata } from "next";
import { RadioApp } from "@/components/RadioApp";

export const metadata: Metadata = {
  title: "Radio · OFP Reader",
  description: "COMMS frequencies you fill in per flight, with the OFP's navaids and ILS frequencies carried over.",
};

export default function Page() {
  return <RadioApp />;
}
