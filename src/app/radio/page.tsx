import type { Metadata } from "next";
import { VT323 } from "next/font/google";
import { RadioApp } from "@/components/RadioApp";

const pixel = VT323({ variable: "--f-pixel", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: "Radio · OFP Reader",
  description: "COMMS frequencies you fill in per flight, with the OFP's navaids and ILS frequencies carried over.",
};

export default function Page() {
  return (
    <div className={pixel.variable} style={{ display: "contents" }}>
      <RadioApp />
    </div>
  );
}
